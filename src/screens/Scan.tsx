import { useCallback, useEffect, useRef, useState } from 'react';
import { lookupBarcode } from '../lib/lookup';
import type { Portion } from '../lib/nutrition';
import { cameraErrorMessage, getDetector, normalizeBarcode, openCamera, validCheckDigit, type CameraHandle } from '../lib/scanner';
import { useNav, useSettings } from '../ui/ctx';
import { Icon } from '../ui/kit';
import { FoodDetail } from './FoodDetail';
import { FoodEditor } from './FoodEditor';

type Phase =
  | { kind: 'starting' }
  | { kind: 'scanning' }
  | { kind: 'looking'; code: string }
  | { kind: 'notfound'; code: string }
  | { kind: 'error'; code: string; message: string };

export function Scan({ date, meal, onPick }: { date: string; meal?: number; onPick?: (p: Portion) => void }) {
  const nav = useNav();
  const { settings } = useSettings();
  const video = useRef<HTMLVideoElement>(null);
  const cam = useRef<CameraHandle | null>(null);
  const paused = useRef(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const [camError, setCamError] = useState('');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState('');

  const showFood = useCallback((food: Parameters<typeof FoodDetail>[0]['food']) => {
    nav.replace(<FoodDetail food={food} date={date} meal={meal} onPick={onPick} pickLabel={onPick ? 'Add' : undefined} />);
  }, [nav, date, meal, onPick]);

  const handleCode = useCallback(async (code: string) => {
    paused.current = true;
    setPhase({ kind: 'looking', code });
    navigator.vibrate?.(40);
    try {
      const hit = await lookupBarcode(code, settings.usdaKey);
      if (hit) showFood(hit.food);
      else setPhase({ kind: 'notfound', code });
    } catch (e: any) {
      setPhase({ kind: 'error', code, message: e?.message ?? 'The lookup failed. Try again.' });
    }
  }, [settings.usdaKey, showFood]);

  const resume = () => { paused.current = false; setPhase({ kind: camError ? 'starting' : 'scanning' }); };

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const el = video.current!;
      try {
        const handle = await openCamera(el);
        if (!alive) return handle.stop();
        cam.current = handle;
        setHasTorch(!!handle.torch);
        setPhase((p) => (p.kind === 'starting' ? { kind: 'scanning' } : p));
      } catch (e) {
        if (alive) setCamError(cameraErrorMessage(e));
        return;
      }
      let detector;
      try {
        detector = await getDetector();
      } catch {
        if (alive) setCamError('The barcode reader could not be loaded. Check your connection once, then it works offline. You can still type the barcode below.');
        return;
      }
      let last = '';
      let busy = false;
      timer = setInterval(async () => {
        if (!alive || busy || paused.current || el.readyState < 2) return;
        busy = true;
        try {
          for (const r of await detector.detect(el)) {
            const code = normalizeBarcode(r.rawValue, r.format);
            if (!code || !validCheckDigit(code)) continue;
            // Require the same value on two frames in a row before trusting it.
            if (code === last) { last = ''; void handleCode(code); } else last = code;
            break;
          }
        } catch {
          // a frame that fails to decode is simply skipped
        }
        busy = false;
      }, 130);
    })();
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      cam.current?.stop();
      cam.current = null;
    };
    // The camera is opened once per visit to this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTorch = async () => {
    try {
      await cam.current?.torch?.(!torchOn);
      setTorchOn(!torchOn);
    } catch {
      setHasTorch(false);
    }
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeBarcode(manual);
    if (!code) return setManualError('A barcode has 8, 12, 13 or 14 digits.');
    if (!validCheckDigit(code)) return setManualError('Those digits do not form a valid barcode. Check for a typo.');
    setManualError('');
    void handleCode(code);
  };

  const fromPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const detector = await getDetector();
      const bitmap = await createImageBitmap(file);
      const hits = await detector.detect(bitmap);
      bitmap.close?.();
      for (const r of hits) {
        const code = normalizeBarcode(r.rawValue, r.format);
        if (code && validCheckDigit(code)) return void handleCode(code);
      }
      setManualError('No barcode was found in that photo. Try again with the barcode filling the frame.');
    } catch {
      setManualError('That photo could not be read.');
    }
  };

  const busy = phase.kind === 'looking';
  return (
    <div className="scan" role="dialog" aria-label="Scan a barcode">
      <video ref={video} playsInline muted autoPlay />
      <div className="scan-top">
        <button className="icon-btn" aria-label="Close scanner" onClick={() => nav.pop()}><Icon name="close" /></button>
        {hasTorch && <button className={'icon-btn' + (torchOn ? ' lit' : '')} aria-label="Toggle flashlight" aria-pressed={torchOn} onClick={toggleTorch}><Icon name="bolt" /></button>}
      </div>

      <div className="scan-mid">
        {camError ? (
          <p className="scan-hint" role="alert">{camError}</p>
        ) : (
          <>
            <div className="reticle" />
            <p className="scan-hint">{phase.kind === 'starting' ? 'Starting camera…' : 'Hold the barcode inside the frame'}</p>
          </>
        )}
      </div>

      <div className="scan-panel">
        {busy && <div className="row"><span className="spinner" /><span>Looking up <b className="tnum">{phase.code}</b>…</span></div>}

        {phase.kind === 'notfound' && (
          <>
            <div><b>No match for <span className="tnum">{phase.code}</span></b><p className="muted" style={{ fontSize: 14 }}>This product is not in the food database yet. Add it once from the label and the scanner will recognise it from then on.</p></div>
            <button className="btn" onClick={() => nav.replace(<FoodEditor barcode={phase.code} onSaved={showFood} />)}>Add this product</button>
            <button className="btn ghost" onClick={resume}>Scan again</button>
          </>
        )}

        {phase.kind === 'error' && (
          <>
            <div className="banner warn" role="alert"><Icon name="info" size={20} /><span>{phase.message}</span></div>
            <button className="btn" onClick={() => handleCode(phase.code)}>Try again</button>
            <button className="btn ghost" onClick={resume}>Scan a different barcode</button>
          </>
        )}

        {(phase.kind === 'scanning' || phase.kind === 'starting') && (
          <>
            <form className="scan-manual" onSubmit={submitManual}>
              <input id="scan-manual" type="text" inputMode="numeric" autoComplete="off" placeholder="Or type the barcode number" aria-label="Barcode number" value={manual} onChange={(e) => { setManual(e.target.value); setManualError(''); }} />
              <button className="btn" type="submit" disabled={!manual.trim()}>Look up</button>
            </form>
            {manualError && <span className="over" role="alert" style={{ fontSize: 13 }}>{manualError}</span>}
            <label className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Icon name="camera" size={18} />Use a photo of the barcode
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void fromPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
