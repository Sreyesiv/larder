// USDA FoodData Central client. Used for generic foods (produce, meat, grains)
// and as a second source for US barcodes. Requires a free api.data.gov key.

import { type Food, type Nutrients, type Serving, withStandardServings } from './nutrition';
import { LookupError } from './off';

const HOST = 'https://api.nal.usda.gov/fdc/v1';

// FoodData Central nutrient ids. Energy has three possible ids depending on the dataset.
const IDS: Record<number, keyof Nutrients> = {
  1008: 'calories', 2047: 'calories', 2048: 'calories',
  1003: 'protein', 1004: 'fat', 1005: 'carbs', 1079: 'fiber',
  2000: 'sugar', 1063: 'sugar', 1235: 'addedSugar',
  1258: 'satFat', 1257: 'transFat', 1293: 'polyFat', 1292: 'monoFat',
  1253: 'cholesterol', 1093: 'sodium', 1092: 'potassium', 1087: 'calcium', 1089: 'iron',
  1162: 'vitaminC', 1106: 'vitaminA', 1114: 'vitaminD',
};

function titleCase(s: string): string {
  // Branded entries arrive in ALL CAPS; soften them without touching mixed-case names.
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s(\-/])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

export function parseUsdaFood(f: any): Food | null {
  if (!f || !f.fdcId || !f.description) return null;
  const nutrients: Nutrients = {};
  for (const n of Array.isArray(f.foodNutrients) ? f.foodNutrients : []) {
    const id = Number(n.nutrientId ?? n.nutrient?.id);
    const key = IDS[id];
    const value = Number(n.value ?? n.amount);
    if (!key || !isFinite(value)) continue;
    // Prefer the plain kcal figure (1008) when several energy rows are present.
    if (key === 'calories' && nutrients.calories !== undefined && id !== 1008) continue;
    if (key === 'calories' && String(n.unitName ?? n.nutrient?.unitName ?? '').toUpperCase() === 'KJ') continue;
    if (key === 'sugar' && nutrients.sugar !== undefined && id !== 2000) continue;
    nutrients[key] = value;
  }
  if (nutrients.calories === undefined) return null;

  const branded = f.dataType === 'Branded';
  const unit = String(f.servingSizeUnit ?? '').toLowerCase();
  const baseUnit: 'g' | 'ml' = branded && /^(ml|mlt)$/.test(unit) ? 'ml' : 'g';
  const servings: Serving[] = [];
  const size = Number(f.servingSize);
  if (branded && isFinite(size) && size > 0) {
    const household = String(f.householdServingFullText ?? '').trim();
    const sized = `${Math.round(size * 10) / 10} ${baseUnit}`;
    servings.push({ label: household ? `${household.toLowerCase()} (${sized})` : sized, qty: size });
  }
  for (const m of Array.isArray(f.foodMeasures) ? f.foodMeasures : []) {
    const g = Number(m.gramWeight);
    const text = String(m.disseminationText ?? '').trim();
    if (!isFinite(g) || g <= 0 || !text || /quantity not specified/i.test(text)) continue;
    if (servings.some((s) => Math.abs(s.qty - g) < 0.01)) continue;
    servings.push({ label: `${text} (${Math.round(g)} g)`, qty: g });
    if (servings.length >= 6) break;
  }

  const brand = branded ? titleCase(String(f.brandName || f.brandOwner || '').trim()) : '';
  return {
    id: 'usda:' + f.fdcId,
    source: 'usda',
    name: titleCase(String(f.description).trim()),
    brand: brand || undefined,
    barcode: branded && f.gtinUpc ? String(f.gtinUpc) : undefined,
    baseQty: 100,
    baseUnit,
    nutrients,
    servings: withStandardServings(baseUnit, servings),
    updatedAt: Date.now(),
  };
}

async function search(params: Record<string, string>, key: string, signal?: AbortSignal): Promise<Food[]> {
  const qs = new URLSearchParams({ api_key: key, ...params });
  let res: Response;
  try {
    res = await fetch(`${HOST}/foods/search?${qs}`, { signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new LookupError('offline', 'Could not reach the USDA database. Check your connection.');
  }
  if (res.status === 429) throw new LookupError('server', 'USDA search limit reached for this key. Try again later.');
  if (res.status === 403) throw new LookupError('server', 'The USDA key was rejected. Check it in Settings.');
  if (!res.ok) throw new LookupError('server', `USDA search failed (${res.status}).`);
  const data = await res.json();
  if (data?.error) throw new LookupError('server', String(data.error.message ?? 'USDA search failed.'));
  const out: Food[] = [];
  for (const f of Array.isArray(data?.foods) ? data.foods : []) {
    const food = parseUsdaFood(f);
    if (food) out.push(food);
  }
  return out;
}

/** Generic (non-branded) foods matching the query. */
export function searchUsda(query: string, key: string, signal?: AbortSignal): Promise<Food[]> {
  return search({ query, dataType: 'Foundation,SR Legacy,Survey (FNDDS)', pageSize: '20' }, key, signal);
}

/** Branded product with exactly this UPC/EAN, or null. */
export async function fetchUsdaBarcode(barcode: string, key: string, signal?: AbortSignal): Promise<Food | null> {
  const bare = barcode.replace(/^0+/, '');
  const list = await search({ query: barcode, dataType: 'Branded', pageSize: '10' }, key, signal);
  const hit = list.find((f) => f.barcode && f.barcode.replace(/^0+/, '') === bare);
  if (!hit) return null;
  hit.barcode = barcode;
  return hit;
}
