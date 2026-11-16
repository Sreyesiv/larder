// On-device storage (IndexedDB via Dexie). Nothing here ever leaves the browser.

import Dexie, { type Table } from 'dexie';
import { type DayGoal, type Food, type Nutrients, type Portion, type Profile, gramsFromPercent, portionNutrients, sum, uid } from './nutrition';
import { type Units, dayKey, parseDay } from './util';

export interface Entry extends Portion {
  id: string;
  date: string;
  /** Index into settings.mealNames. */
  meal: number;
  createdAt: number;
}

export interface ExerciseEntry {
  id: string;
  date: string;
  name: string;
  kind: 'cardio' | 'strength';
  minutes?: number;
  calories: number;
  sets?: number;
  reps?: number;
  weight?: number;
  createdAt: number;
}

export interface WaterDay { date: string; ml: number }
export interface BodyDay { date: string; weightKg?: number; bodyFatPct?: number; waistCm?: number }
export interface NoteDay { date: string; text: string }
export interface SavedMeal { id: string; name: string; items: Portion[]; updatedAt: number }

export type NutrientGoals = Partial<Record<keyof Nutrients, number>>;

export interface Goals {
  base: DayGoal;
  macroMode: 'percent' | 'grams';
  /** When true, `weekdays[n]` (0 = Sunday) overrides the base goal for that day. */
  byWeekday: boolean;
  weekdays: (DayGoal | null)[];
  nutrients: NutrientGoals;
  waterMl: number;
  /** Add logged exercise calories back to the day's food budget. */
  addExercise: boolean;
}

export interface Settings {
  onboarded: boolean;
  profile: Profile;
  units: Units;
  goals: Goals;
  mealNames: string[];
  usdaKey: string;
  theme: 'system' | 'light' | 'dark';
}

export const DEFAULT_NUTRIENT_GOALS: NutrientGoals = {
  fiber: 28, sugar: 50, satFat: 20, sodium: 2300, cholesterol: 300, potassium: 4700,
  calcium: 1300, iron: 18, vitaminA: 900, vitaminC: 90, vitaminD: 20,
};

export function defaultSettings(): Settings {
  const us = typeof navigator !== 'undefined' && /^en-US/i.test(navigator.language ?? '');
  return {
    onboarded: false,
    profile: { sex: 'female', birthYear: new Date().getFullYear() - 30, heightCm: 168, weightKg: 70, goalWeightKg: 65, activity: 1.375, weeklyRateKg: -0.25 },
    units: us ? { weight: 'lb', height: 'ftin', water: 'floz' } : { weight: 'kg', height: 'cm', water: 'ml' },
    goals: {
      base: gramsFromPercent(2000, 45, 25, 30),
      macroMode: 'percent',
      byWeekday: false,
      weekdays: [null, null, null, null, null, null, null],
      nutrients: { ...DEFAULT_NUTRIENT_GOALS },
      waterMl: 2000,
      addExercise: true,
    },
    mealNames: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
    usdaKey: '',
    theme: 'system',
  };
}

class LarderDB extends Dexie {
  foods!: Table<Food, string>;
  entries!: Table<Entry, string>;
  exercises!: Table<ExerciseEntry, string>;
  water!: Table<WaterDay, string>;
  body!: Table<BodyDay, string>;
  notes!: Table<NoteDay, string>;
  meals!: Table<SavedMeal, string>;
  kv!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('larder');
    this.version(1).stores({
      foods: 'id, source, barcode, updatedAt',
      entries: 'id, date, createdAt',
      exercises: 'id, date',
      water: 'date',
      body: 'date',
      notes: 'date',
      meals: 'id',
      kv: 'key',
    });
  }
}

export const db = new LarderDB();

// ---------- Settings ----------

export async function loadSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  const d = defaultSettings();
  if (!row) return d;
  const s = row.value as Partial<Settings>;
  // Merge over defaults so settings added in later versions always have a value.
  return {
    ...d, ...s,
    profile: { ...d.profile, ...s.profile },
    units: { ...d.units, ...s.units },
    goals: { ...d.goals, ...s.goals, nutrients: { ...d.goals.nutrients, ...s.goals?.nutrients } },
  };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.kv.put({ key: 'settings', value: s });
}

export function goalForDate(goals: Goals, date: string): DayGoal {
  if (goals.byWeekday) {
    const g = goals.weekdays[parseDay(date).getDay()];
    if (g) return g;
  }
  return goals.base;
}

// ---------- Diary ----------

