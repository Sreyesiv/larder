import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type Settings, loadSettings, saveSettings } from './lib/db';
import { dayKey } from './lib/util';
import { DepthCtx, NavCtx, SettingsCtx, useNav, type Nav } from './ui/ctx';
import { Icon, Sheet } from './ui/kit';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { Diary } from './screens/Diary';
import { Progress } from './screens/Progress';
import { More } from './screens/More';
import { AddFood } from './screens/AddFood';
import { Scan } from './screens/Scan';
import { ExerciseSheet, WaterSheet, WeightSheet } from './screens/Trackers';

type Tab = 'today' | 'diary' | 'progress' | 'more';

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    // Some browsers refuse on-device storage (certain private modes and in-app browsers).
    // Say so plainly instead of leaving a blank screen.
    loadSettings().then(setSettings).catch(() => setStorageError(true));
  }, []);

  const update = useCallback((fn: (s: Settings) => Settings) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      void saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!settings || settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings?.theme]);

  const ctx = useMemo(() => (settings ? { settings, update } : null), [settings, update]);
  if (storageError) {
    return (
      <div className="app">
        <div className="onb">
          <h1>Larder can’t save data in this browser</h1>
          <p className="lede">This usually means private browsing is on, or the page was opened inside another app. Open it in Safari or Chrome in a normal tab and try again.</p>
        </div>
      </div>
    );
  }
  if (!ctx) return <div className="app" />;
  return (
    <SettingsCtx.Provider value={ctx}>
      <div className="app">{ctx.settings.onboarded ? <Shell /> : <Onboarding />}</div>
    </SettingsCtx.Provider>
  );
}

/** The current local day, refreshed when the app returns to the foreground. */
function useToday(): string {
  const [today, setToday] = useState(dayKey());
  useEffect(() => {
    const tick = () => setToday(dayKey());
    document.addEventListener('visibilitychange', tick);
    const t = setInterval(tick, 60_000);
    return () => { document.removeEventListener('visibilitychange', tick); clearInterval(t); };
  }, []);
  return today;
}

function Shell() {
  const today = useToday();
  const [tab, setTab] = useState<Tab>('today');
  const [date, setDate] = useState(today);
  const [stack, setStack] = useState<{ id: number; node: ReactNode }[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const seq = useRef(0);
  const depth = useRef(0);
  depth.current = stack.length;

  // Each open page is a browser history entry, so the phone's back gesture closes it.
  useEffect(() => {
    history.replaceState({ ov: 0 }, '');
    const onPop = (e: PopStateEvent) => {
      const n = Math.max(0, Number(e.state?.ov ?? 0));
      setStack((s) => (n < s.length ? s.slice(0, n) : s));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const nav = useMemo<Nav>(() => ({
    push(node) {
      const n = depth.current + 1;
      depth.current = n;
      history.pushState({ ov: n }, '');
      setStack((s) => [...s, { id: ++seq.current, node }]);
    },
    pop(n = 1) {
      const k = Math.min(n, depth.current);
      if (k > 0) history.go(-k);
    },
    popTo(d) {
      const k = depth.current - Math.max(0, d);
      if (k > 0) history.go(-k);
    },
    replace(node) {
      setStack((s) => [...s.slice(0, -1), { id: ++seq.current, node }]);
    },
    toast(text) {
      setToast({ id: ++seq.current, text });
    },
  }), []);

  const openDiary = useCallback((d: string) => { setDate(d); setTab('diary'); }, []);
  // While a page or sheet is open, the tabs behind it are taken out of focus order and the accessibility tree.
  const covered = stack.length > 0 ? ({ inert: '' } as object) : {};

  return (
    <NavCtx.Provider value={nav}>
      <main className="tab-view" key={tab} {...covered}>
        {tab === 'today' && <Today today={today} openDiary={openDiary} />}
        {tab === 'diary' && <Diary date={date} setDate={setDate} today={today} />}
        {tab === 'progress' && <Progress today={today} />}
        {tab === 'more' && <More />}
      </main>

      <nav className="tabbar" aria-label="Sections" {...covered}>
        <TabBtn icon="home" label="Today" on={tab === 'today'} onClick={() => setTab('today')} />
        <TabBtn icon="book" label="Diary" on={tab === 'diary'} onClick={() => { if (tab !== 'diary') setDate(today); setTab('diary'); }} />
        <button className="fab" aria-label="Add" onClick={() => nav.push(<AddMenu date={tab === 'diary' ? date : today} />)}><Icon name="plus" size={26} /></button>
        <TabBtn icon="chart" label="Progress" on={tab === 'progress'} onClick={() => setTab('progress')} />
        <TabBtn icon="menu" label="More" on={tab === 'more'} onClick={() => setTab('more')} />
      </nav>

      {stack.map((s, i) => (
        <DepthCtx.Provider key={s.id} value={i + 1}>{s.node}</DepthCtx.Provider>
      ))}
      {toast && <div className="toast" key={toast.id} role="status">{toast.text}</div>}
    </NavCtx.Provider>
  );
}

function TabBtn({ icon, label, on, onClick }: { icon: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} onClick={onClick}>
      <Icon name={icon} />
      {label}
    </button>
  );
}

function AddMenu({ date }: { date: string }) {
  const nav = useNav();
  const open = (node: ReactNode) => nav.replace(node);
  const items: { icon: string; title: string; sub: string; node: ReactNode }[] = [
    { icon: 'scan', title: 'Scan a barcode', sub: 'Point the camera at a package', node: <Scan date={date} /> },
    { icon: 'search', title: 'Search for a food', sub: 'Your foods, common foods and packaged products', node: <AddFood date={date} /> },
    { icon: 'dumbbell', title: 'Log exercise', sub: 'Cardio or strength', node: <ExerciseSheet date={date} /> },
    { icon: 'drop', title: 'Log water', sub: 'Add to today’s total', node: <WaterSheet date={date} /> },
    { icon: 'scale', title: 'Log weight', sub: 'Weight, body fat, waist', node: <WeightSheet date={date} /> },
  ];
  return (
    <Sheet title="Add">
      <div className="list">
        {items.map((it) => (
          <button key={it.title} className="item" onClick={() => open(it.node)}>
            <span className="item-icon"><Icon name={it.icon} size={20} /></span>
            <span className="grow">
              <span className="t">{it.title}</span>
              <span className="s">{it.sub}</span>
            </span>
            <Icon name="right" size={18} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
