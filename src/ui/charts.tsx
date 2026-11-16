import { useRef, useState, type PointerEvent } from 'react';

const W = 340;
const M = { l: 38, r: 10, t: 12, b: 22 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) { max = min + 1; }
  const raw = (max - min) / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) out.push(+v.toFixed(6));
  return out;
}

function useHover(count: number, xOf: (i: number) => number) {
  const ref = useRef<SVGSVGElement>(null);
  const [idx, setIdx] = useState<number | null>(null);
  const onMove = (e: PointerEvent) => {
    const el = ref.current;
    if (!el || count === 0) return;
    const box = el.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < count; i++) if (Math.abs(xOf(i) - x) < Math.abs(xOf(best) - x)) best = i;
    setIdx(best);
  };
  return { ref, idx, bind: { onPointerMove: onMove, onPointerDown: onMove, onPointerLeave: () => setIdx(null) } };
}

export interface Point { x: number; label: string; y: number }

/** Line over time with an optional dashed target line. `x` values are day offsets. */
export function LineChart({ points, xMax, goal, format, xLabels, height = 180, seriesName, goalName }: {
  points: Point[]; xMax: number; goal?: number; format: (v: number) => string; xLabels: { x: number; text: string }[]; height?: number; seriesName: string; goalName?: string;
}) {
  const H = height;
  const ys = points.map((p) => p.y).concat(goal !== undefined ? [goal] : []);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const pad = Math.max((hi - lo) * 0.15, hi * 0.005, 0.5);
  const ticks = niceTicks(lo - pad, hi + pad, 4);
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const sx = (x: number) => M.l + (xMax > 0 ? x / xMax : 0.5) * (W - M.l - M.r);
  const sy = (y: number) => H - M.b - ((y - y0) / (y1 - y0)) * (H - M.t - M.b);
  const hover = useHover(points.length, (i) => sx(points[i].x));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  const h = hover.idx !== null ? points[hover.idx] : null;
  const last = points[points.length - 1];

  return (
    <div className="chart">
      {h && <div className="chart-tip" style={{ left: `${(sx(h.x) / W) * 100}%` }}><small>{h.label}</small>{format(h.y)}</div>}
      <svg ref={hover.ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${seriesName} over time`} {...hover.bind}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} />
            <text x={M.l - 6} y={sy(t) + 4} textAnchor="end">{format(t).replace(/[^\d.,-]/g, '')}</text>
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text key={i} x={sx(l.x)} y={H - 6} textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}>{l.text}</text>
        ))}
        {goal !== undefined && <line x1={M.l} x2={W - M.r} y1={sy(goal)} y2={sy(goal)} stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="5 4" />}
        {h && <line className="axis" x1={sx(h.x)} x2={sx(h.x)} y1={M.t} y2={H - M.b} />}
        {points.length > 1 && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {points.length <= 31 && points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.5" fill="var(--accent)" />)}
        {last && <circle cx={sx(last.x)} cy={sy(last.y)} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />}
        {h && <circle cx={sx(h.x)} cy={sy(h.y)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />}
      </svg>
      {goal !== undefined && goalName && (
        <div className="legend">
          <span><i style={{ borderColor: 'var(--accent)' }} />{seriesName}</span>
          <span><i className="dash" style={{ borderColor: 'var(--muted)' }} />{goalName} {format(goal)}</span>
        </div>
      )}
    </div>
  );
}

/** One bar per day with an optional dashed goal line. Missing days are drawn as gaps. */
export function BarChart({ bars, goal, format, height = 170, seriesName, goalName }: {
  bars: { label: string; value: number | null }[]; goal?: number; format: (v: number) => string; height?: number; seriesName: string; goalName?: string;
}) {
  const H = height;
  const hi = Math.max(goal ?? 0, ...bars.map((b) => b.value ?? 0), 1);
  const ticks = niceTicks(0, hi * 1.05, 4);
  const y1 = ticks[ticks.length - 1];
  const inner = W - M.l - M.r;
  const slot = inner / bars.length;
  const bw = Math.max(1.5, Math.min(22, slot - 2));
  const cx = (i: number) => M.l + slot * (i + 0.5);
  const sy = (y: number) => H - M.b - (y / y1) * (H - M.t - M.b);
  const hover = useHover(bars.length, cx);
  const h = hover.idx !== null ? bars[hover.idx] : null;
  const r = Math.min(4, bw / 2);
  const labelAt = [0, Math.floor((bars.length - 1) / 2), bars.length - 1].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="chart">
      {h && hover.idx !== null && <div className="chart-tip" style={{ left: `${(cx(hover.idx) / W) * 100}%` }}><small>{h.label}</small>{h.value === null ? 'Nothing logged' : format(h.value)}</div>}
      <svg ref={hover.ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${seriesName} per day`} {...hover.bind}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} />
            <text x={M.l - 6} y={sy(t) + 4} textAnchor="end">{t.toLocaleString('en-US')}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          if (b.value === null || b.value <= 0) return null;
          const top = sy(b.value);
          const base = H - M.b;
          const x = cx(i) - bw / 2;
          const rr = Math.min(r, base - top);
          return <path key={i} opacity={hover.idx === null || hover.idx === i ? 1 : 0.55} fill="var(--accent)"
            d={`M${x} ${base}V${top + rr}a${rr} ${rr} 0 0 1 ${rr}-${rr}h${bw - 2 * rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}V${base}Z`} />;
        })}
        <line className="axis" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
        {goal !== undefined && <line x1={M.l} x2={W - M.r} y1={sy(goal)} y2={sy(goal)} stroke="var(--ink-2)" strokeWidth="1.5" strokeDasharray="5 4" />}
        {labelAt.map((i, n) => (
          <text key={i} x={n === 0 ? M.l : n === labelAt.length - 1 ? W - M.r : cx(i)} y={H - 6} textAnchor={n === 0 ? 'start' : n === labelAt.length - 1 ? 'end' : 'middle'}>{bars[i].label}</text>
        ))}
      </svg>
      {goal !== undefined && goalName && (
        <div className="legend">
          <span><i className="box" style={{ background: 'var(--accent)' }} />{seriesName}</span>
          <span><i className="dash" style={{ borderColor: 'var(--ink-2)' }} />{goalName} {format(goal)}</span>
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const hgt = 30;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [3 + (i / (values.length - 1)) * (w - 6), 4 + (1 - (v - lo) / span) * (hgt - 8)]);
  const lastPt = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${hgt}`} width="100%" height={hgt} preserveAspectRatio="none" aria-hidden="true" style={{ marginTop: 8 }}>
      <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill="var(--accent)" />
    </svg>
  );
}
