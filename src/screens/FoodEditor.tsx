import { useState } from 'react';
import { db } from '../lib/db';
import { NUTRIENTS, portionNutrients, uid, withStandardServings, type Food, type NutrientKey, type Nutrients } from '../lib/nutrition';
import { parseNum } from '../lib/util';
import { useNav } from '../ui/ctx';
import { Field, NumInput, Page, Segmented } from '../ui/kit';

const MAIN: NutrientKey[] = ['calories', 'fat', 'satFat', 'transFat', 'cholesterol', 'sodium', 'carbs', 'fiber', 'sugar', 'addedSugar', 'protein'];
const EXTRA: NutrientKey[] = ['polyFat', 'monoFat', 'vitaminD', 'calcium', 'iron', 'potassium', 'vitaminA', 'vitaminC'];

const trim = (v: number) => String(Math.round(v * 100) / 100);

/** Create a food by hand, or correct one that came from a database. Values are entered per serving, as on a label. */
export function FoodEditor({ food, barcode, onSaved }: { food?: Food; barcode?: string; onSaved?: (f: Food) => void }) {
  const nav = useNav();
  const first = food?.servings[0];
  const weighed = food ? food.baseUnit !== 'serving' : true;
  const startNutrients: Nutrients = food && first ? portionNutrients({ food, servingQty: first.qty, count: 1 }) : {};

  const [name, setName] = useState(food?.name ?? '');
  const [brand, setBrand] = useState(food?.brand ?? '');
  const [code, setCode] = useState(food?.barcode ?? barcode ?? '');
  const [desc, setDesc] = useState(first ? first.label.replace(/\s*\([\d.]+ ?(g|ml)\)\s*$/i, '').replace(/^[\d.]+ ?(g|ml)$/i, '') : '');
  const [unit, setUnit] = useState<'g' | 'ml'>(food?.baseUnit === 'ml' ? 'ml' : 'g');
  const [size, setSize] = useState(food && weighed && first ? trim(first.qty) : '');
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const k of [...MAIN, ...EXTRA]) if (startNutrients[k] !== undefined) o[k] = trim(startNutrients[k]!);
    return o;
  });
  const [more, setMore] = useState(EXTRA.some((k) => startNutrients[k] !== undefined));
  const [error, setError] = useState('');

  const save = async () => {
    const calories = parseNum(vals.calories ?? '');
    if (!name.trim()) return setError('Give the food a name.');
    if (!isFinite(calories) || calories < 0) return setError('Enter the calories per serving.');
    const sizeNum = parseNum(size);
    if (size.trim() && !(sizeNum > 0)) return setError('Serving weight must be a number greater than zero, or left empty.');
    const nutrients: Nutrients = {};
    for (const k of [...MAIN, ...EXTRA]) {
      const v = parseNum(vals[k] ?? '');
      if (isFinite(v) && v >= 0) nutrients[k] = v;
    }
    const hasSize = sizeNum > 0;
    const label = desc.trim();
    const sized = `${trim(sizeNum)} ${unit}`;
    const result: Food = {
      id: food?.id ?? 'custom:' + uid(),
      source: food?.source ?? 'custom',
      name: name.trim(),
      brand: brand.trim() || undefined,
      barcode: code.replace(/\D/g, '') || undefined,
      baseQty: hasSize ? sizeNum : 1,
      baseUnit: hasSize ? unit : 'serving',
      nutrients,
      servings: hasSize
        ? withStandardServings(unit, [{ label: label ? `${label} (${sized})` : sized, qty: sizeNum }])
        : [{ label: label || '1 serving', qty: 1 }],
      edited: food && food.source !== 'custom' ? true : undefined,
      updatedAt: Date.now(),
    };
    await db.foods.put(result);
    if (onSaved) onSaved(result);
    else { nav.toast('Food saved'); nav.pop(); }
  };

  const input = (k: NutrientKey) => {
    const def = NUTRIENTS.find((n) => n.key === k)!;
    return (
      <div className="row between" key={k} style={{ paddingLeft: (def.indent ?? 0) * 14 }}>
        <label htmlFor={`fe-${k}`} style={{ fontWeight: def.indent ? 500 : 650 }}>{def.label}</label>
        <span style={{ width: 132 }}>
          <NumInput id={`fe-${k}`} value={vals[k] ?? ''} onChange={(v) => setVals((o) => ({ ...o, [k]: v }))} suffix={def.unit} placeholder={k === 'calories' ? 'required' : ''} />
        </span>
      </div>
    );
  };

  return (
    <Page title={food ? (food.source === 'custom' ? 'Edit food' : 'Correct values') : 'Create a food'}
      footer={<button className="btn" onClick={save}>Save food</button>}>
      <div className="card stack">
        <Field label="Name"><input id="fe-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Homemade granola" /></Field>
        <div className="grid2">
          <Field label="Brand (optional)"><input id="fe-brand" type="text" value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
          <Field label="Barcode (optional)"><input id="fe-barcode" type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        </div>
      </div>

      <div className="card stack">
        <h2>Serving</h2>
        <Field label="Serving description" hint="As written on the label, e.g. 1 cup, 2 cookies, 1 bar">
          <input id="fe-desc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="1 serving" />
        </Field>
        <div className="grid2">
          <Field label="Serving weight or volume" hint="Lets you log by gram or millilitre">
            <NumInput id="fe-size" value={size} onChange={setSize} suffix={unit} placeholder="optional" />
          </Field>
          <Field label="Measured in">
            <Segmented label="Unit" value={unit} onChange={setUnit} options={[{ value: 'g', label: 'Grams' }, { value: 'ml', label: 'Millilitres' }]} />
          </Field>
        </div>
      </div>

      <div className="card stack tight">
        <h2>Nutrition per serving</h2>
        {MAIN.map(input)}
        {more ? EXTRA.map(input) : <button className="link" style={{ textAlign: 'left', paddingTop: 6 }} onClick={() => setMore(true)}>Add vitamins and minerals</button>}
      </div>
      {error && <div className="banner warn" role="alert">{error}</div>}
    </Page>
  );
}
