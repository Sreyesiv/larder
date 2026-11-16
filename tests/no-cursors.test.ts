// iPhone Safari can refuse IndexedDB cursors ("UnknownError: Unable to open cursor").
// These tests run the storage layer with cursors disabled, the way that browser behaves,
// so a query that quietly needs one fails here instead of on someone's phone.
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';

function forbidCursors() {
  const refuse = () => { throw new DOMException('Unable to open cursor', 'UnknownError'); };
  for (const proto of [IDBObjectStore.prototype, IDBIndex.prototype] as any[]) {
    proto.openCursor = refuse;
    proto.openKeyCursor = refuse;
    // Newer engines can read in reverse without a cursor; Safari 17 cannot, so hide that too.
    delete proto.getAllRecords;
  }
}

const food = (id: string, name: string, calories: number, barcode?: string) => ({
  id, source: 'custom' as const, name, barcode, baseQty: 1, baseUnit: 'serving' as const,
  nutrients: { calories, protein: 5 }, servings: [{ label: '1 serving', qty: 1 }],
});
const portion = (f: ReturnType<typeof food>, count = 1) => ({ food: f, servingLabel: '1 serving', servingQty: 1, count });

describe('storage without cursors', () => {
  let m: typeof import('../src/lib/db');
  beforeAll(async () => {
    forbidCursors();
    m = await import('../src/lib/db');
  });

  it('saves and loads settings', async () => {
    const s = await m.loadSettings();
    await m.saveSettings({ ...s, onboarded: true, usdaKey: 'abc' });
    expect((await m.loadSettings()).usdaKey).toBe('abc');
  });

  it('logs food and reads a day back in order', async () => {
    await m.logPortion(portion(food('custom:oats', 'Oats', 150)), '2026-03-10', 0);
    await m.logPortion(portion(food('custom:bar', 'Bar', 200, '0016000275287'), 2), '2026-03-10', 1);
    await m.logPortion(portion(food('custom:oats', 'Oats', 150)), '2026-03-09', 0);
    await m.logPortion(portion(food('custom:oats', 'Oats', 150)), '2026-03-07', 0);
    const day = await m.db.entries.where('date').equals('2026-03-10').sortBy('createdAt');
    expect(day.map((e) => e.food.name)).toEqual(['Oats', 'Bar']);
    expect(m.totals(day).calories).toBe(550);
    const range = await m.db.entries.where('date').between('2026-03-08', '2026-03-10', true, true).toArray();
    expect(range).toHaveLength(3);
  });

  it('counts streaks and logged days', async () => {
    expect(await m.loggingStreak('2026-03-10')).toBe(2);
    expect(await m.loggingStreak('2026-03-11')).toBe(2); // nothing yet today, streak still stands
    expect(await m.loggingStreak('2026-03-13')).toBe(0);
    expect(await m.loggedDayCount()).toBe(3);
  });

  it('lists recent foods newest first without duplicates', async () => {
    const recent = await m.recentPortions(10, '2026-03-10');
    expect(recent.map((p) => p.food.name)).toEqual(['Oats', 'Bar']);
    expect(await m.recentPortions(10, '2027-03-10')).toEqual([]);
  });

  it('finds a saved product by barcode, with or without leading zeros', async () => {
    expect((await m.findByBarcode('016000275287'))?.name).toBe('Bar');
    expect((await m.findByBarcode('0016000275287'))?.name).toBe('Bar');
    expect(await m.findByBarcode('3017620422003')).toBeUndefined();
  });

  it('reads weight history oldest first', async () => {
    await m.db.body.put({ date: '2026-03-10', weightKg: 80 });
    await m.db.body.put({ date: '2026-03-01', weightKg: 82 });
    await m.db.body.put({ date: '2026-03-12', bodyFatPct: 20 });
    expect((await m.bodyHistory()).map((b) => b.date)).toEqual(['2026-03-01', '2026-03-10', '2026-03-12']);
    expect((await m.latestWeight())?.weightKg).toBe(80);
  });

  it('copies entries, tracks water, and edits or deletes rows', async () => {
    const day = await m.db.entries.where('date').equals('2026-03-10').toArray();
    await m.copyEntries(day, '2026-03-11');
    expect(await m.db.entries.where('date').equals('2026-03-11').count()).toBe(2);
    await m.db.water.put({ date: '2026-03-10', ml: 500 });
    expect((await m.db.water.get('2026-03-10'))?.ml).toBe(500);
    await m.db.entries.put({ ...day[0], count: 3 });
    await m.db.entries.bulkDelete([day[1].id]);
    await m.db.notes.put({ date: '2026-03-10', text: 'ok' });
    await m.db.notes.delete('2026-03-10');
    expect(await m.db.entries.where('date').equals('2026-03-10').count()).toBe(1);
  });

  it('exports, erases and restores everything', async () => {
    const csv = await m.exportDiaryCsv(['Breakfast', 'Lunch']);
    expect(csv.split('\n')).toHaveLength(6);
    const backup = await m.exportAll();
    await m.eraseAll();
    expect(await m.db.entries.count()).toBe(0);
    await m.importAll(backup);
    expect(await m.db.entries.count()).toBe(5);
    expect((await m.loadSettings()).usdaKey).toBe('abc');
    await expect(m.importAll('not json')).rejects.toThrow(/not a Larder backup/);
  });
});
