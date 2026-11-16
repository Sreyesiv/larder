import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db, type ExerciseEntry } from '../lib/db';
import { ACTIVITIES, estimateBurn } from '../lib/exercise';
import { uid } from '../lib/nutrition';
import { ML_PER_FLOZ, dayLabel, fromDisplayWeight, parseNum, toDisplayWeight, waterText } from '../lib/util';
import { useNav, useSettings } from '../ui/ctx';
import { Field, Icon, Meter, NumInput, Sheet } from '../ui/kit';

export async function addWater(date: string, deltaMl: number): Promise<void> {
  await db.transaction('rw', db.water, async () => {
    const cur = (await db.water.get(date))?.ml ?? 0;
    await db.water.put({ date, ml: Math.max(0, Math.round(cur + deltaMl)) });
  });
}

export function WaterSheet({ date }: { date: string }) {
  const { settings } = useSettings();
  const u = settings.units;
  const total = useLiveQuery(() => db.water.get(date).then((w) => w?.ml ?? 0), [date]) ?? 0;
  const [custom, setCustom] = useState('');
  const cup = u.water === 'floz' ? 8 * ML_PER_FLOZ : 250;
  const customMl = parseNum(custom) * (u.water === 'floz' ? ML_PER_FLOZ : 1);
  return (
    <Sheet title={`Water, ${dayLabel(date).toLowerCase()}`}>
      <div className="row between">
        <span className="num" style={{ fontSize: 30, fontWeight: 700 }}>{waterText(total, u)}</span>
        <span className="muted">Goal {waterText(settings.goals.waterMl, u)}</span>
      </div>
      <Meter value={total} max={settings.goals.waterMl} color="var(--water)" />
      <div className="grid3">
        {[1, 2, 3].map((k) => <button key={k} className="btn ghost" onClick={() => addWater(date, cup * k)}>+{waterText(cup * k, u)}</button>)}
      </div>
      <div className="row">
        <span className="grow"><NumInput id="water-custom" value={custom} onChange={setCustom} suffix={u.water === 'floz' ? 'fl oz' : 'ml'} placeholder="Other amount" ariaLabel="Other amount" /></span>
        <button className="btn small" style={{ minHeight: 46 }} disabled={!(customMl > 0)} onClick={() => { void addWater(date, customMl); setCustom(''); }}>Add</button>
      </div>
      {total > 0 && <button className="btn text-danger" onClick={() => addWater(date, -total)}>Reset to zero</button>}
    </Sheet>
  );
}

export function ExerciseSheet({ date, entry }: { date: string; entry?: ExerciseEntry }) {
  const nav = useNav();
  const { settings } = useSettings();
  const latest = useLiveQuery(async () => (await db.body.orderBy('date').reverse().toArray()).find((b) => b.weightKg !== undefined)?.weightKg, []);
  const weightKg = latest ?? settings.profile.weightKg;
  const known = entry ? ACTIVITIES.findIndex((a) => a.name === entry.name) : 0;
  const [idx, setIdx] = useState(known);
  const [name, setName] = useState(entry && known < 0 ? entry.name : '');
  const [minutes, setMinutes] = useState(entry?.minutes ? String(entry.minutes) : '30');
  const [cal, setCal] = useState(entry ? String(entry.calories) : '');
  const [touched, setTouched] = useState(!!entry);
  const [sets, setSets] = useState(entry?.sets ? String(entry.sets) : '');
  const [reps, setReps] = useState(entry?.reps ? String(entry.reps) : '');
  const [load, setLoad] = useState(entry?.weight ? String(entry.weight) : '');
  const act = idx >= 0 ? ACTIVITIES[idx] : null;
  const estimate = act ? estimateBurn(act.met, weightKg, parseNum(minutes)) : 0;

  // Keep the calorie field in step with the estimate until the user types their own number.
  useEffect(() => {
    if (!touched) setCal(estimate ? String(estimate) : '');
  }, [estimate, touched]);

  const calories = parseNum(cal);
  const title = act ? act.name : name.trim();
  const ok = !!title && isFinite(calories) && calories >= 0;
  const save = async () => {
    const num = (s: string) => { const n = parseNum(s); return n > 0 ? n : undefined; };
    await db.exercises.put({
      id: entry?.id ?? uid(), date, name: title, kind: act?.kind ?? 'cardio', minutes: num(minutes), calories: Math.round(calories),
      sets: num(sets), reps: num(reps), weight: num(load), createdAt: entry?.createdAt ?? Date.now(),
    });
    nav.toast(entry ? 'Saved' : 'Exercise logged');
    nav.pop();
  };

  return (
    <Sheet title={entry ? 'Edit exercise' : `Log exercise, ${dayLabel(date).toLowerCase()}`}>
      <Field label="Activity">
        <select id="ex-activity" value={idx} onChange={(e) => { setIdx(Number(e.target.value)); setTouched(false); }}>
          {ACTIVITIES.map((a, i) => <option key={a.name} value={i}>{a.name}</option>)}
          <option value={-1}>Something else…</option>
        </select>
      </Field>
      {idx < 0 && <Field label="Name"><input id="ex-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rock climbing" /></Field>}
      <div className="grid2">
        <Field label="Duration"><NumInput id="ex-min" value={minutes} onChange={setMinutes} suffix="min" /></Field>
        <Field label="Calories burned" hint={act && !touched ? 'Estimated from your weight' : undefined}>
          <NumInput id="ex-cal" value={cal} onChange={(v) => { setCal(v); setTouched(true); }} suffix="kcal" />
        </Field>
      </div>
      {(act?.kind === 'strength' || idx < 0) && (
        <div className="grid3">
          <Field label="Sets"><NumInput id="ex-sets" value={sets} onChange={setSets} /></Field>
          <Field label="Reps"><NumInput id="ex-reps" value={reps} onChange={setReps} /></Field>
          <Field label={`Weight (${settings.units.weight})`}><NumInput id="ex-load" value={load} onChange={setLoad} /></Field>
        </div>
      )}
      <button className="btn" disabled={!ok} onClick={save}>{entry ? 'Save changes' : 'Log exercise'}</button>
      {entry && <button className="btn text-danger" onClick={async () => { await db.exercises.delete(entry.id); nav.pop(); }}><Icon name="trash" size={18} />Delete</button>}
    </Sheet>
  );
}

