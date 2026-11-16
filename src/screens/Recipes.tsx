import { useState } from 'react';
import { db, totals, type SavedMeal } from '../lib/db';
import { fmt, kcal, portionNutrients, scale, uid, type Food, type Portion } from '../lib/nutrition';
import { dayKey, parseNum } from '../lib/util';
import { useNav } from '../ui/ctx';
import { Confirm, Empty, Field, Icon, NumInput, Page } from '../ui/kit';
import { AddFood } from './AddFood';
import { FoodDetail } from './FoodDetail';

/** Builds a recipe (nutrition per serving of a batch) or a saved meal (foods logged together). */
export function PortionListEditor({ kind, recipe, meal, startItems, onSaved }: {
  kind: 'recipe' | 'meal'; recipe?: Food; meal?: SavedMeal; startItems?: Portion[]; onSaved?: (f: Food) => void;
}) {
  const nav = useNav();
  const [name, setName] = useState(recipe?.name ?? meal?.name ?? '');
  const [yieldStr, setYieldStr] = useState(String(recipe?.yield ?? 1));
  const [items, setItems] = useState<Portion[]>(recipe?.ingredients ?? meal?.items ?? startItems ?? []);
  const [error, setError] = useState('');
  const isRecipe = kind === 'recipe';
  const servings = parseNum(yieldStr);
  const total = totals(items);
  const existingId = recipe?.id ?? meal?.id;

  const save = async () => {
    if (!name.trim()) return setError(`Give the ${kind} a name.`);
    if (!items.length) return setError(isRecipe ? 'Add at least one ingredient.' : 'Add at least one food.');
    if (isRecipe) {
      if (!(servings > 0)) return setError('Enter how many servings the recipe makes.');
      const food: Food = {
        id: recipe?.id ?? 'recipe:' + uid(), source: 'recipe', name: name.trim(), baseQty: 1, baseUnit: 'serving',
        nutrients: scale(total, 1 / servings), servings: [{ label: '1 serving', qty: 1 }], ingredients: items, yield: servings, updatedAt: Date.now(),
      };
      await db.foods.put(food);
      if (onSaved) return onSaved(food);
    } else {
      await db.meals.put({ id: meal?.id ?? uid(), name: name.trim(), items, updatedAt: Date.now() });
    }
    nav.toast(isRecipe ? 'Recipe saved' : 'Meal saved');
    nav.pop();
  };

  const remove = () => nav.push(
    <Confirm title={`Delete this ${kind}?`} body="Entries already in your diary are kept." confirmLabel="Delete"
      onConfirm={async () => { if (isRecipe) await db.foods.delete(existingId!); else await db.meals.delete(existingId!); nav.pop(onSaved ? 3 : 2); }} />,
  );

  return (
    <Page title={`${existingId ? 'Edit' : 'New'} ${kind}`}
      action={existingId && <button className="icon-btn" aria-label={`Delete ${kind}`} onClick={remove}><Icon name="trash" /></button>}
      footer={<button className="btn" onClick={save}>Save {kind}</button>}>
      <div className="card stack">
        <Field label="Name"><input id="pl-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={isRecipe ? 'e.g. Turkey chili' : 'e.g. Usual breakfast'} /></Field>
        {isRecipe && <Field label="Servings this recipe makes"><NumInput id="pl-yield" value={yieldStr} onChange={setYieldStr} /></Field>}
      </div>

      <div className="group-label"><span>{isRecipe ? 'Ingredients' : 'Foods'}</span></div>
      {items.length === 0 ? (
        <Empty icon="pot" title={isRecipe ? 'No ingredients yet' : 'No foods yet'}>Search or scan to add each one with its amount.</Empty>
      ) : (
        <div className="list">
          {items.map((p, i) => (
            <div className="item" key={i}>
              <button className="grow" style={{ textAlign: 'left' }}
                onClick={() => nav.push(<FoodDetail food={p.food} initial={p} date={dayKey()} pickLabel="Update amount" onPick={(np) => { setItems((l) => l.map((x, j) => (j === i ? np : x))); nav.pop(); }} />)}>
                <span className="t">{p.food.name}</span>
                <span className="s">{fmt(p.count, 2)} × {p.servingLabel}</span>
              </button>
              <span className="v">{kcal(portionNutrients(p).calories)}<small>kcal</small></span>
              <button className="icon-btn" aria-label={`Remove ${p.food.name}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}><Icon name="close" size={18} /></button>
            </div>
          ))}
        </div>
      )}
      <button className="btn outline" onClick={() => nav.push(<AddFood date={dayKey()} title={isRecipe ? 'Add ingredient' : 'Add food to meal'} onPick={(p) => setItems((l) => [...l, p])} />)}>
        <Icon name="plus" size={18} />{isRecipe ? 'Add ingredient' : 'Add food'}
      </button>

      {items.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>{isRecipe ? `Per serving${servings > 0 ? ` (1 of ${fmt(servings)})` : ''}` : 'Meal total'}</h2></div>
          <div className="summary-strip">
            {(['calories', 'carbs', 'fat', 'protein'] as const).map((k) => {
              const v = (total[k] ?? 0) / (isRecipe && servings > 0 ? servings : 1);
              return <div key={k}><div className="n">{k === 'calories' ? kcal(v) : fmt(v, 0)}</div><div className="k">{k === 'calories' ? 'kcal' : `${k} g`}</div></div>;
            })}
          </div>
        </div>
      )}
      {error && <div className="banner warn" role="alert">{error}</div>}
    </Page>
  );
}
