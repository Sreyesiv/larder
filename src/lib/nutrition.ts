// Core nutrition types and arithmetic. Everything else builds on these.

export type NutrientKey =
  | 'calories' | 'fat' | 'satFat' | 'transFat' | 'polyFat' | 'monoFat'
  | 'cholesterol' | 'sodium' | 'carbs' | 'fiber' | 'sugar' | 'addedSugar'
  | 'protein' | 'vitaminD' | 'calcium' | 'iron' | 'potassium' | 'vitaminA' | 'vitaminC';

export type Nutrients = Partial<Record<NutrientKey, number>>;

export interface NutrientDef {
  key: NutrientKey;
  label: string;
  short: string;
  unit: 'kcal' | 'g' | 'mg' | 'µg';
  /** FDA Daily Value for a 2,000 kcal diet; undefined when none is set. */
  dv?: number;
  indent?: 0 | 1 | 2;
  /** Nutrients where the target is a ceiling rather than something to reach. */
  limit?: boolean;
}

// Order follows the US Nutrition Facts label.
export const NUTRIENTS: NutrientDef[] = [
  { key: 'calories', label: 'Calories', short: 'Calories', unit: 'kcal', dv: 2000 },
  { key: 'fat', label: 'Total Fat', short: 'Fat', unit: 'g', dv: 78 },
  { key: 'satFat', label: 'Saturated Fat', short: 'Sat fat', unit: 'g', dv: 20, indent: 1, limit: true },
  { key: 'transFat', label: 'Trans Fat', short: 'Trans fat', unit: 'g', indent: 1, limit: true },
  { key: 'polyFat', label: 'Polyunsaturated Fat', short: 'Poly fat', unit: 'g', indent: 1 },
  { key: 'monoFat', label: 'Monounsaturated Fat', short: 'Mono fat', unit: 'g', indent: 1 },
  { key: 'cholesterol', label: 'Cholesterol', short: 'Cholesterol', unit: 'mg', dv: 300, limit: true },
  { key: 'sodium', label: 'Sodium', short: 'Sodium', unit: 'mg', dv: 2300, limit: true },
  { key: 'carbs', label: 'Total Carbohydrate', short: 'Carbs', unit: 'g', dv: 275 },
  { key: 'fiber', label: 'Dietary Fiber', short: 'Fiber', unit: 'g', dv: 28, indent: 1 },
  { key: 'sugar', label: 'Total Sugars', short: 'Sugar', unit: 'g', indent: 1, limit: true },
  { key: 'addedSugar', label: 'Added Sugars', short: 'Added sugar', unit: 'g', dv: 50, indent: 2, limit: true },
  { key: 'protein', label: 'Protein', short: 'Protein', unit: 'g', dv: 50 },
  { key: 'vitaminD', label: 'Vitamin D', short: 'Vitamin D', unit: 'µg', dv: 20 },
  { key: 'calcium', label: 'Calcium', short: 'Calcium', unit: 'mg', dv: 1300 },
  { key: 'iron', label: 'Iron', short: 'Iron', unit: 'mg', dv: 18 },
  { key: 'potassium', label: 'Potassium', short: 'Potassium', unit: 'mg', dv: 4700 },
  { key: 'vitaminA', label: 'Vitamin A', short: 'Vitamin A', unit: 'µg', dv: 900 },
  { key: 'vitaminC', label: 'Vitamin C', short: 'Vitamin C', unit: 'mg', dv: 90 },
];

export const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n])) as Record<NutrientKey, NutrientDef>;

export type FoodSource = 'off' | 'usda' | 'common' | 'custom' | 'recipe' | 'quick';

export interface Serving {
  label: string;
  /** Size of one serving in the food's base unit (grams, millilitres, or servings). */
  qty: number;
}

export interface Portion {
  food: Food;
  servingLabel: string;
  servingQty: number;
  count: number;
}

export interface Food {
  id: string;
  source: FoodSource;
  name: string;
  brand?: string;
  barcode?: string;
  /** `nutrients` describe this much of the food: e.g. 100 g, 100 ml, or 1 serving. */
  baseQty: number;
  baseUnit: 'g' | 'ml' | 'serving';
  nutrients: Nutrients;
  /** First serving is the default. */
  servings: Serving[];
  /** True when the source had no calorie figure, so the numbers cannot be trusted as-is. */
  incomplete?: boolean;
  /** Recipes: what goes in, and how many servings the batch makes. */
  ingredients?: Portion[];
  yield?: number;
  /** True once the user has corrected a food that came from an online database. */
  edited?: boolean;
  updatedAt?: number;
}

export function scale(n: Nutrients, factor: number): Nutrients {
  const out: Nutrients = {};
  for (const k in n) {
    const v = n[k as NutrientKey];
    if (typeof v === 'number' && isFinite(v)) out[k as NutrientKey] = v * factor;
  }
  return out;
}

export function add(a: Nutrients, b: Nutrients): Nutrients {
  const out: Nutrients = { ...a };
  for (const k in b) {
    const v = b[k as NutrientKey];
    if (typeof v === 'number' && isFinite(v)) out[k as NutrientKey] = (out[k as NutrientKey] ?? 0) + v;
  }
  return out;
}

