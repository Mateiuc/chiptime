// Rear-camera selection that does NOT rely on label text (Android Chrome / Samsung
// often returns generic or localized labels). We open each candidate briefly,
// read MediaStreamTrack capabilities/settings, and classify by zoom range.

export type RearLensKind = 'main' | 'ultrawide' | 'tele' | 'unknown';

export interface RearCamera {
  deviceId: string;
  label: string;
  kind: RearLensKind;
  zoomMin?: number;
  zoomMax?: number;
  facingMode?: string;
}

const LS_USER_PICK = 'chiptime.rearCameraId';
const SS_PROBED_LIST = 'chiptime.rearCameras.v1';
const SS_PROBED_PICK = 'chiptime.rearCameras.pick.v1';

// ----- public storage helpers ------------------------------------------------

export function getSavedRearCameraId(): string | null {
  try {
    return localStorage.getItem(LS_USER_PICK);
  } catch {
    return null;
  }
}

export function saveRearCameraId(deviceId: string): void {
  try {
    localStorage.setItem(LS_USER_PICK, deviceId);
  } catch {
    // ignore
  }
  // Invalidate the session "auto-pick" cache so the next caller picks up
  // the user's choice instead of returning the stale auto-detected lens.
  try {
    sessionStorage.setItem(SS_PROBED_PICK, deviceId);
  } catch {
    // ignore
  }
}

export function clearSavedRearCameraId(): void {
  try {
    localStorage.removeItem(LS_USER_PICK);
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(SS_PROBED_PICK);
  } catch {
    // ignore
  }
}

/** Wipes the per-session probe cache so listRearCameras() will re-probe. */
export function clearProbedCameras(): void {
  try {
    sessionStorage.removeItem(SS_PROBED_LIST);
    sessionStorage.removeItem(SS_PROBED_PICK);
  } catch {
    // ignore
  }
}

// ----- internals -------------------------------------------------------------

async function primePermissions(): Promise<void> {
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    s.getTracks().forEach((t) => t.stop());
  } catch {
    // ignore; user may still allow per-device prompts
  }
}

function classifyByZoom(zoomMin?: number, zoomMax?: number, label?: string): RearLensKind {
  // Strong hints from the lens label (best-effort, not required).
  if (label) {
    if (/ultra[\s-]?wide|0\.5x/i.test(label)) return 'ultrawide';
    if (/telephoto|\btele\b|2x|3x|5x/i.test(label)) return 'tele';
    if (/depth|mono|infrared|\bir\b/i.test(label)) return 'unknown';
  }
  // Zoom capability gives a reliable signal on Android Chrome.
  // Ultra-wide lenses report zoom.min < 1 (typically 0.5).
  // Telephoto lenses report zoom.min > 1 (typically 2–3).
  // Main lens reports zoom.min === 1 (or no zoom capability at all).
  if (typeof zoomMin === 'number') {
    if (zoomMin < 0.95) return 'ultrawide';
    if (zoomMin > 1.05) return 'tele';
    return 'main';
  }
  return 'unknown';
}

async function probeDevice(deviceId: string, label: string): Promise<RearCamera | null> {
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
    });
    const track = stream.getVideoTracks()[0];
    const caps: any = track?.getCapabilities ? track.getCapabilities() : {};
    const settings: any = track?.getSettings ? track.getSettings() : {};
    const facingMode: string | undefined = settings?.facingMode;

    // Skip user-facing (front) cameras.
    if (facingMode === 'user') return null;
    // If facing mode is unknown, also accept (some Android browsers omit it).
    const zoomMin = caps?.zoom?.min;
    const zoomMax = caps?.zoom?.max;
    const kind = classifyByZoom(zoomMin, zoomMax, label);

    return {
      deviceId,
      label: label || `Camera ${deviceId.slice(0, 6)}`,
      kind,
      zoomMin,
      zoomMax,
      facingMode,
    };
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

// ----- public api ------------------------------------------------------------

/**
 * Returns all available rear-facing cameras with a classification of each lens.
 * Result is cached in sessionStorage so we only probe lenses once per session.
 */
export async function listRearCameras(): Promise<RearCamera[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];

  try {
    const cached = sessionStorage.getItem(SS_PROBED_LIST);
    if (cached) {
      const parsed = JSON.parse(cached) as RearCamera[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    // ignore
  }

  await primePermissions();

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((d) => d.kind === 'videoinput');
  if (!videoInputs.length) return [];

  // Pre-filter obvious front cameras by label when possible.
  const obviouslyFront = (l: string) => /front|user|selfie|face/i.test(l);
  const pool = videoInputs.filter((d) => !obviouslyFront(d.label));

  const results: RearCamera[] = [];
  for (const d of pool) {
    const r = await probeDevice(d.deviceId, d.label);
    if (r) results.push(r);
  }

  // Sort: main first, then unknown, then tele, then ultrawide.
  const order: Record<RearLensKind, number> = { main: 0, unknown: 1, tele: 2, ultrawide: 3 };
  results.sort((a, b) => order[a.kind] - order[b.kind]);

  try {
    sessionStorage.setItem(SS_PROBED_LIST, JSON.stringify(results));
  } catch {
    // ignore
  }
  return results;
}

/**
 * Returns the deviceId of the preferred rear camera. Preference order:
 *   1) User's last manual pick (localStorage), if still present.
 *   2) Probed "main" lens.
 *   3) First non-ultrawide rear lens.
 *   4) First rear lens.
 *   5) null (caller should fall back to `facingMode: 'environment'`).
 */
export async function pickMainRearCameraId(): Promise<string | null> {
  // Fast path: cached probe result from this session.
  try {
    const cachedPick = sessionStorage.getItem(SS_PROBED_PICK);
    if (cachedPick) return cachedPick;
  } catch {
    // ignore
  }

  const userPick = getSavedRearCameraId();
  const cams = await listRearCameras();

  if (userPick && cams.some((c) => c.deviceId === userPick)) {
    try {
      sessionStorage.setItem(SS_PROBED_PICK, userPick);
    } catch {
      /* ignore */
    }
    return userPick;
  }

  const main = cams.find((c) => c.kind === 'main');
  const nonUltra = cams.find((c) => c.kind !== 'ultrawide');
  const winner = main?.deviceId || nonUltra?.deviceId || cams[0]?.deviceId || null;

  if (winner) {
    try {
      sessionStorage.setItem(SS_PROBED_PICK, winner);
    } catch {
      /* ignore */
    }
  }
  return winner;
}


export function lensKindLabel(kind: RearLensKind): string {
  switch (kind) {
    case 'main':
      return 'Main';
    case 'ultrawide':
      return 'Ultra';
    case 'tele':
      return 'Tele';
    default:
      return 'Cam';
  }
}
