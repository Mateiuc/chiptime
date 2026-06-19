// Picks the main rear (wide) camera device id, avoiding ultra-wide / telephoto / depth / mono lenses.
// Returns null if enumeration is not available or no candidate is found.
export async function pickMainRearCameraId(): Promise<string | null> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return null;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    if (!cams.length) return null;

    const rear = cams.filter((d) => /back|rear|environment/i.test(d.label));
    const pool = rear.length ? rear : cams;

    const isBad = (l: string) =>
      /ultra[\s-]?wide|0\.5x|telephoto|\btele\b|depth|mono|infrared|\bir\b/i.test(l);
    const candidates = pool.filter((d) => !isBad(d.label));

    const preferred = candidates.find(
      (d) =>
        /(^|[^a-z])(wide|main|1x|back camera)([^a-z]|$)/i.test(d.label) &&
        !/ultra/i.test(d.label),
    );
    return (preferred || candidates[0] || pool[0])?.deviceId || null;
  } catch {
    return null;
  }
}
