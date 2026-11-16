import { useMemo, useState } from 'react';
import { db, logPortion, type Entry } from '../lib/db';
import { fmt, kcal, macroSplit, portionNutrients, type Food, type Portion, type Serving } from '../lib/nutrition';
import { dayLabel, mealForNow, parseNum } from '../lib/util';
import { useNav, useSettings } from '../ui/ctx';
import { Confirm, Field, Icon, MacroSplitBar, NumInput, Page } from '../ui/kit';
import { NutritionLabel } from '../ui/NutritionLabel';
import { FoodEditor } from './FoodEditor';
import { PortionListEditor } from './Recipes';

const SOURCE_TEXT: Record<Food['source'], string> = {
  off: 'Open Food Facts',
  usda: 'USDA FoodData Central',
  common: 'Common food, typical values',
  custom: 'Your food',
  recipe: 'Your recipe',
  quick: 'Quick add',
};

export function defaultPortion(food: Food): Portion {
  const s = food.servings[0] ?? { label: '1 serving', qty: 1 };
  return { food, servingLabel: s.label, servingQty: s.qty, count: 1 };
}

interface Props {
  food: Food;
  date: string;
  meal?: number;
  /** Set when editing something already in the diary. */
  entry?: Entry;
  /** Starting portion, e.g. the amount used last time. */
  initial?: Portion;
  /** When set, the chosen portion is handed back instead of being logged. */
  onPick?: (p: Portion) => void;
  pickLabel?: string;
}

