import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db, logPortion, recentPortions, totals, type SavedMeal } from '../lib/db';
import { COMMON_FOODS, matchFoods } from '../lib/commonFoods';
import { kcal, portionNutrients, uid, type Food, type Portion } from '../lib/nutrition';
import { searchProducts } from '../lib/off';
import { searchUsda } from '../lib/usda';
import { mealForNow, parseNum } from '../lib/util';
import { useDepth, useNav, useSettings } from '../ui/ctx';
import { Empty, Field, Icon, NumInput, Page, Segmented, Sheet, useDebounced } from '../ui/kit';
import { FoodDetail, defaultPortion } from './FoodDetail';
import { FoodEditor } from './FoodEditor';
import { PortionListEditor } from './Recipes';
import { Scan } from './Scan';

type Tab = 'all' | 'mine' | 'meals' | 'recipes';
interface Remote { status: 'idle' | 'loading' | 'done' | 'error'; items: Food[]; error?: string; retry?: () => void }
const IDLE: Remote = { status: 'idle', items: [] };

function useRemote(query: string, enabled: boolean, run: (q: string, signal: AbortSignal) => Promise<Food[]>): Remote {
  const [state, setState] = useState<Remote>(IDLE);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || query.length < 3) return setState(IDLE);
    const ctl = new AbortController();
    setState({ status: 'loading', items: [] });
    run(query, ctl.signal)
      .then((items) => setState({ status: 'done', items }))
      .catch((e) => { if (e?.name !== 'AbortError') setState({ status: 'error', items: [], error: e?.message ?? 'Search failed.' }); });
    return () => ctl.abort();
    // `run` is recreated every render; the query and flag are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, enabled, attempt]);
  return state.status === 'error' ? { ...state, retry: () => setAttempt((n) => n + 1) } : state;
}

