import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProduct } from '../src/lib/off';
import { parseUsdaFood } from '../src/lib/usda';
import { bmr, calorieTarget, gramsFromPercent, macroSplit, percentFromGrams, portionNutrients } from '../src/lib/nutrition';
import { expandUpcE, normalizeBarcode, validCheckDigit } from '../src/lib/scanner';
import { COMMON_FOODS, matchFoods } from '../src/lib/commonFoods';
import { estimateBurn } from '../src/lib/exercise';
import { addDays, daysBetween, parseNum } from '../src/lib/util';

// Fixtures are real Open Food Facts API responses captured during development.
const fx = (code: string) => JSON.parse(readFileSync(new URL(`./fixtures/${code}.json`, import.meta.url), 'utf8')).product;

describe('Open Food Facts parsing', () => {
  it('reads a per-100g product with no serving size (Nutella)', () => {
    const f = parseProduct(fx('3017620422003'))!;
    expect(f.name).toBe('Nutella');
    expect(f.brand).toBe('Ferrero');
    expect(f.baseUnit).toBe('g');
    expect(f.nutrients.calories).toBe(539);
    expect(f.nutrients.fat).toBe(30.9);
    expect(f.nutrients.sugar).toBe(56.3);
    expect(f.nutrients.sodium).toBeCloseTo(42.8, 1); // stored in grams upstream
    expect(f.servings.map((s) => s.label)).toContain('1 package (400 g)');
    expect(f.incomplete).toBeUndefined();
  });

  it('uses the label serving and reproduces the per-serving figures (Cheerios)', () => {
    const f = parseProduct(fx('016000275287'))!;
    expect(f.servings[0]).toEqual({ label: '39g', qty: 39 });
    const n = portionNutrients({ food: f, servingQty: f.servings[0].qty, count: 1 });
    expect(n.calories).toBeCloseTo(140, 0);
    expect(n.carbs).toBeCloseTo(29, 1);
    expect(n.protein).toBeCloseTo(5, 1);
    expect(n.sodium).toBeCloseTo(190, 0);
  });

  it('treats drinks as millilitres (Diet Coke)', () => {
    const f = parseProduct(fx('0049000028911'))!;
    expect(f.baseUnit).toBe('ml');
    expect(f.nutrients.calories).toBe(0);
    expect(f.servings[0].qty).toBeCloseTo(354.9);
    expect(f.servings.some((s) => s.label === '100 ml')).toBe(true);
  });

  it('tidies long decimals in serving labels (Pringles)', () => {
    const f = parseProduct(fx('0038000138416'))!;
    expect(f.servings[0].label).toBe('1 portion (28.3 g)');
    const n = portionNutrients({ food: f, servingQty: f.servings[0].qty, count: 2 });
    expect(n.calories).toBeCloseTo(304, 0);
  });

  it('falls back to per-serving data and flags missing calories', () => {
    const perServing = parseProduct({ code: '1', product_name: 'X', serving_size: '2 pieces', nutriments: { 'energy-kcal_serving': 90, proteins_serving: 3 } })!;
    expect(perServing.baseUnit).toBe('serving');
    expect(perServing.nutrients.calories).toBe(90);
    const kj = parseProduct({ code: '2', product_name: 'Y', nutriments: { 'energy-kj_100g': 418.4, salt_100g: 1 } })!;
    expect(kj.nutrients.calories).toBeCloseTo(100);
    expect(kj.nutrients.sodium).toBeCloseTo(400);
    expect(parseProduct({ code: '3', product_name: 'Z', nutriments: {} })!.incomplete).toBe(true);
    expect(parseProduct({})).toBeNull();
  });
});

describe('USDA parsing', () => {
  it('maps nutrient ids and household measures', () => {
    const f = parseUsdaFood({
      fdcId: 173944, description: 'Bananas, raw', dataType: 'SR Legacy',
      foodNutrients: [
        { nutrientId: 1008, unitName: 'KCAL', value: 89 }, { nutrientId: 1003, value: 1.09 },
        { nutrientId: 1005, value: 22.8 }, { nutrientId: 1004, value: 0.33 }, { nutrientId: 1093, value: 1 },
        { nutrientId: 2047, unitName: 'KCAL', value: 98 },
      ],
      foodMeasures: [{ disseminationText: '1 medium', gramWeight: 118 }],
    })!;
    expect(f.nutrients.calories).toBe(89);
    expect(f.servings[0]).toEqual({ label: '1 medium (118 g)', qty: 118 });
    expect(parseUsdaFood({ fdcId: 1, description: 'No energy', foodNutrients: [] })).toBeNull();
  });
});

describe('barcodes', () => {
  it('validates check digits', () => {
    expect(validCheckDigit('3017620422003')).toBe(true);
    expect(validCheckDigit('3017620422004')).toBe(false);
    expect(validCheckDigit('016000275287')).toBe(true);
    expect(validCheckDigit('12345')).toBe(false);
  });
  it('expands UPC-E', () => {
    expect(expandUpcE('04252614')).toBe('042100005264');
    expect(validCheckDigit(expandUpcE('04252614')!)).toBe(true);
    expect(normalizeBarcode('04252614', 'upc_e')).toBe('042100005264');
    expect(normalizeBarcode(' 3017-6204 22003 ')).toBe('3017620422003');
    expect(normalizeBarcode('hello')).toBeNull();
  });
});

describe('nutrition maths', () => {
  it('computes resting energy and targets', () => {
    const p = { sex: 'male' as const, birthYear: 1996, heightCm: 180, weightKg: 80, goalWeightKg: 75, activity: 1.55, weeklyRateKg: -0.5 };
    expect(bmr(p, 2026)).toBeCloseTo(1780, 0);
    const t = calorieTarget(p, 2026);
    expect(t.maintenance).toBe(2759);
    expect(t.target).toBe(2210);
    expect(calorieTarget({ ...p, sex: 'female', weightKg: 50, heightCm: 155, weeklyRateKg: -1 }, 2026).floored).toBe(true);
  });
  it('converts between macro percent and grams', () => {
    const g = gramsFromPercent(2000, 50, 20, 30);
    expect(g).toEqual({ calories: 2000, carbs: 250, protein: 100, fat: 67 });
    expect(percentFromGrams(g)).toEqual({ carbs: 50, protein: 20, fat: 30 });
    const split = macroSplit({ carbs: 10, protein: 10, fat: 10 });
    expect(split.carbs + split.protein + split.fat).toBeCloseTo(1);
  });
  it('has sane built-in foods', () => {
    expect(COMMON_FOODS.length).toBeGreaterThan(70);
    for (const f of COMMON_FOODS) {
      const n = f.nutrients;
      const fromMacros = n.carbs! * 4 + n.protein! * 4 + n.fat! * 9;
      // Label calories should sit near the 4/4/9 estimate (fiber and alcohol explain the slack).
      if (!/beer|wine|coffee/i.test(f.name)) expect(Math.abs(fromMacros - n.calories!), f.name).toBeLessThan(Math.max(25, n.calories! * 0.2));
      expect(f.servings.length).toBeGreaterThan(1);
    }
    expect(matchFoods(COMMON_FOODS, 'chick breast')[0].name).toMatch(/Chicken breast/);
  });
  it('estimates exercise and parses input', () => {
    expect(estimateBurn(9.8, 70, 30)).toBe(343);
    expect(parseNum('1 1/2')).toBe(1.5);
    expect(parseNum('0,5')).toBe(0.5);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(daysBetween('2026-03-01', '2026-03-08')).toBe(7);
  });
});
