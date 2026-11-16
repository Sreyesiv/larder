import { useLiveQuery } from 'dexie-react-hooks';
import { bodyHistory, loggingStreak, totals } from '../lib/db';
import { fmt, kcal } from '../lib/nutrition';
import { ML_PER_FLOZ, parseDay, waterText, weightText } from '../lib/util';
import { useNav, useSettings } from '../ui/ctx';
import { Icon, Meter, Ring } from '../ui/kit';
import { useDay } from '../ui/useDay';
import { Sparkline } from '../ui/charts';
import { AddFood } from './AddFood';
import { Scan } from './Scan';
import { ExerciseSheet, WeightSheet, addWater } from './Trackers';

export function Today({ today, openDiary }: { today: string; openDiary: (date: string) => void }) {
  const { settings } = useSettings();
  const nav = useNav();
  const day = useDay(today);
  const streak = useLiveQuery(() => loggingStreak(today), [today, day.entries.length]) ?? 0;
  const weights = useLiveQuery(async () => (await bodyHistory()).filter((b) => b.weightKg !== undefined).slice(-30), []) ?? [];

  // Small phones get a smaller ring so the goal/food/exercise column keeps its room.
  const narrow = typeof window !== 'undefined' && window.innerWidth < 370;
  const eatenKcal = day.eaten.calories ?? 0;
  const over = day.remaining < 0;
  const macros = [
    { key: 'carbs', label: 'Carbs', eaten: day.eaten.carbs ?? 0, goal: day.goal.carbs },
    { key: 'fat', label: 'Fat', eaten: day.eaten.fat ?? 0, goal: day.goal.fat },
    { key: 'protein', label: 'Protein', eaten: day.eaten.protein ?? 0, goal: day.goal.protein },
  ];
  const cup = settings.units.water === 'floz' ? 8 * ML_PER_FLOZ : 250;
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const change = latest && first && latest !== first ? latest.weightKg! - first.weightKg! : 0;

  return (
    <div className="stack">
      <div className="tab-head">
        <div>
          <div className="sub">{parseDay(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1>Today</h1>
        </div>
        {streak > 0 && <span className="pill accent"><Icon name="flame" size={14} />{streak}-day streak</span>}
      </div>

      <section className="card" aria-label="Calories">
        <div className="card-head">
          <h2>Calories</h2>
          <button className="link" onClick={() => openDiary(today)}>Open diary</button>
        </div>
        <div className="budget">
          <Ring value={eatenKcal} max={day.budget} size={narrow ? 128 : 168} stroke={narrow ? 11 : 14} color={over ? 'var(--crit)' : 'var(--accent)'}>
            <span className={'big' + (over ? ' over' : '')} style={narrow ? { fontSize: 30 } : undefined}>{kcal(Math.abs(day.remaining))}</span>
            <span className="cap">{over ? 'kcal over' : 'kcal left'}</span>
          </Ring>
          <div className="equation">
            <div><span><Icon name="target" size={16} />Goal</span><b>{kcal(day.goal.calories)}</b></div>
            <div><span><Icon name="pot" size={16} />Food</span><b>{kcal(eatenKcal)}</b></div>
            <div><span><Icon name="flame" size={16} />Exercise</span><b>{kcal(day.burned)}</b></div>
          </div>
        </div>
        {!settings.goals.addExercise && day.burned > 0 && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Exercise calories are not added to your budget. Change this under Goals.</p>}
      </section>

      <section className="card" aria-label="Macros">
        <div className="card-head"><h2>Macros</h2></div>
        <div className="macros">
          {macros.map((m) => {
            const left = m.goal - m.eaten;
            return (
              <div className="macro" key={m.key}>
                <div className="name"><i style={{ background: `var(--${m.key})` }} />{m.label}</div>
                <div className="amt">{fmt(m.eaten, 0)}<small> / {fmt(m.goal, 0)} g</small></div>
                <Meter value={m.eaten} max={m.goal} color={`var(--${m.key})`} />
                <div className="left">{left >= 0 ? `${fmt(left, 0)} g left` : `${fmt(-left, 0)} g over`}</div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid2">
        <button className="btn" onClick={() => nav.push(<Scan date={today} />)}><Icon name="scan" />Scan barcode</button>
        <button className="btn ghost" onClick={() => nav.push(<AddFood date={today} />)}><Icon name="search" />Search food</button>
      </div>

      <section className="list" aria-label="Meals">
        {settings.mealNames.map((name, i) => {
          const items = day.entries.filter((e) => e.meal === i);
          const t = totals(items);
          return (
            <div className="item" key={i}>
              <button className="grow" style={{ textAlign: 'left' }} onClick={() => openDiary(today)}>
                <span className="t">{name}</span>
                <span className="s">{items.length ? items.map((e) => e.food.name).join(', ') : 'Nothing logged yet'}</span>
              </button>
              {items.length > 0 && <span className="v">{kcal(t.calories)}<small>kcal</small></span>}
              <button className="add-quick" aria-label={`Add food to ${name}`} onClick={() => nav.push(<AddFood date={today} meal={i} />)}><Icon name="plus" size={18} /></button>
            </div>
          );
        })}
      </section>

      <section className="card" aria-label="Water">
        <div className="card-head">
          <h2>Water</h2>
          <span className="muted tnum" style={{ fontSize: 13 }}>{waterText(day.waterMl, settings.units)} of {waterText(settings.goals.waterMl, settings.units)}</span>
        </div>
        <Meter value={day.waterMl} max={settings.goals.waterMl} color="var(--water)" />
        <div className="water-cups" style={{ marginTop: 12 }}>
          <button className="btn ghost small" onClick={() => addWater(today, cup)}><Icon name="plus" size={16} />{waterText(cup, settings.units)}</button>
          <button className="btn ghost small" onClick={() => addWater(today, cup * 2)}><Icon name="plus" size={16} />{waterText(cup * 2, settings.units)}</button>
          {day.waterMl > 0 && <button className="btn ghost small" onClick={() => addWater(today, -cup)}>Undo {waterText(cup, settings.units)}</button>}
        </div>
      </section>

      <div className="grid2">
        <button className="card" style={{ textAlign: 'left' }} onClick={() => nav.push(<ExerciseSheet date={today} />)}>
          <div className="card-head"><h2>Exercise</h2><Icon name="plus" size={18} /></div>
          <div className="stat">
            <span className="n">{kcal(day.burned)}<small> kcal</small></span>
            <span className="k">{day.exercises.length ? `${day.exercises.length} logged today` : 'Nothing logged today'}</span>
          </div>
        </button>
        <button className="card" style={{ textAlign: 'left' }} onClick={() => nav.push(<WeightSheet date={today} />)}>
          <div className="card-head"><h2>Weight</h2><Icon name="plus" size={18} /></div>
          <div className="stat">
            <span className="n">{latest ? weightText(latest.weightKg, settings.units) : weightText(settings.profile.weightKg, settings.units)}</span>
            <span className="k">{weights.length > 1 ? `${change > 0 ? '+' : ''}${weightText(change, settings.units)} over ${weights.length} entries` : 'Log to see your trend'}</span>
          </div>
          {weights.length > 1 && <Sparkline values={weights.map((w) => w.weightKg!)} />}
        </button>
      </div>
    </div>
  );
}
