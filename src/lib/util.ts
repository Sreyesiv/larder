// Dates are handled as local-calendar 'YYYY-MM-DD' strings so a diary day never shifts with time zones.

export function dayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);
}

/** Inclusive list of day keys ending at `end`. */
export function lastDays(end: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(end, i - count + 1));
}

export function dayLabel(key: string, today = dayKey()): string {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key === addDays(today, 1)) return 'Tomorrow';
  return parseDay(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function shortDate(key: string): string {
  return parseDay(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------- Units ----------

export const LB_PER_KG = 2.20462;
export const ML_PER_FLOZ = 29.5735;

export interface Units {
  weight: 'lb' | 'kg';
  height: 'ftin' | 'cm';
  water: 'floz' | 'ml';
}

export function toDisplayWeight(kg: number, u: Units): number {
  return u.weight === 'lb' ? kg * LB_PER_KG : kg;
}
export function fromDisplayWeight(v: number, u: Units): number {
  return u.weight === 'lb' ? v / LB_PER_KG : v;
}
export function weightText(kg: number | undefined, u: Units, digits = 1): string {
  if (kg === undefined || !isFinite(kg)) return '–';
  return `${toDisplayWeight(kg, u).toFixed(digits)} ${u.weight}`;
}
export function waterText(ml: number, u: Units): string {
  return u.water === 'floz' ? `${Math.round(ml / ML_PER_FLOZ)} fl oz` : `${Math.round(ml)} ml`;
}
export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const total = Math.round(cm / 2.54);
  return { ft: Math.floor(total / 12), inch: total % 12 };
}
export function ftInToCm(ft: number, inch: number): number {
  return (ft * 12 + inch) * 2.54;
}

/** Parse a user-typed number; accepts a comma decimal and simple fractions like "1/2" or "1 1/2". */
export function parseNum(s: string): number {
  const t = s.trim().replace(',', '.');
  if (!t) return NaN;
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return +mixed[1] + +mixed[2] / +mixed[3];
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return +frac[1] / +frac[2];
  const n = Number(t);
  return isFinite(n) ? n : NaN;
}

/** Guess the meal from the time of day so the common case needs no extra tap. */
export function mealForNow(mealCount: number): number {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const guess = h < 10.5 ? 0 : h < 15 ? 1 : h < 21 ? 2 : 3;
  return Math.max(0, Math.min(guess, mealCount - 1));
}