export function WeightSheet({ date }: { date: string }) {
  const nav = useNav();
  const { settings, update } = useSettings();
  const u = settings.units;
  const existing = useLiveQuery(() => db.body.get(date), [date]);
  const [weight, setWeight] = useState('');
  const [fat, setFat] = useState('');
  const [waist, setWaist] = useState('');
  const inches = u.height === 'ftin';

  // Prefill from the saved entry for this day, unless the user has already started typing.
  const touched = useRef(false);
  useEffect(() => {
    if (!existing || touched.current) return;
    if (existing.weightKg !== undefined) setWeight(toDisplayWeight(existing.weightKg, u).toFixed(1));
    if (existing.bodyFatPct !== undefined) setFat(String(existing.bodyFatPct));
    if (existing.waistCm !== undefined) setWaist((inches ? existing.waistCm / 2.54 : existing.waistCm).toFixed(1));
    // Runs once, when the saved entry for this day loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.date]);
  const typed = (set: (v: string) => void) => (v: string) => { touched.current = true; set(v); };

  const w = parseNum(weight);
  const ok = w > 0 && w < 1500;
  const save = async () => {
    const weightKg = fromDisplayWeight(w, u);
    const f = parseNum(fat);
    const wa = parseNum(waist);
    await db.body.put({ date, weightKg, bodyFatPct: f > 0 && f < 80 ? f : undefined, waistCm: wa > 0 ? (inches ? wa * 2.54 : wa) : undefined });
    // The newest weigh-in also feeds the calorie estimate for exercise and goals.
    const newest = (await db.body.orderBy('date').reverse().toArray()).find((b) => b.weightKg !== undefined);
    if (newest?.date === date) update((s) => ({ ...s, profile: { ...s.profile, weightKg } }));
    nav.toast('Weight logged');
    nav.pop();
  };

  return (
    <Sheet title={`Weight, ${dayLabel(date).toLowerCase()}`}>
      <Field label="Weight"><NumInput id="wt-weight" value={weight} onChange={typed(setWeight)} suffix={u.weight} autoFocus /></Field>
      <div className="grid2">
        <Field label="Body fat (optional)"><NumInput id="wt-fat" value={fat} onChange={typed(setFat)} suffix="%" /></Field>
        <Field label="Waist (optional)"><NumInput id="wt-waist" value={waist} onChange={typed(setWaist)} suffix={inches ? 'in' : 'cm'} /></Field>
      </div>
      <button className="btn" disabled={!ok} onClick={save}>Save</button>
      {existing && <button className="btn text-danger" onClick={async () => { await db.body.delete(date); nav.pop(); }}><Icon name="trash" size={18} />Delete this entry</button>}
    </Sheet>
  );
}