export function sum(list: Nutrients[]): Nutrients {
  return list.reduce(add, {} as Nutrients);
}

/** Nutrients in `count` servings of `servingQty` base units each. */
export function portionNutrients(p: { food: Food; servingQty: number; count: number }): Nutrients {
  const base = p.food.baseQty > 0 ? p.food.baseQty : 1;
  return scale(p.food.nutrients, (p.servingQty * p.count) / base);
}

/** Share of calories from each macro, using 4/4/9 kcal per gram. Sums to 1 (or all zeros). */
export function macroSplit(n: Nutrients): { carbs: number; fat: number; protein: number } {
  const c = (n.carbs ?? 0) * 4;
  const f = (n.fat ?? 0) * 9;
  const p = (n.protein ?? 0) * 4;
  const total = c + f + p;
  if (total <= 0) return { carbs: 0, fat: 0, protein: 0 };
  return { carbs: c / total, fat: f / total, protein: p / total };
}

export function caloriesFromMacros(carbs: number, protein: number, fat: number): number {
  return carbs * 4 + protein * 4 + fat * 9;
}

/** Display rounding: whole numbers above 10, one decimal below. */
export function fmt(v: number | undefined, digits?: number): string {
  if (v === undefined || !isFinite(v)) return '–';
  const d = digits ?? (Math.abs(v) >= 10 || Number.isInteger(+v.toFixed(1)) ? 0 : 1);
  return v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

export function kcal(v: number | undefined): string {
  if (v === undefined || !isFinite(v)) return '–';
  return Math.round(v).toLocaleString('en-US');
}

// ---------- Energy needs ----------

export interface Profile {
  sex: 'male' | 'female';
  birthYear: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  /** Activity multiplier applied to resting energy use. */
  activity: number;
  /** Target weight change per week in kg; negative to lose. */
  weeklyRateKg: number;
}

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Not very active', hint: 'Mostly sitting: desk job, little exercise' },
  { value: 1.375, label: 'Lightly active', hint: 'On your feet a fair amount, or light exercise 1 to 3 days a week' },
  { value: 1.55, label: 'Active', hint: 'Moderate exercise 3 to 5 days a week' },
  { value: 1.725, label: 'Very active', hint: 'Hard exercise most days, or a physical job' },
];

/** Resting energy use by the Mifflin-St Jeor equation, kcal/day. */
export function bmr(p: Pick<Profile, 'sex' | 'birthYear' | 'heightCm' | 'weightKg'>, year = new Date().getFullYear()): number {
  const age = Math.max(15, year - p.birthYear);
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161);
}

export const KCAL_PER_KG = 7700;

export interface DayGoal {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

/** Daily calorie target for the profile's goal, floored at a commonly used safe minimum. */
export function calorieTarget(p: Profile, year?: number): { maintenance: number; target: number; floored: boolean } {
  const maintenance = bmr(p, year) * p.activity;
  const raw = maintenance + (p.weeklyRateKg * KCAL_PER_KG) / 7;
  const floor = p.sex === 'male' ? 1500 : 1200;
  const target = Math.max(floor, raw);
  return { maintenance: Math.round(maintenance), target: Math.round(target / 10) * 10, floored: raw < floor };
}

export function gramsFromPercent(calories: number, carbsPct: number, proteinPct: number, fatPct: number): DayGoal {
  return {
    calories,
    carbs: Math.round((calories * carbsPct) / 100 / 4),
    protein: Math.round((calories * proteinPct) / 100 / 4),
    fat: Math.round((calories * fatPct) / 100 / 9),
  };
}

export function percentFromGrams(g: DayGoal): { carbs: number; protein: number; fat: number } {
  const total = caloriesFromMacros(g.carbs, g.protein, g.fat);
  if (total <= 0) return { carbs: 0, protein: 0, fat: 0 };
  return {
    carbs: Math.round((g.carbs * 4 * 100) / total),
    protein: Math.round((g.protein * 4 * 100) / total),
    fat: Math.round((g.fat * 9 * 100) / total),
  };
}

// ---------- Serving helpers ----------

/** Standard extra servings offered for any food measured by weight or volume. */
export function withStandardServings(baseUnit: Food['baseUnit'], servings: Serving[]): Serving[] {
  if (baseUnit === 'serving') return servings.length ? servings : [{ label: '1 serving', qty: 1 }];
  const extra: Serving[] =
    baseUnit === 'g'
      ? [{ label: '100 g', qty: 100 }, { label: '1 g', qty: 1 }, { label: '1 oz', qty: 28.35 }]
      : [{ label: '100 ml', qty: 100 }, { label: '1 ml', qty: 1 }, { label: '1 fl oz', qty: 29.57 }, { label: '1 cup (240 ml)', qty: 240 }];
  const out = [...servings];
  for (const e of extra) if (!out.some((s) => Math.abs(s.qty - e.qty) < 0.01)) out.push(e);
  return out;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
