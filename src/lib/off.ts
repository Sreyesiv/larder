// Open Food Facts client: barcode lookup and text search.
// Data is crowd-sourced from product labels and licensed under the ODbL.

import { type Food, type Nutrients, type Serving, withStandardServings } from './nutrition';

const HOST = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code', 'product_name', 'product_name_en', 'generic_name', 'brands', 'quantity',
  'serving_size', 'serving_quantity', 'serving_quantity_unit', 'nutrition_data_per',
  'product_quantity', 'product_quantity_unit', 'nutriments',
].join(',');

// Open Food Facts stores every mass in grams; these convert to the label's unit.
const MAP: { key: keyof Nutrients; off: string; mult: number }[] = [
  { key: 'protein', off: 'proteins', mult: 1 },
  { key: 'carbs', off: 'carbohydrates', mult: 1 },
  { key: 'fat', off: 'fat', mult: 1 },
  { key: 'satFat', off: 'saturated-fat', mult: 1 },
  { key: 'transFat', off: 'trans-fat', mult: 1 },
  { key: 'polyFat', off: 'polyunsaturated-fat', mult: 1 },
  { key: 'monoFat', off: 'monounsaturated-fat', mult: 1 },
  { key: 'fiber', off: 'fiber', mult: 1 },
  { key: 'sugar', off: 'sugars', mult: 1 },
  { key: 'addedSugar', off: 'added-sugars', mult: 1 },
  { key: 'cholesterol', off: 'cholesterol', mult: 1000 },
  { key: 'sodium', off: 'sodium', mult: 1000 },
  { key: 'potassium', off: 'potassium', mult: 1000 },
  { key: 'calcium', off: 'calcium', mult: 1000 },
  { key: 'iron', off: 'iron', mult: 1000 },
  { key: 'vitaminC', off: 'vitamin-c', mult: 1000 },
  { key: 'vitaminA', off: 'vitamin-a', mult: 1e6 },
  { key: 'vitaminD', off: 'vitamin-d', mult: 1e6 },
];

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return isFinite(n) ? n : undefined;
  }
  return undefined;
}

function readNutrients(nm: Record<string, unknown>, suffix: string): Nutrients {
  const out: Nutrients = {};
  const kcal = num(nm['energy-kcal' + suffix]);
  const kj = num(nm['energy-kj' + suffix]) ?? num(nm['energy' + suffix]);
  if (kcal !== undefined) out.calories = kcal;
  else if (kj !== undefined) out.calories = kj / 4.184;
  for (const m of MAP) {
    const v = num(nm[m.off + suffix]);
    if (v !== undefined) out[m.key] = v * m.mult;
  }
  // Salt is listed far more often than sodium on European labels.
  if (out.sodium === undefined) {
    const salt = num(nm['salt' + suffix]);
    if (salt !== undefined) out.sodium = (salt / 2.5) * 1000;
  }
  return out;
}

const round = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : Math.round(v * 10) / 10);

