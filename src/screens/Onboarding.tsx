import { useState } from 'react';
import { db } from '../lib/db';
import { ACTIVITY_LEVELS, calorieTarget, gramsFromPercent, type Profile } from '../lib/nutrition';
import { LB_PER_KG, cmToFtIn, dayKey, ftInToCm, fromDisplayWeight, parseNum, toDisplayWeight, type Units } from '../lib/util';
import { useSettings } from '../ui/ctx';
import { Field, Icon, NumInput, Segmented } from '../ui/kit';

/** Weekly pace options in kg; shown in the user's own unit. */
export const PACES = [0.25, 0.5, 0.75, 1];

export function paceLabel(kg: number, u: Units): string {
  return u.weight === 'lb' ? `${(Math.round(kg * LB_PER_KG * 2) / 2).toString()} lb` : `${kg} kg`;
}

/** Shared body-measurement inputs used by onboarding and the profile page. */
export function useBodyForm(p: Profile, units: Units) {
  const fi = cmToFtIn(p.heightCm);
  const [v, setV] = useState({
    age: String(new Date().getFullYear() - p.birthYear),
    cm: String(Math.round(p.heightCm)), ft: String(fi.ft), inch: String(fi.inch),
    weight: toDisplayWeight(p.weightKg, units).toFixed(0),
    goalWeight: toDisplayWeight(p.goalWeightKg, units).toFixed(0),
  });
  const set = (k: keyof typeof v) => (val: string) => setV((o) => ({ ...o, [k]: val }));
  const age = parseNum(v.age);
  const heightCm = units.height === 'cm' ? parseNum(v.cm) : ftInToCm(parseNum(v.ft), parseNum(v.inch) || 0);
  const weightKg = fromDisplayWeight(parseNum(v.weight), units);
  const goalWeightKg = fromDisplayWeight(parseNum(v.goalWeight), units);
  const valid = age >= 13 && age <= 100 && heightCm >= 120 && heightCm <= 230 && weightKg >= 30 && weightKg <= 350 && goalWeightKg >= 30 && goalWeightKg <= 350;
  /** Re-express what was typed when the unit system changes, so 70 kg does not become 70 lb. */
  const convert = (to: Units) => {
    const next = { ...v };
    if (isFinite(weightKg) && weightKg > 0) next.weight = toDisplayWeight(weightKg, to).toFixed(0);
    if (isFinite(goalWeightKg) && goalWeightKg > 0) next.goalWeight = toDisplayWeight(goalWeightKg, to).toFixed(0);
    if (isFinite(heightCm) && heightCm > 0) {
      const f = cmToFtIn(heightCm);
      next.cm = String(Math.round(heightCm));
      next.ft = String(f.ft);
      next.inch = String(f.inch);
    }
    setV(next);
  };
  return { v, set, valid, convert, values: { birthYear: new Date().getFullYear() - Math.round(age), heightCm, weightKg, goalWeightKg } };
}

export function BodyFields({ form, units, idp }: { form: ReturnType<typeof useBodyForm>; units: Units; idp: string }) {
  const { v, set } = form;
  return (
    <>
      <div className="grid2">
        <Field label="Age"><NumInput id={`${idp}-age`} value={v.age} onChange={set('age')} suffix="yr" /></Field>
        {units.height === 'cm'
          ? <Field label="Height"><NumInput id={`${idp}-cm`} value={v.cm} onChange={set('cm')} suffix="cm" /></Field>
          : <Field label="Height"><span className="grid2" style={{ gap: 6 }}><NumInput id={`${idp}-ft`} value={v.ft} onChange={set('ft')} suffix="ft" ariaLabel="Feet" /><NumInput id={`${idp}-in`} value={v.inch} onChange={set('inch')} suffix="in" ariaLabel="Inches" /></span></Field>}
      </div>
      <div className="grid2">
        <Field label="Current weight"><NumInput id={`${idp}-weight`} value={v.weight} onChange={set('weight')} suffix={units.weight} /></Field>
        <Field label="Goal weight"><NumInput id={`${idp}-goal`} value={v.goalWeight} onChange={set('goalWeight')} suffix={units.weight} /></Field>
      </div>
    </>
  );
}