export function AddFood({ date, meal, onPick, title }: { date: string; meal?: number; onPick?: (p: Portion) => void; title?: string }) {
  const nav = useNav();
  const depth = useDepth();
  const { settings } = useSettings();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [mealIdx, setMealIdx] = useState(meal ?? mealForNow(settings.mealNames.length));
  const query = q.trim();
  const slowQuery = useDebounced(query, 650);

  const recents = useLiveQuery(() => recentPortions(40), []) ?? [];
  const saved = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const meals = useLiveQuery(() => db.meals.toArray(), []) ?? [];
  const online = tab === 'all' && typeof navigator !== 'undefined' && navigator.onLine !== false;
  const off = useRemote(slowQuery, online, searchProducts);
  const usda = useRemote(slowQuery, online && !!settings.usdaKey, (s, signal) => searchUsda(s, settings.usdaKey, signal));

  // In pick mode the choice goes back to whoever opened this page, and every page above it closes.
  const pick = useMemo(() => (onPick ? (p: Portion) => { onPick(p); nav.popTo(depth - 1); } : undefined), [onPick, nav, depth]);

  const open = (p: Portion) => nav.push(<FoodDetail food={p.food} initial={p} date={date} meal={mealIdx} onPick={pick} />);
  const quick = async (p: Portion) => {
    if (pick) return pick(p);
    await logPortion(p, date, mealIdx);
    nav.toast(`${p.food.name} added to ${settings.mealNames[mealIdx]}`);
  };

  const mine = saved.filter((f) => f.source === 'custom' || f.edited);
  const recipes = saved.filter((f) => f.source === 'recipe');

  const local = useMemo(() => {
    if (!query) return [];
    const byId = new Map<string, Portion>();
    for (const p of recents) byId.set(p.food.id, p);
    for (const f of saved) if (!byId.has(f.id)) byId.set(f.id, defaultPortion(f));
    return matchFoods([...byId.values()].map((p) => ({ ...p, name: p.food.name, brand: p.food.brand })), query, 12);
  }, [query, recents, saved]);
  const localIds = new Set(local.map((p) => p.food.id));
  const common = query ? matchFoods(COMMON_FOODS, query, 8).filter((f) => !localIds.has(f.id)).map(defaultPortion) : [];

  return (
    <Page title={title ?? 'Add food'}
      action={!onPick && (
        <select id="af-meal" aria-label="Meal" value={mealIdx} onChange={(e) => setMealIdx(Number(e.target.value))} style={{ minHeight: 36, padding: '4px 30px 4px 10px', width: 'auto', fontWeight: 650 }}>
          {settings.mealNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      )}>
      <div className="searchbar">
        <div className="searchbox">
          <Icon name="search" size={18} />
          <input id="af-search" type="search" placeholder="Search foods" aria-label="Search foods" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
        </div>
        <button className="icon-btn accent" aria-label="Scan a barcode" onClick={() => nav.push(<Scan date={date} meal={mealIdx} onPick={pick} />)}><Icon name="scan" /></button>
      </div>
      <Segmented label="Show" value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'mine', label: 'My foods' }, { value: 'meals', label: 'Meals' }, { value: 'recipes', label: 'Recipes' }]} />

      {tab === 'all' && !query && (
        <>
          {!onPick && <button className="btn ghost" onClick={() => nav.push(<QuickAdd date={date} meal={mealIdx} />)}><Icon name="bolt" size={18} />Quick add calories</button>}
          {recents.length > 0 ? (
            <Group label="Recent"><Rows items={recents} open={open} quick={quick} /></Group>
          ) : (
            <Empty icon="search" title="Find your first food">Search by name, or tap the scan button to read a barcode. Foods you log show up here for one-tap adding.</Empty>
          )}
        </>
      )}

      {tab === 'all' && query && (
        <>
          {local.length > 0 && <Group label="Your foods"><Rows items={local} open={open} quick={quick} /></Group>}
          {common.length > 0 && <Group label="Common foods"><Rows items={common} open={open} quick={quick} /></Group>}
          {settings.usdaKey && <RemoteGroup label="USDA" state={usda} open={open} quick={quick} skip={localIds} />}
          <RemoteGroup label="Packaged products" state={off} open={open} quick={quick} skip={localIds} />
          {query.length < 3 && local.length + common.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>Keep typing to search packaged products.</p>}
          {!online && <p className="muted" style={{ textAlign: 'center' }}>You are offline, so only foods saved on this device are shown.</p>}
          <button className="btn outline" onClick={() => nav.push(<FoodEditor />)}><Icon name="plus" size={18} />Create “{query}” as a new food</button>
        </>
      )}

      {tab === 'mine' && (
        <>
          {filterList(mine, query).length > 0
            ? <Group label="My foods"><Rows items={filterList(mine, query).map(defaultPortion)} open={open} quick={quick} /></Group>
            : <Empty icon="edit" title={query ? 'No foods match' : 'No foods of your own yet'}>Foods you create or correct are kept here.</Empty>}
          <button className="btn outline" onClick={() => nav.push(<FoodEditor />)}><Icon name="plus" size={18} />Create a food</button>
        </>
      )}

      {tab === 'recipes' && (
        <>
          {filterList(recipes, query).length > 0
            ? <Group label="Recipes"><Rows items={filterList(recipes, query).map(defaultPortion)} open={open} quick={quick} /></Group>
            : <Empty icon="pot" title={query ? 'No recipes match' : 'No recipes yet'}>Combine ingredients once and log a serving with full nutrition any time.</Empty>}
          <button className="btn outline" onClick={() => nav.push(<PortionListEditor kind="recipe" />)}><Icon name="plus" size={18} />Create a recipe</button>
        </>
      )}

      {tab === 'meals' && (
        <>
          {filterList(meals, query).length > 0 ? (
            <Group label="Saved meals">
              <div className="list">
                {filterList(meals, query).map((m) => (
                  <button className="item" key={m.id} onClick={() => nav.push(<MealSheet meal={m} date={date} mealIdx={mealIdx} onPickAll={onPick ? (items) => { items.forEach(onPick); nav.popTo(depth - 1); } : undefined} />)}>
                    <span className="grow"><span className="t">{m.name}</span><span className="s">{m.items.map((i) => i.food.name).join(', ')}</span></span>
                    <span className="v">{kcal(totals(m.items).calories)}<small>kcal</small></span>
                  </button>
                ))}
              </div>
            </Group>
          ) : <Empty icon="copy" title={query ? 'No meals match' : 'No saved meals yet'}>Save a group of foods you often eat together, then log them all in one tap.</Empty>}
          <button className="btn outline" onClick={() => nav.push(<PortionListEditor kind="meal" />)}><Icon name="plus" size={18} />Create a meal</button>
        </>
      )}
    </Page>
  );
}

function filterList<T extends { name: string; brand?: string }>(list: T[], query: string): T[] {
  return query ? matchFoods(list, query, 50) : [...list].sort((a, b) => a.name.localeCompare(b.name));
}

function Group({ label, children, busy }: { label: string; children: React.ReactNode; busy?: boolean }) {
  return (
    <section className="stack tight">
      <div className="group-label"><span>{label}</span>{busy && <span className="spinner" aria-label="Searching" />}</div>
      {children}
    </section>
  );
}

