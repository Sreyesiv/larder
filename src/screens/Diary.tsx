import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { copyEntries, db, entryNutrients, totals, type Entry } from '../lib/db';
import { NUTRIENTS, fmt, kcal, macroSplit } from '../lib/nutrition';
import { addDays, dayLabel, waterText } from '../lib/util';
import { useNav, useSettings } from '../ui/ctx';
import { Confirm, Field, Icon, MacroSplitBar, Meter, Page, Sheet } from '../ui/kit';
import { useDay, type DayData } from '../ui/useDay';
import { AddFood } from './AddFood';
import { FoodDetail } from './FoodDetail';
import { PortionListEditor } from './Recipes';
import { ExerciseSheet, WaterSheet } from './Trackers';

export function Diary({ date, setDate, today }: { date: string; setDate: (d: string) => void; today: string }) {
  const nav = useNav();
  const { settings } = useSettings();
  const day = useDay(date);
  const over = day.remaining < 0;

  return (
    <div className="stack">
      <div className="datebar">
        <button className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><Icon name="back" /></button>
        <label className="date">
          {dayLabel(date, today)}<Icon name="down" size={16} />
          <input id="diary-date" type="date" aria-label="Choose a date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <button className="icon-btn" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><Icon name="right" /></button>
      </div>

      <button className="card" style={{ textAlign: 'left' }} onClick={() => nav.push(<DayNutrition date={date} />)} aria-label="Day summary, open nutrition details">
        <div className="summary-strip">
          <div><div className="n">{kcal(day.goal.calories)}</div><div className="k">Goal</div></div>
          <div><div className="n">{kcal(day.eaten.calories ?? 0)}</div><div className="k">Food</div></div>
          <div><div className="n">{kcal(day.burned)}</div><div className="k">Exercise</div></div>
          <div><div className={'n' + (over ? ' over' : '')}>{kcal(Math.abs(day.remaining))}</div><div className="k">{over ? 'Over' : 'Left'}</div></div>
        </div>
        <div style={{ marginTop: 12 }}><Meter value={day.eaten.calories ?? 0} max={day.budget} color="var(--accent)" over={over} /></div>
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Carbs {fmt(day.eaten.carbs ?? 0, 0)}/{day.goal.carbs} g · Fat {fmt(day.eaten.fat ?? 0, 0)}/{day.goal.fat} g · Protein {fmt(day.eaten.protein ?? 0, 0)}/{day.goal.protein} g
          </span>
          <span className="link" style={{ whiteSpace: 'nowrap' }}>Nutrition</span>
        </div>
      </button>

      {settings.mealNames.map((name, i) => {
        const items = day.entries.filter((e) => e.meal === i);
        return (
          <section className="list" key={i} aria-label={name}>
            <div className="meal-head">
              <h3>{name}</h3>
              <div className="row">
                {items.length > 0 && <span className="kc">{kcal(totals(items).calories)}</span>}
                <button className="icon-btn" aria-label={`${name} options`} onClick={() => nav.push(<MealMenu date={date} meal={i} name={name} items={items} />)}><Icon name="dots" /></button>
              </div>
            </div>
            {items.map((e) => (
              <button className="item" key={e.id} onClick={() => nav.push(<FoodDetail food={e.food} entry={e} date={date} />)}>
                <span className="grow">
                  <span className="t">{e.food.name}</span>
                  <span className="s">{[e.food.brand, e.food.source === 'quick' ? null : `${fmt(e.count, 2)} × ${e.servingLabel}`].filter(Boolean).join(' · ') || 'Quick add'}</span>
                </span>
                <span className="v">{kcal(entryNutrients(e).calories)}</span>
              </button>
            ))}
            <div className="meal-foot">
              <button className="link" onClick={() => nav.push(<AddFood date={date} meal={i} />)}>Add food</button>
            </div>
          </section>
        );
      })}

      <section className="list" aria-label="Exercise">
        <div className="meal-head"><h3>Exercise</h3><div className="row">{day.burned > 0 && <span className="kc">{kcal(day.burned)}</span>}<span style={{ width: 8 }} /></div></div>
        {day.exercises.map((x) => (
          <button className="item" key={x.id} onClick={() => nav.push(<ExerciseSheet date={date} entry={x} />)}>
            <span className="grow">
              <span className="t">{x.name}</span>
              <span className="s">{[x.minutes && `${x.minutes} min`, x.sets && x.reps && `${x.sets} × ${x.reps}`, x.weight && `${x.weight} ${settings.units.weight}`].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="v">{kcal(x.calories)}</span>
          </button>
        ))}
        <div className="meal-foot"><button className="link" onClick={() => nav.push(<ExerciseSheet date={date} />)}>Add exercise</button></div>
      </section>

      <section className="list" aria-label="Water">
        <div className="meal-head"><h3>Water</h3><div className="row"><span className="kc">{waterText(day.waterMl, settings.units)}</span><span style={{ width: 8 }} /></div></div>
        <div className="meal-foot"><button className="link" onClick={() => nav.push(<WaterSheet date={date} />)}>Add water</button></div>
      </section>

      <Notes date={date} />
    </div>
  );
}

function Notes({ date }: { date: string }) {
  const saved = useLiveQuery(() => db.notes.get(date).then((n) => n?.text ?? ''), [date]);
  const [text, setText] = useState('');
  useEffect(() => { if (saved !== undefined) setText(saved); }, [saved, date]);
  const persist = async () => {
    if (text.trim()) await db.notes.put({ date, text });
    else await db.notes.delete(date);
  };
  return (
    <section className="card">
      <Field label="Notes">
        <textarea id="diary-notes" value={text} onChange={(e) => setText(e.target.value)} onBlur={persist} placeholder="How did today go?" />
      </Field>
    </section>
  );
}

function MealMenu({ date, meal, name, items }: { date: string; meal: number; name: string; items: Entry[] }) {
  const nav = useNav();
  const [target, setTarget] = useState(addDays(date, 1));
  const copyFromYesterday = async () => {
    const prev = (await db.entries.where('date').equals(addDays(date, -1)).toArray()).filter((e) => e.meal === meal);
    if (!prev.length) return nav.toast(`Nothing was logged for ${name.toLowerCase()} the day before`);
    await copyEntries(prev, date);
    nav.toast(`Copied ${prev.length} ${prev.length === 1 ? 'item' : 'items'}`);
    nav.pop();
  };
  return (
    <Sheet title={name}>
      <div className="list">
        <button className="item" onClick={copyFromYesterday}><span className="item-icon"><Icon name="copy" size={20} /></span><span className="grow"><span className="t">Copy from the day before</span><span className="s">Repeat what you logged for {name.toLowerCase()}</span></span></button>
        {items.length > 0 && (
          <>
            <button className="item" onClick={() => nav.replace(<PortionListEditor kind="meal" startItems={items.map(({ food, servingLabel, servingQty, count }) => ({ food, servingLabel, servingQty, count }))} />)}>
              <span className="item-icon"><Icon name="save" size={20} /></span><span className="grow"><span className="t">Save as a meal</span><span className="s">Log these {items.length} items together next time</span></span>
            </button>
            <button className="item" onClick={() => nav.replace(<Confirm title={`Clear ${name.toLowerCase()}?`} body={`This removes ${items.length} ${items.length === 1 ? 'item' : 'items'} from this day.`} confirmLabel="Remove all"
              onConfirm={async () => { await db.entries.bulkDelete(items.map((e) => e.id)); nav.pop(); }} />)}>
              <span className="item-icon"><Icon name="trash" size={20} /></span><span className="grow"><span className="t">Remove all items</span></span>
            </button>
          </>
        )}
      </div>
      {items.length > 0 && (
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <span className="grow"><Field label="Copy these items to"><input id="mm-date" type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></Field></span>
          <button className="btn small" style={{ minHeight: 46 }} disabled={!target} onClick={async () => { await copyEntries(items, target); nav.toast(`Copied to ${dayLabel(target).toLowerCase()}`); nav.pop(); }}>Copy</button>
        </div>
      )}
    </Sheet>
  );
}

/** Full nutrient breakdown for one day against the day's goals. */
export function DayNutrition({ date }: { date: string }) {
  const { settings } = useSettings();
  const day = useDay(date);
  return (
    <Page title={`Nutrition, ${dayLabel(date).toLowerCase()}`}>
      <NutrientTable day={day} />
      <div className="card stack">
        <h2>Calories by meal</h2>
        <div className="bar-list">
          {settings.mealNames.map((name, i) => {
            const c = totals(day.entries.filter((e) => e.meal === i)).calories ?? 0;
            return (
              <div key={i}>
                <div className="lbl"><span>{name}</span><b className="tnum">{kcal(c)} kcal</b></div>
                <Meter value={c} max={Math.max(day.eaten.calories ?? 0, 1)} color="var(--accent)" />
              </div>
            );
          })}
        </div>
      </div>
    </Page>
  );
}

export function NutrientTable({ day }: { day: Pick<DayData, 'eaten' | 'goal' | 'budget'> }) {
  const { settings } = useSettings();
  const goalFor = (key: string): number | undefined => {
    if (key === 'calories') return day.budget;
    if (key === 'carbs' || key === 'fat' || key === 'protein') return day.goal[key];
    return settings.goals.nutrients[key as keyof typeof settings.goals.nutrients];
  };
  return (
    <>
      <div className="card stack">
        <h2>Calories from macros</h2>
        <MacroSplitBar split={macroSplit(day.eaten)} />
      </div>
      <div className="card">
        <table className="data">
          <thead><tr><th>Nutrient</th><th>Total</th><th>Goal</th><th>Left</th></tr></thead>
          <tbody>
            {NUTRIENTS.map((n) => {
              const v = day.eaten[n.key] ?? 0;
              const g = goalFor(n.key);
              const left = g !== undefined ? g - v : undefined;
              return (
                <tr key={n.key}>
                  <td className={n.indent ? 'sub' : ''}>{n.short} <span className="muted">{n.unit}</span></td>
                  <td>{fmt(v, v < 10 ? 1 : 0)}</td>
                  <td>{g !== undefined ? fmt(g, 0) : '–'}</td>
                  <td className={left !== undefined && left < 0 && (n.limit || n.key === 'calories') ? 'over' : ''}>{left !== undefined ? fmt(left, Math.abs(left) < 10 ? 1 : 0) : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Vitamins and minerals count only foods whose source lists them, so those totals can read low.</p>
      </div>
    </>
  );
}