export function FoodDetail({ food: startFood, date, meal, entry, initial, onPick, pickLabel }: Props) {
  const nav = useNav();
  const { settings } = useSettings();
  const [food, setFood] = useState(startFood);
  const start = entry ?? initial;

  const servings = useMemo<Serving[]>(() => {
    const list = [...food.servings];
    if (start && !list.some((s) => Math.abs(s.qty - start.servingQty) < 0.001)) list.unshift({ label: start.servingLabel, qty: start.servingQty });
    return list.length ? list : [{ label: '1 serving', qty: 1 }];
  }, [food, start]);

  const [sIdx, setSIdx] = useState(() => Math.max(0, start ? servings.findIndex((s) => Math.abs(s.qty - start.servingQty) < 0.001) : 0));
  const [countStr, setCountStr] = useState(String(start?.count ?? 1));
  const [mealIdx, setMealIdx] = useState(entry?.meal ?? meal ?? mealForNow(settings.mealNames.length));
  const serving = servings[Math.min(sIdx, servings.length - 1)];
  const count = parseNum(countStr);
  const valid = isFinite(count) && count > 0;
  const portion: Portion = { food, servingLabel: serving.label, servingQty: serving.qty, count: valid ? count : 0 };
  const n = portionNutrients(portion);
  const quick = food.source === 'quick';

  const save = async () => {
    if (!valid) return;
    if (onPick) return onPick(portion);
    if (entry) {
      await db.entries.put({ ...entry, ...portion, meal: mealIdx });
      nav.toast('Saved');
    } else {
      await logPortion(portion, date, mealIdx);
      nav.toast(`Added to ${settings.mealNames[mealIdx]}`);
    }
    nav.pop();
  };

  const remove = () => nav.push(
    <Confirm title="Remove from diary?" body={`${food.name} will be removed from ${dayLabel(date).toLowerCase()}.`} confirmLabel="Remove"
      onConfirm={async () => { await db.entries.delete(entry!.id); nav.pop(2); }} />,
  );

  const edit = () => {
    if (food.source === 'recipe') nav.push(<PortionListEditor kind="recipe" recipe={food} onSaved={(f) => { setFood(f); nav.pop(); }} />);
    else nav.push(<FoodEditor food={food} onSaved={(f) => { setFood(f); setSIdx(0); nav.pop(); }} />);
  };

  const amount = `${fmt(valid ? count : 0, 2)} × ${serving.label}`;

  return (
    <Page title={entry ? 'Edit entry' : onPick ? (pickLabel ?? 'Add') : 'Add food'}
      action={entry && <button className="icon-btn" aria-label="Remove from diary" onClick={remove}><Icon name="trash" /></button>}
      footer={<button className="btn" disabled={!valid} onClick={save}>{onPick ? (pickLabel ?? 'Add') : entry ? 'Save changes' : `Add to ${settings.mealNames[mealIdx]}`}</button>}>
      <div>
        <h2 style={{ font: '700 22px/1.2 var(--display)', textWrap: 'balance' }}>{food.name}</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          {[food.brand, SOURCE_TEXT[food.source] + (food.edited ? ', edited by you' : ''), food.barcode && `Barcode ${food.barcode}`].filter(Boolean).join(' · ')}
        </p>
      </div>

      {food.incomplete && (
        <div className="banner warn">
          <Icon name="info" size={20} />
          <div>
            <b>No calorie data for this product.</b> The database entry is missing its nutrition facts. Enter them from the label and the scanner will remember them.
            <div style={{ marginTop: 8 }}><button className="btn small" onClick={edit}>Enter nutrition facts</button></div>
          </div>
        </div>
      )}

      {!quick && (
        <div className="card stack">
          <Field label="Serving size">
            <select id="fd-serving" value={sIdx} onChange={(e) => setSIdx(Number(e.target.value))}>
              {servings.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
            </select>
          </Field>
          <div className="grid2">
            <Field label="Number of servings">
              <NumInput id="fd-count" value={countStr} onChange={setCountStr} />
            </Field>
            {!onPick && (
              <Field label="Meal">
                <select id="fd-meal" value={mealIdx} onChange={(e) => setMealIdx(Number(e.target.value))}>
                  {settings.mealNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </Field>
            )}
          </div>
          {!valid && <span className="over" style={{ fontSize: 13 }}>Enter a number of servings greater than zero.</span>}
        </div>
      )}
      {quick && !onPick && (
        <div className="card">
          <Field label="Meal">
            <select id="fd-meal" value={mealIdx} onChange={(e) => setMealIdx(Number(e.target.value))}>
              {settings.mealNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </Field>
        </div>
      )}

      <div className="card stack">
        <div className="row between">
          <div className="stat"><span className="k">Calories</span><span className="n" style={{ fontSize: 34 }}>{kcal(n.calories)}</span></div>
          <div className="grid3" style={{ textAlign: 'right' }}>
            <div className="stat"><span className="k">Carbs</span><span className="n">{fmt(n.carbs ?? 0)}<small> g</small></span></div>
            <div className="stat"><span className="k">Fat</span><span className="n">{fmt(n.fat ?? 0)}<small> g</small></span></div>
            <div className="stat"><span className="k">Protein</span><span className="n">{fmt(n.protein ?? 0)}<small> g</small></span></div>
          </div>
        </div>
        <MacroSplitBar split={macroSplit(n)} />
      </div>

      <NutritionLabel nutrients={n} serving={amount} approx={food.source === 'common'} />

      {food.source === 'recipe' && food.ingredients && (
        <div className="card">
          <div className="card-head"><h2>Ingredients, makes {fmt(food.yield ?? 1)} servings</h2></div>
          <div className="stack tight">
            {food.ingredients.map((p, i) => (
              <div className="row between" key={i}>
                <span className="grow">{p.food.name}<span className="muted"> · {fmt(p.count, 2)} × {p.servingLabel}</span></span>
                <span className="tnum">{kcal(portionNutrients(p).calories)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {food.source !== 'common' && !quick && (
        <button className="btn outline" onClick={edit}>
          <Icon name="edit" size={18} />
          {food.source === 'recipe' ? 'Edit recipe' : food.source === 'custom' ? 'Edit food' : 'Correct these values'}
        </button>
      )}
      {(food.source === 'off' || food.source === 'usda') && (
        <p className="muted" style={{ fontSize: 12 }}>
          {food.source === 'off'
            ? 'Values come from Open Food Facts, a public database of package labels entered by volunteers. Check them against the label the first time you log a product.'
            : 'Values come from USDA FoodData Central.'}
        </p>
      )}
    </Page>
  );
}