function RemoteGroup({ label, state, open, quick, skip }: { label: string; state: Remote; open: (p: Portion) => void; quick: (p: Portion) => void; skip: Set<string> }) {
  if (state.status === 'idle') return null;
  const items = state.items.filter((f) => !skip.has(f.id)).map(defaultPortion);
  return (
    <Group label={label} busy={state.status === 'loading'}>
      {state.status === 'error' && (
        <div className="banner" role="alert">
          <Icon name="info" size={20} />
          <div className="grow">{state.error}<div style={{ marginTop: 8 }}><button className="btn small" onClick={state.retry}>Search again</button></div></div>
        </div>
      )}
      {state.status === 'done' && items.length === 0 && <p className="muted">No matches.</p>}
      {items.length > 0 && <Rows items={items} open={open} quick={quick} />}
    </Group>
  );
}

function Rows({ items, open, quick }: { items: Portion[]; open: (p: Portion) => void; quick: (p: Portion) => void }) {
  return (
    <div className="list">
      {items.map((p) => (
        <div className="item" key={p.food.id}>
          <button className="grow" style={{ textAlign: 'left' }} onClick={() => open(p)}>
            <span className="t">{p.food.name}</span>
            <span className="s">{[p.food.brand, `${p.count === 1 ? '' : p.count + ' × '}${p.servingLabel}`].filter(Boolean).join(' · ')}</span>
          </button>
          <span className="v">{kcal(portionNutrients(p).calories)}<small>kcal</small></span>
          <button className="add-quick" aria-label={`Add ${p.food.name}`} onClick={() => quick(p)}><Icon name="plus" size={18} /></button>
        </div>
      ))}
    </div>
  );
}

function MealSheet({ meal, date, mealIdx, onPickAll }: { meal: SavedMeal; date: string; mealIdx: number; onPickAll?: (items: Portion[]) => void }) {
  const nav = useNav();
  const { settings } = useSettings();
  const addAll = async () => {
    if (onPickAll) return onPickAll(meal.items);
    for (const p of meal.items) await logPortion(p, date, mealIdx);
    nav.toast(`${meal.name} added to ${settings.mealNames[mealIdx]}`);
    nav.pop();
  };
  return (
    <Sheet title={meal.name}>
      <div className="list">
        {meal.items.map((p, i) => (
          <div className="item" key={i}>
            <span className="grow"><span className="t">{p.food.name}</span><span className="s">{p.count} × {p.servingLabel}</span></span>
            <span className="v">{kcal(portionNutrients(p).calories)}<small>kcal</small></span>
          </div>
        ))}
      </div>
      <button className="btn" disabled={!meal.items.length} onClick={addAll}>{onPickAll ? 'Add all items' : `Add all to ${settings.mealNames[mealIdx]}`} · {kcal(totals(meal.items).calories)} kcal</button>
      <button className="btn ghost" onClick={() => nav.replace(<PortionListEditor kind="meal" meal={meal} />)}>Edit meal</button>
    </Sheet>
  );
}

function QuickAdd({ date, meal }: { date: string; meal: number }) {
  const nav = useNav();
  const { settings } = useSettings();
  const [v, setV] = useState({ name: '', calories: '', carbs: '', fat: '', protein: '' });
  const set = (k: keyof typeof v) => (val: string) => setV((o) => ({ ...o, [k]: val }));
  const calories = parseNum(v.calories);
  const save = async () => {
    const num = (s: string) => { const n = parseNum(s); return isFinite(n) && n >= 0 ? n : undefined; };
    const food: Food = {
      id: 'quick:' + uid(), source: 'quick', name: v.name.trim() || 'Quick add', baseQty: 1, baseUnit: 'serving',
      nutrients: { calories, carbs: num(v.carbs), fat: num(v.fat), protein: num(v.protein) },
      servings: [{ label: '1 serving', qty: 1 }],
    };
    await logPortion(defaultPortion(food), date, meal);
    nav.toast(`Added to ${settings.mealNames[meal]}`);
    nav.pop();
  };
  return (
    <Sheet title="Quick add">
      <Field label="Calories"><NumInput id="qa-cal" value={v.calories} onChange={set('calories')} suffix="kcal" autoFocus /></Field>
      <div className="grid3">
        <Field label="Carbs"><NumInput id="qa-carbs" value={v.carbs} onChange={set('carbs')} suffix="g" /></Field>
        <Field label="Fat"><NumInput id="qa-fat" value={v.fat} onChange={set('fat')} suffix="g" /></Field>
        <Field label="Protein"><NumInput id="qa-protein" value={v.protein} onChange={set('protein')} suffix="g" /></Field>
      </div>
      <Field label="Label (optional)"><input id="qa-name" type="text" value={v.name} onChange={(e) => set('name')(e.target.value)} placeholder="e.g. Restaurant lunch" /></Field>
      <button className="btn" disabled={!(calories >= 0) || !isFinite(calories)} onClick={save}>Add to {settings.mealNames[meal]}</button>
    </Sheet>
  );
}
