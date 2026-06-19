import { pickMainRearCameraId } from './cameraSelect';

/**
 * Web-only photo capture using getUserMedia, preferring the main rear lens.
 * Returns a base64-encoded JPEG (no data: prefix) or null if cancelled / failed.
 */
export async function captureSessionPhotoWeb(): Promise<string | null> {
  // Prime permissions so device labels resolve
  try {
    const priming = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    priming.getTracks().forEach((t) => t.stop());
  } catch {
    // ignore
  }

  let stream: MediaStream | null = null;
  const deviceId = await pickMainRearCameraId();
  if (deviceId) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch {
      stream = null;
    }
  }
  if (!stream) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch {
      return null;
    }
  }

  // Encourage main lens + continuous focus
  try {
    const track = stream.getVideoTracks()[0];
    await track?.applyConstraints({
      advanced: [{ focusMode: 'continuous' } as any, { zoom: 1 } as any],
    });
  } catch {
    // ignore
  }

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
    bar.appendChild(captureBtn);

    // Optional torch toggle if supported
    try {
      const track = stream!.getVideoTracks()[0];
      const caps: any = track?.getCapabilities?.();
      if (caps?.torch) {
        let on = false;
        const torchBtn = document.createElement('button');
        torchBtn.textContent = 'Torch';
        torchBtn.style.cssText =
          'padding:12px 20px;border-radius:8px;border:2px solid #fff;background:transparent;color:#fff;font-size:16px;font-weight:600;';
        torchBtn.onclick = async () => {
          on = !on;
          try {
            await track.applyConstraints({ advanced: [{ torch: on } as any] });
            torchBtn.style.background = on ? '#fff' : 'transparent';
            torchBtn.style.color = on ? '#000' : '#fff';
          } catch {
            // ignore
          }
        };
        bar.insertBefore(torchBtn, captureBtn);
      }
    } catch {
      // ignore
    }

    overlay.appendChild(bar);
    document.body.appendChild(overlay);
  });
}
