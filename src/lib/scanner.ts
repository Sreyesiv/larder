// Barcode decoding. Uses the browser's built-in detector where it exists (Android Chrome)
// and a WebAssembly build of ZXing everywhere else (iPhone Safari, desktop).

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;

export interface Detector {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string; format: string }[]>;
}

let detectorPromise: Promise<Detector> | null = null;

export function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const Native = (globalThis as any).BarcodeDetector;
    if (Native) {
      try {
        const supported: string[] = await Native.getSupportedFormats();
        if (FORMATS.every((f) => supported.includes(f))) return new Native({ formats: FORMATS }) as Detector;
      } catch {
        // fall through to the bundled decoder
      }
    }
    const [{ BarcodeDetector, prepareZXingModule }, wasm] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ]);
    // Serve the decoder from this app's own files so scanning works offline.
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm.default : prefix + path) },
    });
    return new BarcodeDetector({ formats: [...FORMATS] }) as unknown as Detector;
  })();
  detectorPromise.catch(() => { detectorPromise = null; });
  return detectorPromise;
}

/** True when the last digit is a correct GS1 check digit (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function validCheckDigit(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let total = 0;
  digits.reverse().forEach((d, i) => { total += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (total % 10)) % 10 === check;
}

/** Expand an 8-digit UPC-E code to its 12-digit UPC-A form. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const s = code[0];
  const d = code.slice(1, 7);
  const c = code[7];
  let body: string;
  if ('012'.includes(d[5])) body = d.slice(0, 2) + d[5] + '0000' + d.slice(2, 5);
  else if (d[5] === '3') body = d.slice(0, 3) + '00000' + d.slice(3, 5);
  else if (d[5] === '4') body = d.slice(0, 4) + '00000' + d[4];
  else body = d.slice(0, 5) + '0000' + d[5];
  return s + body + c;
}

/** Clean a decoded or typed value into a product barcode, or null if it is not one. */
export function normalizeBarcode(raw: string, format?: string): string | null {
  let code = raw.replace(/\D/g, '');
  if (format === 'upc_e' && code.length === 8) code = expandUpcE(code) ?? code;
  if (code.length === 13 && code.startsWith('0') && format === 'upc_a') code = code.slice(1);
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return null;
  return code;
}

export interface CameraHandle {
  stream: MediaStream;
  torch: ((on: boolean) => Promise<void>) | null;
  stop(): void;
}

export async function openCamera(video: HTMLVideoElement): Promise<CameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('This browser cannot open the camera here.'), { name: 'NotSupportedError' });
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  await video.play().catch(() => {});
  const track = stream.getVideoTracks()[0];
  const caps: any = track.getCapabilities?.() ?? {};
  // Continuous autofocus makes close-up barcodes readable on phones that support the constraint.
  if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
    track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }).catch(() => {});
  }
  const torch = caps.torch
    ? (on: boolean) => track.applyConstraints({ advanced: [{ torch: on } as any] })
    : null;
  return { stream, torch, stop: () => stream.getTracks().forEach((t) => t.stop()) };
}

export function cameraErrorMessage(e: any): string {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access is blocked. Allow the camera for this site in your browser settings, or type the barcode below.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. Type the barcode below instead.';
    case 'NotReadableError':
      return 'The camera is in use by another app. Close it and try again.';
    default:
      return 'The camera could not be started here. You can type the barcode or use a photo instead.';
  }
}
