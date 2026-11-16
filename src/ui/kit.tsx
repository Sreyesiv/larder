import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useNav } from './ctx';

const ICONS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  book: 'M5 4.5h11.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h11.5M9 8.5h6',
  plus: 'M12 5v14M5 12h14',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  menu: 'M4 7h16M4 12h16M4 17h16',
  scan: 'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M8 8.5v7M11 8.5v7M13.5 8.5v7M16 8.5v7',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14ZM20 20l-3.9-3.9',
  back: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  down: 'M5 9l7 7 7-7',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5',
  edit: 'M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17zM14.5 7.5l3 3',
  drop: 'M12 3.5c3.5 4 6 7 6 10.5a6 6 0 0 1-12 0c0-3.5 2.5-6.5 6-10.5Z',
  flame: 'M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4-3-5.5-3.5-9.5-3 1.5-4.5 4-4.5 6.5-1-.5-2-1.5-2.2-3A8.5 8.5 0 0 0 5.5 14.5 6.5 6.5 0 0 0 12 21Z',
  scale: 'M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5ZM8 9a5 5 0 0 1 8 0l-2.5 2h-3zM12 8.5l1 2',
  dumbbell: 'M3 12h18M6.5 7.5v9M17.5 7.5v9M3.5 9.5v5M20.5 9.5v5',
  bolt: 'M13 3 5 13.5h6L10.5 21 19 10.5h-6z',
  camera: 'M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 16a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 12h.01',
  pot: 'M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2.5 10h19M9 6.5c0-1 1-1.5 1-2.5M14 6.5c0-1 1-1.5 1-2.5',
  note: 'M6 4h9l4 4v12H6zM14.5 4v4.5H19M9 13h6M9 16.5h4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.8h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  dots: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'dots' ? 2.6 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] ?? ''} />
    </svg>
  );
}

/** A full-screen page that slides over the tabs. */
export function Page({ title, children, action, footer, flush }: { title: string; children: ReactNode; action?: ReactNode; footer?: ReactNode; flush?: boolean }) {
  const nav = useNav();
  return (
    <div className="page" role="dialog" aria-label={title}>
      <header className="page-head">
        <button className="icon-btn" onClick={() => nav.pop()} aria-label="Back"><Icon name="back" /></button>
        <h1>{title}</h1>
        <div className="page-action">{action}</div>
      </header>
      <div className={'page-body' + (flush ? ' flush' : '')}>{children}</div>
      {footer && <footer className="page-foot">{footer}</footer>}
    </div>
  );
}

/** A sheet that rises from the bottom for short tasks. */
export function Sheet({ title, children }: { title: string; children: ReactNode }) {
  const nav = useNav();
  return (
    <div className="sheet-wrap" role="dialog" aria-label={title}>
      <div className="sheet-backdrop" onClick={() => nav.pop()} />
      <div className="sheet">
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={() => nav.pop()} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** Confirmation sheet for destructive actions. `onConfirm` is responsible for closing it (nav.pop). */
export function Confirm({ title, body, confirmLabel, onConfirm }: { title: string; body: string; confirmLabel: string; onConfirm: () => void }) {
  const nav = useNav();
  return (
    <Sheet title={title}>
      <p className="muted" style={{ marginTop: 0 }}>{body}</p>
      <div className="stack">
        <button className="btn danger" onClick={() => onConfirm()}>{confirmLabel}</button>
        <button className="btn ghost" onClick={() => nav.pop()}>Cancel</button>
      </div>
    </Sheet>
  );
}

export function Ring({ value, max, size = 168, stroke = 14, color = 'var(--accent)', children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {frac > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${c * frac} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Meter({ value, max, color, over }: { value: number; max: number; color: string; over?: boolean }) {
  const frac = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="meter" role="img" aria-label={`${Math.round(frac * 100)} percent`}>
      <div className="meter-fill" style={{ width: `${frac * 100}%`, background: over ? 'var(--crit)' : color }} />
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={o.value === value ? 'on' : ''} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Text input for numbers that keeps what the user typed until it parses. */
export function NumInput({ value, onChange, suffix, placeholder, id, ariaLabel, autoFocus }: { value: string; onChange: (v: string) => void; suffix?: string; placeholder?: string; id?: string; ariaLabel?: string; autoFocus?: boolean }) {
  return (
    <span className="num-input">
      <input id={id} type="text" inputMode="decimal" autoComplete="off" value={value} placeholder={placeholder} aria-label={ariaLabel} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} />
      {suffix && <span className="suffix">{suffix}</span>}
    </span>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const id = useId();
  return (
    <label className="toggle-row" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="checkbox" className="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={26} /></div>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Stacked bar showing the share of calories from each macro, with a labelled legend. */
export function MacroSplitBar({ split }: { split: { carbs: number; fat: number; protein: number } }) {
  const parts = [
    { key: 'carbs', label: 'Carbs', v: split.carbs },
    { key: 'fat', label: 'Fat', v: split.fat },
    { key: 'protein', label: 'Protein', v: split.protein },
  ];
  const any = parts.some((p) => p.v > 0);
  return (
    <div className="split">
      <div className="split-bar" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round(p.v * 100)}%`).join(', ')}>
        {any ? parts.filter((p) => p.v > 0).map((p) => <span key={p.key} style={{ flexGrow: p.v, background: `var(--${p.key})` }} />) : <span style={{ flexGrow: 1, background: 'var(--track)' }} />}
      </div>
      <div className="split-legend">
        {parts.map((p) => (
          <span key={p.key}><i style={{ background: `var(--${p.key})` }} />{p.label} <b>{Math.round(p.v * 100)}%</b></span>
        ))}
      </div>
    </div>
  );
}

/** Calls `fn` after `value` has stayed unchanged for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
