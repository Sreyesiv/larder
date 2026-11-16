import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ReactNode } from 'react';
import { DEFAULT_NUTRIENT_GOALS, db, eraseAll, exportAll, exportDiaryCsv, importAll, totals, type Goals } from '../lib/db';
import { ACTIVITY_LEVELS, NUTRIENT_BY_KEY, calorieTarget, caloriesFromMacros, gramsFromPercent, kcal, percentFromGrams, type DayGoal, type NutrientKey, type Profile } from '../lib/nutrition';
import { ML_PER_FLOZ, WEEKDAYS, dayKey, parseNum, type Units } from '../lib/util';
import { useNav, useSettings } from '../ui/ctx';
import { Confirm, Empty, Field, Icon, NumInput, Page, Segmented, Toggle } from '../ui/kit';
import { defaultPortion, FoodDetail } from './FoodDetail';
import { FoodEditor } from './FoodEditor';
import { BodyFields, PACES, paceLabel, useBodyForm } from './Onboarding';
import { PortionListEditor } from './Recipes';

export function More() {
  const nav = useNav();
  const items: { icon: string; title: string; sub: string; node: ReactNode }[] = [
    { icon: 'target', title: 'Goals', sub: 'Calories, macros by gram or percent, goals by day', node: <GoalsPage /> },
    { icon: 'user', title: 'Profile and units', sub: 'Body details, activity level, lb or kg', node: <ProfilePage /> },
    { icon: 'edit', title: 'My foods', sub: 'Foods you created or corrected', node: <LibraryPage kind="foods" /> },
    { icon: 'pot', title: 'Recipes', sub: 'Per-serving nutrition from ingredients', node: <LibraryPage kind="recipes" /> },
    { icon: 'copy', title: 'Saved meals', sub: 'Foods you log together', node: <LibraryPage kind="meals" /> },
    { icon: 'book', title: 'Meal names', sub: 'Rename, add or remove diary sections', node: <MealNamesPage /> },
    { icon: 'search', title: 'Food databases', sub: 'Where nutrition data comes from, USDA key', node: <DatabasesPage /> },
    { icon: 'save', title: 'Backup and data', sub: 'Export, import, erase', node: <DataPage /> },
  ];
  return (
    <div className="stack">
      <div className="tab-head"><h1>More</h1></div>
      <div className="list">
        {items.map((it) => (
          <button className="item" key={it.title} onClick={() => nav.push(it.node)}>
            <span className="item-icon"><Icon name={it.icon} size={20} /></span>
            <span className="grow"><span className="t">{it.title}</span><span className="s">{it.sub}</span></span>
            <Icon name="right" size={18} />
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', padding: '0 12px' }}>
        Larder keeps your diary on this device only. Calorie targets and nutrition figures are estimates for general tracking, not medical advice.
      </p>
    </div>
  );
}

// ---------- Goals ----------

function MacroEditor({ goal, mode, onChange, idp }: { goal: DayGoal; mode: Goals['macroMode']; onChange: (g: DayGoal) => void; idp: string }) {
  const pct = percentFromGrams(goal);
  const [v, setV] = useState(() => ({
    calories: String(goal.calories),
    carbs: String(mode === 'percent' ? pct.carbs : goal.carbs),
    protein: String(mode === 'percent' ? pct.protein : goal.protein),
    fat: String(mode === 'percent' ? pct.fat : goal.fat),
  }));
  const nums = { calories: parseNum(v.calories), carbs: parseNum(v.carbs), protein: parseNum(v.protein), fat: parseNum(v.fat) };
  const allValid = Object.values(nums).every((n) => isFinite(n) && n >= 0) && nums.calories > 0;
  const pctSum = nums.carbs + nums.protein + nums.fat;
  const gramCals = caloriesFromMacros(nums.carbs, nums.protein, nums.fat);

  const set = (k: keyof typeof v) => (val: string) => {
    const next = { ...v, [k]: val };
    setV(next);
    const n = { calories: parseNum(next.calories), carbs: parseNum(next.carbs), protein: parseNum(next.protein), fat: parseNum(next.fat) };
    if (!Object.values(n).every((x) => isFinite(x) && x >= 0) || !(n.calories > 0)) return;
    if (mode === 'percent') {
      if (Math.round(n.carbs + n.protein + n.fat) === 100) onChange(gramsFromPercent(Math.round(n.calories), n.carbs, n.protein, n.fat));
    } else {
      onChange({ calories: Math.round(n.calories), carbs: Math.round(n.carbs), protein: Math.round(n.protein), fat: Math.round(n.fat) });
    }
  };
  const unit = mode === 'percent' ? '%' : 'g';
  const hint = (k: 'carbs' | 'protein' | 'fat') =>
    mode === 'percent' ? `${goal[k]} g` : `${gramCals > 0 ? Math.round((nums[k] * (k === 'fat' ? 9 : 4) * 100) / gramCals) : 0}%`;

  return (
    <div className="stack">
      <Field label="Calories"><NumInput id={`${idp}-cal`} value={v.calories} onChange={set('calories')} suffix="kcal" /></Field>
      <div className="grid3">
        <Field label="Carbs" hint={hint('carbs')}><NumInput id={`${idp}-carbs`} value={v.carbs} onChange={set('carbs')} suffix={unit} /></Field>
        <Field label="Fat" hint={hint('fat')}><NumInput id={`${idp}-fat`} value={v.fat} onChange={set('fat')} suffix={unit} /></Field>
        <Field label="Protein" hint={hint('protein')}><NumInput id={`${idp}-protein`} value={v.protein} onChange={set('protein')} suffix={unit} /></Field>
      </div>
      {allValid && mode === 'percent' && Math.round(pctSum) !== 100 && <span className="over" role="alert" style={{ fontSize: 13 }}>Percentages add up to {Math.round(pctSum)}%. They need to total 100% before the change is saved.</span>}
      {allValid && mode === 'grams' && Math.abs(gramCals - nums.calories) > 50 && (
        <span className="muted" style={{ fontSize: 13 }}>These grams come to {kcal(gramCals)} kcal, {kcal(Math.abs(gramCals - nums.calories))} {gramCals > nums.calories ? 'more' : 'less'} than the calorie goal.</span>
      )}
      {!allValid && <span className="over" role="alert" style={{ fontSize: 13 }}>Enter a number in every box.</span>}
    </div>
  );
}

const NUTRIENT_GOAL_KEYS = Object.keys(DEFAULT_NUTRIENT_GOALS) as NutrientKey[];

function GoalsPage() {
  const { settings, update } = useSettings();
  const g = settings.goals;
  const setGoals = (fn: (g: Goals) => Goals) => update((s) => ({ ...s, goals: fn(s.goals) }));
  const [day, setDay] = useState(new Date().getDay());
  const floz = settings.units.water === 'floz';
  const [water, setWater] = useState(String(Math.round(floz ? g.waterMl / ML_PER_FLOZ : g.waterMl)));
  const [nut, setNut] = useState<Record<string, string>>(() => Object.fromEntries(NUTRIENT_GOAL_KEYS.map((k) => [k, String(g.nutrients[k] ?? '')])));
  const suggestion = calorieTarget(settings.profile);

  return (
    <Page title="Goals">
      <div className="card stack">
        <div className="card-head" style={{ marginBottom: 0 }}><h2>Daily goal</h2></div>
        <Segmented label="Set macros by" value={g.macroMode} onChange={(m) => setGoals((x) => ({ ...x, macroMode: m }))}
          options={[{ value: 'percent', label: 'Percent of calories' }, { value: 'grams', label: 'Grams' }]} />
        <MacroEditor key={`base-${g.macroMode}`} idp="g-base" goal={g.base} mode={g.macroMode} onChange={(base) => setGoals((x) => ({ ...x, base }))} />
        <p className="muted" style={{ fontSize: 13 }}>
          From your profile, {kcal(suggestion.target)} kcal a day fits your weight goal ({kcal(suggestion.maintenance)} to maintain).
        </p>
      </div>

      <div className="card stack">
        <Toggle label="Different goals on different days" checked={g.byWeekday} onChange={(v) => setGoals((x) => ({ ...x, byWeekday: v }))} />
        {g.byWeekday && (
          <>
            <Segmented label="Day of week" value={day} onChange={setDay} options={WEEKDAYS.map((w, i) => ({ value: i, label: w.slice(0, 2) }))} />
            {g.weekdays[day] ? (
              <>
                <MacroEditor key={`d${day}-${g.macroMode}`} idp={`g-d${day}`} goal={g.weekdays[day]!} mode={g.macroMode}
                  onChange={(dg) => setGoals((x) => ({ ...x, weekdays: x.weekdays.map((w, i) => (i === day ? dg : w)) }))} />
                <button className="btn ghost" onClick={() => setGoals((x) => ({ ...x, weekdays: x.weekdays.map((w, i) => (i === day ? null : w)) }))}>Use the daily goal on {WEEKDAYS[day]}s</button>
              </>
            ) : (
              <>
                <p className="muted">{WEEKDAYS[day]}s use the daily goal: {kcal(g.base.calories)} kcal.</p>
                <button className="btn outline" onClick={() => setGoals((x) => ({ ...x, weekdays: x.weekdays.map((w, i) => (i === day ? { ...x.base } : w)) }))}>Set a separate goal for {WEEKDAYS[day]}s</button>
              </>
            )}
          </>
        )}
      </div>

      <div className="card stack">
        <Toggle label="Add exercise calories to my food budget" checked={g.addExercise} onChange={(v) => setGoals((x) => ({ ...x, addExercise: v }))} />
        <Field label="Water goal">
          <NumInput id="g-water" value={water} suffix={floz ? 'fl oz' : 'ml'} onChange={(val) => {
            setWater(val);
            const n = parseNum(val);
            if (n > 0) setGoals((x) => ({ ...x, waterMl: Math.round(floz ? n * ML_PER_FLOZ : n) }));
          }} />
        </Field>
      </div>

      <div className="card stack tight">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h2>Other nutrients</h2>
          <button className="link" onClick={() => { setNut(Object.fromEntries(NUTRIENT_GOAL_KEYS.map((k) => [k, String(DEFAULT_NUTRIENT_GOALS[k])]))); setGoals((x) => ({ ...x, nutrients: { ...DEFAULT_NUTRIENT_GOALS } })); }}>Reset</button>
        </div>
        {NUTRIENT_GOAL_KEYS.map((k) => {
          const def = NUTRIENT_BY_KEY[k];
          return (
            <div className="row between" key={k}>
              <label htmlFor={`g-n-${k}`}>{def.short}{def.limit && <span className="muted"> (limit)</span>}</label>
              <span style={{ width: 132 }}>
                <NumInput id={`g-n-${k}`} value={nut[k]} suffix={def.unit} onChange={(val) => {
                  setNut((o) => ({ ...o, [k]: val }));
                  const n = parseNum(val);
                  if (n > 0) setGoals((x) => ({ ...x, nutrients: { ...x.nutrients, [k]: n } }));
                }} />
              </span>
            </div>
          );
        })}
        <p className="muted" style={{ fontSize: 12 }}>Defaults are the US Daily Values for a 2,000 calorie diet. Changes save as you type.</p>
      </div>
    </Page>
  );
}

// ---------- Profile ----------

function ProfilePage() {
  const { settings, update } = useSettings();
  const nav = useNav();
  const p = settings.profile;
  const [units, setUnits] = useState<Units>(settings.units);
  const [sex, setSex] = useState(p.sex);
  const [activity, setActivity] = useState(p.activity);
  const [pace, setPace] = useState(Math.abs(p.weeklyRateKg) || 0.5);
  const form = useBodyForm(p, units);
  const diff = form.values.goalWeightKg - form.values.weightKg;
  const direction = Math.abs(diff) < 0.5 ? 0 : Math.sign(diff);
  const profile: Profile = { sex, activity, ...form.values, weeklyRateKg: direction * pace };
  const target = form.valid ? calorieTarget(profile) : null;

  const save = (applyTarget: boolean) => {
    if (!form.valid || !target) return;
    update((s) => {
      const pct = percentFromGrams(s.goals.base);
      const base = applyTarget ? gramsFromPercent(target.target, pct.carbs, pct.protein, pct.fat) : s.goals.base;
      return { ...s, units, profile, goals: { ...s.goals, base } };
    });
    nav.toast(applyTarget ? `Saved. Daily goal is now ${kcal(target.target)} kcal` : 'Profile saved');
    nav.pop();
  };

  return (
    <Page title="Profile and units" footer={<button className="btn" disabled={!form.valid} onClick={() => save(false)}>Save</button>}>
      <div className="card stack">
        <h2>Units</h2>
        <Field label="Weight"><Segmented label="Weight unit" value={units.weight} onChange={(w) => { const to = { ...units, weight: w }; form.convert(to); setUnits(to); }} options={[{ value: 'lb', label: 'Pounds' }, { value: 'kg', label: 'Kilograms' }]} /></Field>
        <Field label="Height"><Segmented label="Height unit" value={units.height} onChange={(h) => { const to = { ...units, height: h }; form.convert(to); setUnits(to); }} options={[{ value: 'ftin', label: 'Feet and inches' }, { value: 'cm', label: 'Centimetres' }]} /></Field>
        <Field label="Water"><Segmented label="Water unit" value={units.water} onChange={(w) => setUnits({ ...units, water: w })} options={[{ value: 'floz', label: 'Fluid ounces' }, { value: 'ml', label: 'Millilitres' }]} /></Field>
      </div>
      <div className="card stack">
        <h2>About you</h2>
        <Field label="Sex, for the energy estimate"><Segmented label="Sex" value={sex} onChange={setSex} options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]} /></Field>
        <BodyFields form={form} units={units} idp="pf" />
        <Field label="Activity level">
          <select id="pf-activity" value={activity} onChange={(e) => setActivity(Number(e.target.value))}>
            {ACTIVITY_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </Field>
        {direction !== 0 && (
          <Field label={direction < 0 ? 'Weekly loss' : 'Weekly gain'}>
            <Segmented label="Weekly pace" value={pace} onChange={setPace} options={PACES.map((x) => ({ value: x, label: paceLabel(x, units) }))} />
          </Field>
        )}
      </div>
      {target && (
        <div className="card stack">
          <h2>Suggested calories</h2>
          <p><span className="num" style={{ fontSize: 28, fontWeight: 700 }}>{kcal(target.target)}</span> <span className="muted">kcal a day · {kcal(target.maintenance)} to maintain</span></p>
          {target.floored && <p className="muted" style={{ fontSize: 13 }}>That pace would go below a commonly recommended minimum, so the suggestion stops there.</p>}
          {target.target !== settings.goals.base.calories && <button className="btn outline" onClick={() => save(true)}>Save and use {kcal(target.target)} kcal as my goal</button>}
        </div>
      )}
      <div className="card stack">
        <h2>Appearance</h2>
        <Segmented label="Theme" value={settings.theme} onChange={(theme) => update((s) => ({ ...s, theme }))} options={[{ value: 'system', label: 'Match device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </div>
    </Page>
  );
}

// ---------- Library: foods, recipes, meals ----------

function LibraryPage({ kind }: { kind: 'foods' | 'recipes' | 'meals' }) {
  const nav = useNav();
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const meals = useLiveQuery(() => db.meals.toArray(), []) ?? [];
  const byName = <T extends { name: string }>(l: T[]) => [...l].sort((a, b) => a.name.localeCompare(b.name));
  const list = byName(kind === 'foods' ? foods.filter((f) => f.source === 'custom' || f.edited) : kind === 'recipes' ? foods.filter((f) => f.source === 'recipe') : []);
  const title = kind === 'foods' ? 'My foods' : kind === 'recipes' ? 'Recipes' : 'Saved meals';
  const create = () => nav.push(kind === 'foods' ? <FoodEditor /> : <PortionListEditor kind={kind === 'recipes' ? 'recipe' : 'meal'} />);
  const count = kind === 'meals' ? meals.length : list.length;

  return (
    <Page title={title} footer={<button className="btn" onClick={create}><Icon name="plus" size={18} />{kind === 'foods' ? 'Create a food' : kind === 'recipes' ? 'Create a recipe' : 'Create a meal'}</button>}>
      {count === 0 && (
        <Empty icon={kind === 'foods' ? 'edit' : kind === 'recipes' ? 'pot' : 'copy'} title={`No ${title.toLowerCase()} yet`}>
          {kind === 'foods' ? 'Create a food from a label, or correct a scanned product, and it is kept here.' : kind === 'recipes' ? 'Add the ingredients and number of servings once. Larder works out the nutrition per serving.' : 'Group foods you often eat together and log them all at once.'}
        </Empty>
      )}
      {kind !== 'meals' && list.length > 0 && (
        <div className="list">
          {list.map((f) => (
            <div className="item" key={f.id}>
              <button className="grow" style={{ textAlign: 'left' }} onClick={() => nav.push(<FoodDetail food={f} date={dayKey()} />)}>
                <span className="t">{f.name}</span>
                <span className="s">{[f.brand, f.servings[0]?.label].filter(Boolean).join(' · ')}</span>
              </button>
              <span className="v">{kcal(totals([defaultPortion(f)]).calories)}<small>kcal</small></span>
              <button className="icon-btn" aria-label={`Delete ${f.name}`} onClick={() => nav.push(<Confirm title={`Delete ${f.name}?`} body="Entries already in your diary are kept." confirmLabel="Delete" onConfirm={async () => { await db.foods.delete(f.id); nav.pop(); }} />)}><Icon name="trash" size={18} /></button>
            </div>
          ))}
        </div>
      )}
      {kind === 'meals' && meals.length > 0 && (
        <div className="list">
          {byName(meals).map((m) => (
            <button className="item" key={m.id} onClick={() => nav.push(<PortionListEditor kind="meal" meal={m} />)}>
              <span className="grow"><span className="t">{m.name}</span><span className="s">{m.items.map((i) => i.food.name).join(', ')}</span></span>
              <span className="v">{kcal(totals(m.items).calories)}<small>kcal</small></span>
              <Icon name="right" size={18} />
            </button>
          ))}
        </div>
      )}
    </Page>
  );
}

// ---------- Meal names ----------

function MealNamesPage() {
  const { settings, update } = useSettings();
  const nav = useNav();
  const [names, setNames] = useState(settings.mealNames);
  const used = useLiveQuery(async () => new Set((await db.entries.toArray()).map((e) => e.meal)), []) ?? new Set<number>();
  const clean = names.map((n) => n.trim());
  const valid = clean.length > 0 && clean.every(Boolean);
  const last = names.length - 1;
  return (
    <Page title="Meal names" footer={<button className="btn" disabled={!valid} onClick={() => { update((s) => ({ ...s, mealNames: clean })); nav.toast('Meal names saved'); nav.pop(); }}>Save</button>}>
      <div className="card stack">
        {names.map((n, i) => (
          <div className="row" key={i}>
            <input id={`mn-${i}`} type="text" aria-label={`Meal ${i + 1}`} value={n} onChange={(e) => setNames((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
            {i === last && names.length > 1 && !used.has(i) && <button className="icon-btn" aria-label={`Remove ${n || 'meal'}`} onClick={() => setNames((l) => l.slice(0, -1))}><Icon name="trash" size={18} /></button>}
          </div>
        ))}
        {names.length < 8 && <button className="btn outline" onClick={() => setNames((l) => [...l, ''])}><Icon name="plus" size={18} />Add a meal</button>}
        <p className="muted" style={{ fontSize: 13 }}>Only the last meal can be removed, and only while nothing is logged under it, so existing diary entries always keep their section.</p>
      </div>
    </Page>
  );
}

// ---------- Databases ----------

function DatabasesPage() {
  const { settings, update } = useSettings();
  const [key, setKey] = useState(settings.usdaKey);
  return (
    <Page title="Food databases">
      <div className="card stack">
        <h2>Open Food Facts</h2>
        <p>Barcode scans and packaged-product search use Open Food Facts, a free public database of package labels maintained by volunteers. Coverage is strongest for products sold in Europe and North America.</p>
        <p className="muted" style={{ fontSize: 13 }}>Because entries are typed in from labels by volunteers, check a product against its package the first time you log it. Use “Correct these values” to fix one; your correction is remembered on this device. Data is available under the Open Database License.</p>
        <a className="link" href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">openfoodfacts.org</a>
      </div>
      <div className="card stack">
        <h2>USDA FoodData Central</h2>
        <p>Add a free USDA key to search lab-analysed data for generic foods such as produce, meat and grains, and to give US barcodes a second source when Open Food Facts has no match.</p>
        <Field label="USDA API key" hint="Stored only on this device and sent only to api.nal.usda.gov.">
          <input id="db-usda" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} value={key} placeholder="Paste your key"
            onChange={(e) => { setKey(e.target.value); update((s) => ({ ...s, usdaKey: e.target.value.trim() })); }} />
        </Field>
        <a className="link" href="https://api.data.gov/signup/" target="_blank" rel="noreferrer">Get a free key at api.data.gov</a>
      </div>
      <div className="card stack">
        <h2>Common foods</h2>
        <p className="muted" style={{ fontSize: 14 }}>About 80 everyday foods are built in so search works offline. Their values are typical figures rounded from USDA reference data.</p>
      </div>
    </Page>
  );
}

// ---------- Backup ----------

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function DataPage() {
  const { settings } = useSettings();
  const nav = useNav();
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const counts = useLiveQuery(async () => ({ entries: await db.entries.count(), foods: await db.foods.count(), days: (await db.entries.orderBy('date').uniqueKeys()).length }), []);

  const restore = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    nav.push(<Confirm title="Replace everything on this device?" body={`Importing “${f.name}” overwrites the diary, foods and settings currently stored here.`} confirmLabel="Import and replace"
      onConfirm={async () => {
        try {
          await importAll(text);
          location.reload();
        } catch (e: any) {
          setError(e?.message ?? 'Import failed.');
          nav.pop();
        }
      }} />);
  };

  return (
    <Page title="Backup and data">
      <div className="card stack">
        <h2>On this device</h2>
        <p>{counts ? `${counts.entries.toLocaleString('en-US')} diary entries across ${counts.days} days, and ${counts.foods} saved foods.` : 'Counting…'}</p>
        <p className="muted" style={{ fontSize: 13 }}>Your data lives in this browser’s storage. Clearing site data or removing the app deletes it, so export a backup now and then, and use a backup to move to a new phone.</p>
      </div>
      <div className="card stack">
        <h2>Export</h2>
        <button className="btn" onClick={async () => download(`larder-backup-${dayKey()}.json`, await exportAll(), 'application/json')}>Download full backup</button>
        <button className="btn ghost" onClick={async () => download(`larder-diary-${dayKey()}.csv`, await exportDiaryCsv(settings.mealNames), 'text/csv')}>Download diary as spreadsheet (CSV)</button>
      </div>
      <div className="card stack">
        <h2>Import</h2>
        <button className="btn outline" onClick={() => file.current?.click()}>Restore from a backup file</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ''; }} />
        {error && <div className="banner warn" role="alert">{error}</div>}
      </div>
      <div className="card stack">
        <h2>Erase</h2>
        <button className="btn text-danger" onClick={() => nav.push(<Confirm title="Erase everything?" body="This permanently deletes your diary, foods, recipes, weight history and settings from this device. It cannot be undone." confirmLabel="Erase all data"
          onConfirm={async () => { await eraseAll(); location.reload(); }} />)}>Erase all data on this device</button>
      </div>
    </Page>
  );
}
