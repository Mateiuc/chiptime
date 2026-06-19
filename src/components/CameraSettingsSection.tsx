import { useEffect, useRef, useState } from 'react';
import { Camera as CameraIcon, RefreshCw, Play, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Capacitor } from '@capacitor/core';
import {
  listRearCameras,
  saveRearCameraId,
  clearSavedRearCameraId,
  clearProbedCameras,
  getSavedRearCameraId,
  lensKindLabel,
  type RearCamera,
} from '@/lib/cameraSelect';
import { useNotifications } from '@/hooks/useNotifications';

export const CameraSettingsSection = () => {
  const isNative = Capacitor.isNativePlatform();
  const [cameras, setCameras] = useState<RearCamera[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [testStream, setTestStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useNotifications();

  const refresh = async (rescan = false) => {
    if (isNative) return;
    setLoading(true);
    try {
      if (rescan) clearProbedCameras();
      const list = await listRearCameras();
      setCameras(list);
      setActiveId(getSavedRearCameraId());
    } catch (err) {
      console.error('Camera list failed', err);
      toast({ title: 'Could not list cameras', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh(false);
    return () => {
      testStream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTest = () => {
    testStream?.getTracks().forEach((t) => t.stop());
    setTestStream(null);
    setTestId(null);
  };

  const startTest = async (cam: RearCamera) => {
    stopTest();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setTestStream(s);
      setTestId(cam.deviceId);
      // attach on next tick
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = s;
      }, 0);
    } catch (err) {
      toast({ title: 'Could not open lens', description: String(err), variant: 'destructive' });
    }
  };

  const useThis = (cam: RearCamera) => {
    saveRearCameraId(cam.deviceId);
    setActiveId(cam.deviceId);
    toast({ title: 'Camera saved', description: `${lensKindLabel(cam.kind)} — used for VIN scan & photos` });
  };

  const autoDetect = async () => {
    clearSavedRearCameraId();
    await refresh(true);
    toast({ title: 'Auto-detect reset', description: 'The app will pick the main lens automatically.' });
  };

  if (isNative) {
    return (
      <div className="border-2 border-foreground rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2 mb-2">
          <CameraIcon className="h-5 w-5" />
          <h3 className="font-bold">Camera</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          On the installed app, your phone's camera picks the lens automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-foreground rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CameraIcon className="h-5 w-5" />
          <h3 className="font-bold">Camera</h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={autoDetect}
          disabled={loading}
          className="border-2 border-foreground"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Auto-detect
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Pick the rear lens used for VIN scan and session photos. Tap <b>Test</b> to preview each lens
        and <b>Use this</b> to save it.
      </p>

      {loading && cameras.length === 0 && (
        <p className="text-sm text-muted-foreground">Detecting cameras…</p>
      )}

      {!loading && cameras.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No rear cameras detected. Grant camera permission and try again.
        </p>
      )}

      <div className="space-y-2">
        {cameras.map((cam) => {
          const isActive = cam.deviceId === activeId;
          const zoom =
            typeof cam.zoomMin === 'number' && typeof cam.zoomMax === 'number'
              ? `${cam.zoomMin}×–${cam.zoomMax}×`
              : null;
          return (
            <div
              key={cam.deviceId}
              className={`border-2 rounded-lg p-3 ${
                isActive ? 'border-primary bg-primary/5' : 'border-foreground/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="border-2 border-foreground font-bold">
                    {lensKindLabel(cam.kind)}
                  </Badge>
                  {isActive && (
                    <Badge className="bg-primary text-primary-foreground font-bold">
                      <Check className="h-3 w-3 mr-1" /> Active
                    </Badge>
                  )}
                </div>
                {zoom && <span className="text-xs text-muted-foreground">{zoom}</span>}
              </div>

              <p className="text-xs truncate text-muted-foreground mb-2" title={cam.label}>
                {cam.label}
              </p>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startTest(cam)}
                  className="border-2 border-foreground flex-1"
                >
                  <Play className="h-4 w-4 mr-1" /> Test
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => useThis(cam)}
                  disabled={isActive}
                  className="flex-1 font-bold"
                >
                  {isActive ? 'In use' : 'Use this'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {testStream && (
        <div
          className="fixed inset-0 z-[2147483647] bg-black flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="flex-1 w-full object-contain bg-black"
          />
          <div className="p-4 flex items-center justify-between gap-3 bg-black">
            <div className="text-white font-bold">
              Preview:{' '}
              {lensKindLabel(cameras.find((c) => c.deviceId === testId)?.kind ?? 'unknown')}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={stopTest}
                className="border-2 border-white bg-transparent text-white"
              >
                <X className="h-4 w-4 mr-1" /> Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const cam = cameras.find((c) => c.deviceId === testId);
                  if (cam) useThis(cam);
                  stopTest();
                }}
                className="font-bold"
              >
                <Check className="h-4 w-4 mr-1" /> Use this lens
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