export function Onboarding() {
  const { settings, update } = useSettings();
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState(settings.units);
  const [sex, setSex] = useState(settings.profile.sex);
  const [activity, setActivity] = useState(settings.profile.activity);
  const [pace, setPace] = useState(0.5);
  const form = useBodyForm(settings.profile, units);
  const imperial = units.weight === 'lb';

  const diff = form.values.goalWeightKg - form.values.weightKg;
  const direction = Math.abs(diff) < 0.5 ? 0 : Math.sign(diff);
  const profile: Profile = { sex, activity, ...form.values, weeklyRateKg: direction * pace };
  const target = form.valid ? calorieTarget(profile) : null;
  const goal = target ? gramsFromPercent(target.target, 45, 25, 30) : null;

  const finish = async () => {
    if (!target || !goal) return;
    await db.body.put({ date: dayKey(), weightKg: profile.weightKg });
    update((s) => ({ ...s, onboarded: true, units, profile, goals: { ...s.goals, base: goal, macroMode: 'percent' } }));
  };

  return (
    <div className="onb">
      <div className="wordmark"><Icon name="pot" size={24} />Larder</div>
      <div className="onb-steps" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>

      {step === 0 && (
        <>
          <div className="stack tight">
            <h1>Let’s work out your daily calories</h1>
            <p className="lede">A few numbers about you set a starting target. Everything stays on this device and you can change any of it later.</p>
          </div>
          <Segmented label="Units" value={imperial ? 'us' : 'metric'} onChange={(x) => { const to: Units = x === 'us' ? { weight: 'lb', height: 'ftin', water: 'floz' } : { weight: 'kg', height: 'cm', water: 'ml' }; form.convert(to); setUnits(to); }}
            options={[{ value: 'us', label: 'lb, ft, fl oz' }, { value: 'metric', label: 'kg, cm, ml' }]} />
          <Field label="Sex, for the energy estimate">
            <Segmented label="Sex" value={sex} onChange={setSex} options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]} />
          </Field>
          <BodyFields form={form} units={units} idp="ob" />
          <div style={{ flex: 1 }} />
          {!form.valid && <p className="muted" style={{ fontSize: 13 }}>Fill in age, height and both weights to continue.</p>}
          <button className="btn" disabled={!form.valid} onClick={() => setStep(1)}>Continue</button>
        </>
      )}

      {step === 1 && (
        <>
          <div className="stack tight">
            <h1>How active are you?</h1>
            <p className="lede">Pick the description closest to a normal week, not counting workouts you plan to log.</p>
          </div>
          <div className="stack tight">
            {ACTIVITY_LEVELS.map((a) => (
              <button key={a.value} className={'choice' + (a.value === activity ? ' on' : '')} aria-pressed={a.value === activity} onClick={() => setActivity(a.value)}>
                <b>{a.label}</b><span>{a.hint}</span>
              </button>
            ))}
          </div>
          {direction !== 0 && (
            <Field label={direction < 0 ? 'How fast do you want to lose?' : 'How fast do you want to gain?'}>
              <Segmented label="Weekly pace" value={pace} onChange={setPace} options={PACES.map((p) => ({ value: p, label: `${paceLabel(p, units)}/wk` }))} />
            </Field>
          )}
          <div style={{ flex: 1 }} />
          <div className="grid2">
            <button className="btn ghost" onClick={() => setStep(0)}>Back</button>
            <button className="btn" onClick={() => setStep(2)}>Continue</button>
          </div>
        </>
      )}

      {step === 2 && target && goal && (
        <>
          <div className="stack tight">
            <h1>Your starting target</h1>
            <p className="lede">{direction === 0 ? 'This keeps your weight about where it is.' : `This aims for about ${paceLabel(pace, units)} ${direction < 0 ? 'lost' : 'gained'} per week.`}</p>
          </div>
          <div className="card stack">
            <div><span className="hero-num">{target.target.toLocaleString('en-US')}</span> <span className="muted">kcal per day</span></div>
            <div className="grid3">
              <div className="stat"><span className="k">Carbs 45%</span><span className="n">{goal.carbs}<small> g</small></span></div>
              <div className="stat"><span className="k">Fat 30%</span><span className="n">{goal.fat}<small> g</small></span></div>
              <div className="stat"><span className="k">Protein 25%</span><span className="n">{goal.protein}<small> g</small></span></div>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>
              You burn roughly {target.maintenance.toLocaleString('en-US')} kcal on a normal day (Mifflin-St Jeor estimate).
              {target.floored ? ' Your chosen pace would go below a commonly recommended minimum, so the target stops there.' : ''}
            </p>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>This is an estimate for general tracking, not medical advice. Adjust calories and macros any time under More, then Goals.</p>
          <div style={{ flex: 1 }} />
          <div className="grid2">
            <button className="btn ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn" onClick={finish}>Start tracking</button>
          </div>
        </>
      )}
    </div>
  );
}
