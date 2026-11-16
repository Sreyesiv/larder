import { NUTRIENTS, fmt, kcal, type Nutrients } from '../lib/nutrition';

/** Nutrition panel laid out the way a US Nutrition Facts label is. */
export function NutritionLabel({ nutrients, serving, approx }: { nutrients: Nutrients; serving: string; approx?: boolean }) {
  const rows = NUTRIENTS.filter((n) => n.key !== 'calories' && nutrients[n.key] !== undefined);
  const firstMicro = rows.findIndex((n) => ['vitaminD', 'calcium', 'iron', 'potassium', 'vitaminA', 'vitaminC'].includes(n.key));
  return (
    <div className="facts">
      <h3>Nutrition Facts</h3>
      <div className="serv"><span>Amount</span><span>{serving}</span></div>
      <div className="cal"><b>Calories</b><b>{kcal(nutrients.calories)}</b></div>
      <div className="dvh">% Daily Value*</div>
      {rows.map((n, i) => {
        const v = nutrients[n.key]!;
        return (
          <div key={n.key} className={`line i${n.indent ?? 0}${!n.indent ? ' top' : ''}${i === firstMicro ? ' thick' : ''}`}>
            <span><b>{n.label}</b> {fmt(v)} {n.unit}</span>
            <b>{n.dv ? `${Math.round((v / n.dv) * 100)}%` : ''}</b>
          </div>
        );
      })}
      <div className="foot">
        * Percent Daily Values are based on a 2,000 calorie diet.
        {approx ? ' Values for this generic food are typical figures and vary by variety and preparation.' : ''}
        {rows.length < 6 ? ' Nutrients that are not shown were not listed by the source.' : ''}
      </div>
    </div>
  );
}
