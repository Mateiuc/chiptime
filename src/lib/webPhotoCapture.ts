import {
  pickMainRearCameraId,
  nextRearCameraId,
  saveRearCameraId,
  lensKindLabel,
  type RearCamera,
} from './cameraSelect';

/**
 * Web-only photo capture using getUserMedia, preferring the main rear lens.
 * Includes a "Lens" button so the user can manually cycle through rear cameras
 * on multi-camera phones where label-based detection is unreliable (Samsung).
 * Returns a base64-encoded JPEG (no data: prefix) or null if cancelled / failed.
 */
export async function captureSessionPhotoWeb(): Promise<string | null> {
  let stream: MediaStream | null = null;
  let currentDeviceId: string | null = await pickMainRearCameraId();

  const openStream = async (deviceId: string | null): Promise<MediaStream | null> => {
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch {
        // fall through
      }
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch {
      return null;
    }
  };

  stream = await openStream(currentDeviceId);
  if (!stream) return null;

  const applyDefaults = async (s: MediaStream) => {
    try {
      const t = s.getVideoTracks()[0];
      await t?.applyConstraints({
        advanced: [{ focusMode: 'continuous' } as any, { zoom: 1 } as any],
      });
    } catch {
      // ignore
    }
  };
  await applyDefaults(stream);

  return new Promise<string | null>((resolve) => {
    const cleanup = () => {
      stream?.getTracks().forEach((t) => t.stop());
      overlay.remove();
    };

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;flex-direction:column;';

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;
    video.style.cssText = 'flex:1;width:100%;object-fit:contain;background:#000;';
    overlay.appendChild(video);

    const bar = document.createElement('div');
    bar.style.cssText =
      'display:flex;gap:12px;justify-content:space-between;align-items:center;padding:16px;background:#000;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText =
      'padding:12px 20px;border-radius:8px;border:2px solid #fff;background:transparent;color:#fff;font-size:16px;font-weight:600;';
    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };

    // Lens switcher (cycles through rear cameras)
    const lensBtn = document.createElement('button');
    lensBtn.style.cssText =
      'padding:8px 14px;border-radius:8px;border:2px solid #fff;background:transparent;color:#fff;font-size:13px;font-weight:600;display:flex;flex-direction:column;align-items:center;line-height:1.1;';
    lensBtn.innerHTML = '<span>Lens</span><span style="font-size:11px;opacity:0.85;margin-top:2px" data-kind>...</span>';
    const setLensLabel = (cam: RearCamera | null) => {
      const span = lensBtn.querySelector('[data-kind]') as HTMLSpanElement | null;
      if (span) span.textContent = cam ? lensKindLabel(cam.kind) : '—';
    };
    // Initial label
    (async () => {
      const first = await nextRearCameraId(null);
      if (currentDeviceId) {
        const list = await import('./cameraSelect').then((m) => m.listRearCameras());
        const match = list.find((c) => c.deviceId === currentDeviceId) || first;
        setLensLabel(match);
      } else {
        setLensLabel(first);
      }
    })();

    lensBtn.onclick = async () => {
      lensBtn.disabled = true;
      try {
        const next = await nextRearCameraId(currentDeviceId);
        if (!next) return;
        const newStream = await openStream(next.deviceId);
        if (!newStream) return;
        // Replace stream
        stream?.getTracks().forEach((t) => t.stop());
        stream = newStream;
        video.srcObject = newStream;
        currentDeviceId = next.deviceId;
        saveRearCameraId(next.deviceId);
        setLensLabel(next);
        await applyDefaults(newStream);
        rebuildTorch();
      } finally {
        lensBtn.disabled = false;
      }
    };

    const captureBtn = document.createElement('button');
    captureBtn.textContent = 'Capture';
    captureBtn.style.cssText =
      'padding:14px 28px;border-radius:8px;border:2px solid #fff;background:#fff;color:#000;font-size:16px;font-weight:700;';
    captureBtn.onclick = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) {
          cleanup();
          resolve(null);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        cleanup();
        resolve(base64);
      } catch {
        cleanup();
        resolve(null);
      }
    };

    bar.appendChild(cancelBtn);
    bar.appendChild(lensBtn);
    bar.appendChild(captureBtn);

    // Torch toggle — rebuilt when lens changes (capabilities differ per lens)
    let torchBtn: HTMLButtonElement | null = null;
    const rebuildTorch = () => {
      if (torchBtn) {
        torchBtn.remove();
        torchBtn = null;
      }
      try {
        const track = stream!.getVideoTracks()[0];
        const caps: any = track?.getCapabilities?.();
        if (!caps?.torch) return;
        let on = false;
        torchBtn = document.createElement('button');
        torchBtn.textContent = 'Torch';
        torchBtn.style.cssText =
          'padding:12px 20px;border-radius:8px;border:2px solid #fff;background:transparent;color:#fff;font-size:16px;font-weight:600;';
        torchBtn.onclick = async () => {
          on = !on;
          try {
            await track.applyConstraints({ advanced: [{ torch: on } as any] });
            torchBtn!.style.background = on ? '#fff' : 'transparent';
            torchBtn!.style.color = on ? '#000' : '#fff';
          } catch {
            // ignore
          }
        };
        bar.insertBefore(torchBtn, captureBtn);
      } catch {
        // ignore
      }
    };
    rebuildTorch();

    overlay.appendChild(bar);
    document.body.appendChild(overlay);
  });
}
