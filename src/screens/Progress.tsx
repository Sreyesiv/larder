import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db, entryNutrients, goalForDate } from '../lib/db';
import { NUTRIENTS, add, fmt, kcal, macroSplit, scale, type Nutrients } from '../lib/nutrition';
import { addDays, daysBetween, lastDays, shortDate, toDisplayWeight, weightText } from '../lib/util';
import { useNav, useSettings } from '../ui/ctx';
import { BarChart, LineChart } from '../ui/charts';
import { Empty, Icon, MacroSplitBar, Meter, Page, Segmented } from '../ui/kit';
import { WeightSheet } from './Trackers';

export function Progress({ today }: { today: string }) {
  const nav = useNav();
  const { settings } = useSettings();
  const u = settings.units;
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const start = addDays(today, -(range - 1));
  const days = useMemo(() => lastDays(today, range), [today, range]);

  const entries = useLiveQuery(() => db.entries.where('date').between(start, today, true, true).toArray(), [start, today]) ?? [];
  const body = useLiveQuery(() => db.body.where('date').between(start, today, true, true).toArray(), [start, today]) ?? [];
  const exercises = useLiveQuery(() => db.exercises.where('date').between(start, today, true, true).toArray(), [start, today]) ?? [];

  const stats = useMemo(() => {
    const perDay = new Map<string, Nutrients>();
    const perFood = new Map<string, { name: string; calories: number; times: number }>();
    for (const e of entries) {
      const n = entryNutrients(e);
      perDay.set(e.date, add(perDay.get(e.date) ?? {}, n));
      if (e.food.source !== 'quick') {
        const f = perFood.get(e.food.id) ?? { name: e.food.name, calories: 0, times: 0 };
        f.calories += n.calories ?? 0;
        f.times += 1;
        perFood.set(e.food.id, f);
      }
    }
    const logged = [...perDay.values()];
    const total = logged.reduce(add, {} as Nutrients);
    const avg = logged.length ? scale(total, 1 / logged.length) : {};
    const top = [...perFood.values()].sort((a, b) => b.calories - a.calories).slice(0, 8);
    return { perDay, avg, loggedDays: logged.length, top };
  }, [entries]);

  const weights = body.filter((b) => b.weightKg !== undefined);
  const burned = exercises.reduce((a, x) => a + x.calories, 0);
  const goal = goalForDate(settings.goals, today);
  const change = weights.length > 1 ? weights[weights.length - 1].weightKg! - weights[0].weightKg! : 0;
  const toGoal = (weights[weights.length - 1]?.weightKg ?? settings.profile.weightKg) - settings.profile.goalWeightKg;

  return (
    <div className="stack">
      <div className="tab-head"><h1>Progress</h1></div>
      <Segmented label="Time range" value={range} onChange={setRange} options={[{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }]} />

      <section className="card stack" aria-label="Weight">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h2>Weight</h2>
          <div className="row">
            <button className="link" onClick={() => nav.push(<WeightHistory />)}>History</button>
            <button className="btn small" onClick={() => nav.push(<WeightSheet date={today} />)}>Log</button>
          </div>
        </div>
        <div className="grid3">
          <div className="stat"><span className="k">Latest</span><span className="n">{weightText(weights[weights.length - 1]?.weightKg ?? settings.profile.weightKg, u)}</span></div>
          <div className="stat"><span className="k">Change</span><span className="n">{weights.length > 1 ? `${change > 0 ? '+' : ''}${weightText(change, u)}` : '–'}</span></div>
          <div className="stat"><span className="k">To goal</span><span className="n">{Math.abs(toGoal) < 0.05 ? 'Reached' : weightText(Math.abs(toGoal), u)}</span></div>
        </div>
        {weights.length > 0 ? (
          <LineChart seriesName="Weight" goalName="Goal" goal={toDisplayWeight(settings.profile.goalWeightKg, u)} xMax={range - 1}
            format={(v) => `${v.toFixed(1)} ${u.weight}`}
            points={weights.map((w) => ({ x: daysBetween(start, w.date), y: toDisplayWeight(w.weightKg!, u), label: shortDate(w.date) }))}
            xLabels={[{ x: 0, text: shortDate(start) }, { x: (range - 1) / 2, text: shortDate(addDays(start, Math.floor((range - 1) / 2))) }, { x: range - 1, text: shortDate(today) }]} />
        ) : <Empty icon="scale" title="No weigh-ins in this range">Log your weight to see the trend line and how far you are from your goal.</Empty>}
      </section>

      <section className="card stack" aria-label="Calories">
        <div className="card-head" style={{ marginBottom: 0 }}><h2>Calories</h2><span className="pill">{stats.loggedDays} of {range} days logged</span></div>
        <div className="grid3">
          <div className="stat"><span className="k">Daily average</span><span className="n">{stats.loggedDays ? kcal(stats.avg.calories ?? 0) : '–'}</span></div>
          <div className="stat"><span className="k">Goal</span><span className="n">{kcal(goal.calories)}</span></div>
          <div className="stat"><span className="k">Exercise</span><span className="n">{kcal(burned)}<small> kcal</small></span></div>
        </div>
        <BarChart seriesName="Calories eaten" goalName="Goal" goal={goal.calories} format={(v) => `${kcal(v)} kcal`}
          bars={days.map((d) => ({ label: shortDate(d), value: stats.perDay.has(d) ? stats.perDay.get(d)!.calories ?? 0 : null }))} />
      </section>

      {stats.loggedDays === 0 ? (
        <Empty icon="chart" title="Nothing logged in this range">Macro averages, nutrient totals and your highest-calorie foods appear once you log some meals.</Empty>
      ) : (
        <>
          <section className="card stack" aria-label="Macros">
            <h2>Macros, daily average</h2>
            <MacroSplitBar split={macroSplit(stats.avg)} />
            <table className="data">
              <thead><tr><th>Macro</th><th>Average</th><th>Goal</th><th>Difference</th></tr></thead>
              <tbody>
                {(['carbs', 'fat', 'protein'] as const).map((k) => {
                  const v = stats.avg[k] ?? 0;
                  const d = v - goal[k];
                  return <tr key={k}><td style={{ textTransform: 'capitalize' }}>{k}</td><td>{fmt(v, 0)} g</td><td>{goal[k]} g</td><td>{d > 0 ? '+' : ''}{fmt(d, 0)} g</td></tr>;
                })}
              </tbody>
            </table>
          </section>

          <section className="card stack" aria-label="Nutrients">
            <h2>Nutrients, daily average</h2>
            <div className="bar-list">
              {NUTRIENTS.filter((n) => settings.goals.nutrients[n.key] !== undefined).map((n) => {
                const v = stats.avg[n.key] ?? 0;
                const g = settings.goals.nutrients[n.key]!;
                const overLimit = !!n.limit && v > g;
                return (
                  <div key={n.key}>
                    <div className="lbl">
                      <span>{n.short}{overLimit && <span className="pill warn" style={{ marginLeft: 8 }}>Over limit</span>}</span>
                      <b className="tnum">{fmt(v, v < 10 ? 1 : 0)} / {fmt(g, 0)} {n.unit}</b>
                    </div>
                    <Meter value={v} max={g} color="var(--accent)" over={overLimit} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card stack" aria-label="Top foods">
            <h2>Where your calories came from</h2>
            <div className="bar-list">
              {stats.top.map((f) => (
                <div key={f.name}>
                  <div className="lbl"><span>{f.name} <span className="muted">· {f.times}×</span></span><b className="tnum">{kcal(f.calories)} kcal</b></div>
                  <Meter value={f.calories} max={stats.top[0].calories} color="var(--accent)" />
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function WeightHistory() {
  const { settings } = useSettings();
  const nav = useNav();
  const rows = useLiveQuery(() => db.body.orderBy('date').reverse().toArray(), []) ?? [];
  const inches = settings.units.height === 'ftin';
  return (
    <Page title="Weight history">
      {rows.length === 0 ? <Empty icon="scale" title="No entries yet" /> : (
        <div className="list">
          {rows.map((r) => (
            <button className="item" key={r.date} onClick={() => nav.push(<WeightSheet date={r.date} />)}>
              <span className="grow">
                <span className="t">{shortDate(r.date)}, {r.date.slice(0, 4)}</span>
                <span className="s">{[r.bodyFatPct !== undefined && `${r.bodyFatPct}% body fat`, r.waistCm !== undefined && `Waist ${(inches ? r.waistCm / 2.54 : r.waistCm).toFixed(1)} ${inches ? 'in' : 'cm'}`].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="v">{weightText(r.weightKg, settings.units)}</span>
              <Icon name="right" size={18} />
            </button>
          ))}
        </div>
      )}
    </Page>
  );
}