export async function logPortion(p: Portion, date: string, meal: number): Promise<string> {
  const id = uid();
  await db.entries.add({ ...p, id, date, meal, createdAt: Date.now() });
  await rememberFood(p.food);
  return id;
}

/** Keep a copy of any food the user has logged or scanned so it is available offline next time. */
export async function rememberFood(food: Food): Promise<void> {
  if (food.source === 'quick' || food.source === 'common') return;
  const existing = await db.foods.get(food.id);
  // Never overwrite the user's own corrections with a fresh copy from an online database.
  if (existing?.edited && !food.edited) return;
  await db.foods.put({ ...food, updatedAt: Date.now() });
}

export async function findByBarcode(barcode: string): Promise<Food | undefined> {
  const variants = new Set([barcode, barcode.replace(/^0+/, ''), barcode.padStart(13, '0'), barcode.padStart(12, '0')]);
  const hits = await db.foods.where('barcode').anyOf([...variants]).toArray();
  // Prefer the user's own entry over a cached database copy.
  return hits.sort((a, b) => Number(b.source === 'custom' || !!b.edited) - Number(a.source === 'custom' || !!a.edited))[0];
}

export function entryNutrients(e: Portion): Nutrients {
  return portionNutrients(e);
}

export function totals(entries: Portion[]): Nutrients {
  return sum(entries.map(entryNutrients));
}

export async function copyEntries(entries: Entry[], date: string, meal?: number): Promise<void> {
  const now = Date.now();
  await db.entries.bulkAdd(entries.map((e, i) => ({ ...e, id: uid(), date, meal: meal ?? e.meal, createdAt: now + i })));
}

/** Distinct foods from the diary, most recent first, each with the portion last used. */
export async function recentPortions(limit = 30): Promise<Portion[]> {
  const rows = await db.entries.orderBy('createdAt').reverse().limit(400).toArray();
  const seen = new Set<string>();
  const out: Portion[] = [];
  for (const e of rows) {
    if (e.food.source === 'quick' || seen.has(e.food.id)) continue;
    seen.add(e.food.id);
    out.push({ food: e.food, servingLabel: e.servingLabel, servingQty: e.servingQty, count: e.count });
    if (out.length >= limit) break;
  }
  return out;
}

/** Consecutive days up to today (or yesterday) that have at least one food logged. */
export async function loggingStreak(today = dayKey()): Promise<number> {
  const days = new Set((await db.entries.orderBy('date').uniqueKeys()) as string[]);
  let d = parseDay(today);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// ---------- Backup ----------

const TABLES = ['foods', 'entries', 'exercises', 'water', 'body', 'notes', 'meals', 'kv'] as const;

export async function exportAll(): Promise<string> {
  const data: Record<string, unknown> = { app: 'larder', version: 1, exportedAt: new Date().toISOString() };
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  return JSON.stringify(data);
}

/** Replace everything on this device with the contents of a backup file. */
export async function importAll(json: string): Promise<void> {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('That file is not a Larder backup.');
  }
  if (!data || data.app !== 'larder' || !Array.isArray(data.entries)) throw new Error('That file is not a Larder backup.');
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      if (Array.isArray(data[t])) await db.table(t).bulkPut(data[t]);
    }
  });
}

export async function eraseAll(): Promise<void> {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).clear();
  });
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Food diary as a spreadsheet-friendly CSV, one row per logged item. */
export async function exportDiaryCsv(mealNames: string[]): Promise<string> {
  const rows = await db.entries.orderBy('date').toArray();
  const cols: (keyof Nutrients)[] = ['calories', 'carbs', 'fat', 'protein', 'fiber', 'sugar', 'satFat', 'sodium', 'cholesterol', 'potassium'];
  const head = ['Date', 'Meal', 'Food', 'Brand', 'Amount', 'Calories', 'Carbs (g)', 'Fat (g)', 'Protein (g)', 'Fiber (g)', 'Sugar (g)', 'Saturated fat (g)', 'Sodium (mg)', 'Cholesterol (mg)', 'Potassium (mg)'];
  const lines = [head.join(',')];
  for (const e of rows) {
    const n = entryNutrients(e);
    lines.push([
      e.date, mealNames[e.meal] ?? `Meal ${e.meal + 1}`, e.food.name, e.food.brand ?? '', `${e.count} x ${e.servingLabel}`,
      ...cols.map((c) => (n[c] === undefined ? '' : Math.round(n[c]! * 10) / 10)),
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}