/** Turn an Open Food Facts product record into a Food. Returns null if it has no usable name or code. */
export function parseProduct(p: any): Food | null {
  if (!p || typeof p !== 'object') return null;
  const code = String(p.code ?? '').trim();
  const name = String(p.product_name || p.product_name_en || p.generic_name || '').trim();
  if (!code && !name) return null;
  const nm: Record<string, unknown> = p.nutriments && typeof p.nutriments === 'object' ? p.nutriments : {};

  const liquid = [p.serving_quantity_unit, p.product_quantity_unit].some((u) => typeof u === 'string' && /^(ml|l|cl|dl|fl ?oz)$/i.test(u.trim()))
    || /\b(ml|cl|l|fl\.? ?oz)\b/i.test(String(p.serving_size ?? ''));
  const massUnit: 'g' | 'ml' = liquid ? 'ml' : 'g';

  const per100 = readNutrients(nm, '_100g');
  const perServing = readNutrients(nm, '_serving');
  const has100 = Object.keys(per100).length > 0;
  const hasServing = Object.keys(perServing).length > 0;
  const servingQty = num(p.serving_quantity);
  const servingText = String(p.serving_size ?? '').trim();

  let baseQty: number;
  let baseUnit: Food['baseUnit'];
  let nutrients: Nutrients;
  let servings: Serving[] = [];

  if (has100) {
    baseQty = 100;
    baseUnit = massUnit;
    nutrients = per100;
    if (servingQty && servingQty > 0) {
      const sized = `${round(servingQty)} ${massUnit}`;
      // Keep the label's own wording ("1 can", "2 cookies") and make sure the weight is visible.
      const label = servingText && /\d/.test(servingText)
        ? (new RegExp(`\\d\\s*${massUnit}\\b`, 'i').test(servingText) ? servingText.replace(/(\d+\.\d{2,})/g, (m) => String(round(Number(m)))) : `${servingText} (${sized})`)
        : sized;
      servings.push({ label, qty: servingQty });
    }
    const pq = num(p.product_quantity);
    if (pq && pq > 0 && pq <= 3000 && (!servingQty || Math.abs(pq - servingQty) > 0.5)) {
      servings.push({ label: `1 package (${round(pq)} ${massUnit})`, qty: pq });
    }
  } else if (hasServing) {
    baseQty = 1;
    baseUnit = 'serving';
    nutrients = perServing;
    servings = [{ label: servingText ? `1 serving (${servingText})` : '1 serving', qty: 1 }];
  } else {
    baseQty = 100;
    baseUnit = massUnit;
    nutrients = {};
  }

  const brand = String(p.brands ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)[0];
  return {
    id: 'off:' + (code || name.toLowerCase()),
    source: 'off',
    name: name || 'Unnamed product',
    brand: brand || undefined,
    barcode: code || undefined,
    baseQty,
    baseUnit,
    nutrients,
    servings: withStandardServings(baseUnit, servings),
    incomplete: nutrients.calories === undefined || undefined,
    updatedAt: Date.now(),
  };
}

export class LookupError extends Error {
  constructor(public kind: 'offline' | 'server', message: string) {
    super(message);
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })); }, { once: true });
  });

/**
 * Open Food Facts limits how often it can be queried, and when it refuses a request the browser
 * reports it the same way as a dropped connection. So a failed request is retried twice before giving up.
 */
async function getJson(url: string, signal?: AbortSignal, what = 'food database'): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal });
      // The API answers 404 for an unknown barcode with a normal JSON body.
      if (res.ok || res.status === 404) return await res.json();
      if (attempt >= 2) throw new LookupError('server', `The ${what} is busy (error ${res.status}). Try again in a moment.`);
    } catch (e: any) {
      if (e?.name === 'AbortError' || e instanceof LookupError) throw e;
      if (attempt >= 2) {
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        throw new LookupError(offline ? 'offline' : 'server', offline
          ? 'You are offline. Connect to the internet to look this up.'
          : `The ${what} did not answer. It limits how often it can be queried, so try again in a moment.`);
      }
    }
    // Being offline will not fix itself in a second; fail fast so the scanner can say so.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new LookupError('offline', 'You are offline. Connect to the internet to look this up.');
    await sleep(attempt === 0 ? 1200 : 2500, signal);
  }
}

/** Look up one barcode. Resolves to null when Open Food Facts has no such product. */
export async function fetchProduct(barcode: string, signal?: AbortSignal): Promise<Food | null> {
  const data = await getJson(`${HOST}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, signal);
  if (!data || data.status !== 1 || !data.product) return null;
  const food = parseProduct({ code: barcode, ...data.product });
  if (food) food.barcode = barcode;
  return food;
}

/** Full-text product search, most-scanned products first. Products without calorie data are dropped. */
export async function searchProducts(query: string, signal?: AbortSignal): Promise<Food[]> {
  const url = `${HOST}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&sort_by=unique_scans_n&page_size=25&fields=${FIELDS}`;
  const data = await getJson(url, signal, 'product search');
  const list: any[] = Array.isArray(data?.products) ? data.products : [];
  const out: Food[] = [];
  const seen = new Set<string>();
  for (const p of list) {
    const f = parseProduct(p);
    if (!f || f.incomplete || f.name === 'Unnamed product' || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}
