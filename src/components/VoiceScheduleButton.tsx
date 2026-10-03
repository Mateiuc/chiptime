// Developed by Chip
// Voice → schedule draft. Speech is captured free in the browser (Web Speech
// API); understanding the sentence is done by the app's AI (Claude) so the
// client, car, date and work can be picked out of free-form speech. If the AI
// is unreachable we fall back to fully offline parsing (chrono + fuse).
import { useEffect, useRef, useState } from 'react';
import * as chrono from 'chrono-node';
import Fuse from 'fuse.js';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';

// Minimal local typings for webkitSpeechRecognition so we don't pull extra @types.
interface SRAlternative { transcript: string }
interface SRResult { 0: SRAlternative; isFinal: boolean; length: number }
interface SREvent { results: ArrayLike<SRResult> & { length: number }; resultIndex: number }
interface SRErrorEvent { error: string }
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SRCtor = new () => SpeechRecognitionLike;

export interface VoiceContext {
  clients: { id: string; name: string }[];
  vehicles: { id: string; clientId: string; make?: string; model?: string; year?: number; color?: string }[];
  workers: { id: string; firstName: string }[];
}

export interface VoiceDraft {
  clientId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  vehicleId: string | null;
  carInfo: string | null;
  assignedTo: string | null;
  date: string | null; // YYYY-MM-DD local
  time: string | null; // HH:mm 24h local
  requestedWork: string;
  notes: string | null;
}

interface Props {
  context: VoiceContext;
  onParsed: (draft: VoiceDraft, transcript: string) => void;
  /** Spoken language, e.g. 'en-US'. */
  lang?: string;
}


const pad = (n: number) => String(n).padStart(2, '0');

const getSRCtor = (): SRCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripSpans = (raw: string, spans: string[]): string => {
  let out = raw;
  for (const span of spans) {
    if (!span) continue;
    out = out.replace(new RegExp(escapeReg(span), 'ig'), ' ');
  }
  // collapse commas + whitespace, trim dangling fillers
  out = out.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/(,\s*)+/g, ', ');
  out = out.replace(/^[\s,]+|[\s,]+$/g, '');
  out = out.replace(/\b(for|on|at)\b\s*$/i, '').trim();
  out = out.replace(/^\s*(for|on|at)\b\s*/i, '').trim();
  out = out.replace(/\s{2,}/g, ' ');
  return out;
};

const parseTranscript = (raw: string, ctx: VoiceContext): VoiceDraft => {
  const spans: string[] = [];
  let date: string | null = null;
  let time: string | null = null;

  // 1. date + time
  try {
    const results = chrono.parse(raw, new Date());
    if (results.length > 0) {
      const m = results[0];
      const d = m.start.date();
      date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (m.start.isCertain('hour')) {
        time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      spans.push(m.text);
    }
  } catch { /* noop */ }

  // 2. client
  let clientId: string | null = null;
  if (ctx.clients.length > 0) {
    const fuse = new Fuse(ctx.clients, { keys: ['name'], threshold: 0.4, includeScore: true });
    const hit = fuse.search(raw)[0];
    if (hit) {
      clientId = hit.item.id;
      spans.push(hit.item.name);
    }
  }

  // 3. vehicle (only if client matched)
  let vehicleId: string | null = null;
  if (clientId) {
    const pool = ctx.vehicles
      .filter(v => v.clientId === clientId)
      .map(v => ({ ...v, yearStr: v.year != null ? String(v.year) : '' }));
    if (pool.length > 0) {
      const fuse = new Fuse(pool, {
        keys: ['make', 'model', 'color', 'yearStr'],
        threshold: 0.4,
        includeScore: true,
        includeMatches: true,
      });
      const hit = fuse.search(raw)[0];
      if (hit) {
        vehicleId = hit.item.id;
        // remember the actual matched substrings
        for (const mm of hit.matches || []) {
          if (mm.value) spans.push(mm.value);
        }
      }
    }
  }

  // 4. worker
  let assignedTo: string | null = null;
  if (ctx.workers.length > 0) {
    const fuse = new Fuse(ctx.workers, { keys: ['firstName'], threshold: 0.4 });
    const hit = fuse.search(raw)[0];
    if (hit) {
      assignedTo = hit.item.id;
      spans.push(hit.item.firstName);
    }
  }

  // 5. requested work
  let requestedWork = stripSpans(raw, spans);
  if (!requestedWork) requestedWork = raw.trim();

  return {
    clientId,
    clientName: clientId ? null : null,
    clientPhone: null,
    vehicleId,
    carInfo: null,
    assignedTo,
    date,
    time,
    requestedWork,
    notes: null,
  };
};

/** Ask the app's AI to understand the sentence. Returns null when unavailable. */
const parseWithAi = async (raw: string, ctx: VoiceContext): Promise<VoiceDraft | null> => {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  const clientName = new Map(ctx.clients.map(c => [c.id, c.name]));
  const { data, error } = await supabase.functions.invoke('ai-parse-schedule', {
    body: {
      transcript: raw,
      today,
      clients: ctx.clients.map(c => ({ id: c.id, label: c.name })),
      vehicles: ctx.vehicles.map(v => ({
        id: v.id,
        label: `${clientName.get(v.clientId) || 'unknown owner'} — ${[v.year, v.make, v.model, v.color].filter(Boolean).join(' ')}`,
      })),
    },
  });

  if (error || !data?.draft) return null;
  const d = data.draft;

  // Worker is matched locally — the AI is not given the worker list.
  let assignedTo: string | null = null;
  if (ctx.workers.length > 0) {
    const fuse = new Fuse(ctx.workers, { keys: ['firstName'], threshold: 0.4 });
    assignedTo = fuse.search(raw)[0]?.item.id || null;
  }

  const clientId = d.clientId && ctx.clients.some(c => c.id === d.clientId) ? d.clientId : null;
  const vehicleId = d.vehicleId && ctx.vehicles.some(v => v.id === d.vehicleId) ? d.vehicleId : null;

  const clean = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (!t || /^<?\s*(unknown|none|null|n\/a)\s*>?$/i.test(t)) return null;
    return t;
  };
  d = { ...d, clientName: clean(d.clientName), clientPhone: clean(d.clientPhone), carInfo: clean(d.carInfo), date: clean(d.date), time: clean(d.time), notes: clean(d.notes) };

  return {
    clientId,
    clientName: d.clientName || null,
    clientPhone: d.clientPhone || null,
    vehicleId,
    carInfo: d.carInfo || null,
    assignedTo,
    date: d.date || null,
    time: d.time || null,
    requestedWork: (d.requestedWork || raw).trim(),
    notes: d.notes || null,
  };
};


// ---- Recording (no system beeps, no auto cut-off) -------------------------
// Audio is captured directly from the microphone as WAV, then transcribed in
// the cloud. Unlike the phone's speech service, this makes no sounds and keeps
// recording until Stop is tapped.

const TARGET_RATE = 16000;
const MAX_SECONDS = 180;

const encodeWav = (chunks: Float32Array[], inRate: number): Blob => {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { merged.set(c, o); o += c.length; }
  // Downsample to 16 kHz to keep the upload small.
  const ratio = inRate > TARGET_RATE ? inRate / TARGET_RATE : 1;
  const outRate = Math.round(inRate / ratio);
  const length = Math.floor(merged.length / ratio);
  const buf = new ArrayBuffer(44 + length * 2);
  const v = new DataView(buf);
  const tag = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + length * 2, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); tag(36, 'data'); v.setUint32(40, length * 2, true);
  let off = 44;
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, merged[Math.floor(i * ratio)]));
    v.setInt16(off, s * (s < 0 ? 32768 : 32767), true);
    off += 2;
  }
  return new Blob([buf], { type: 'audio/wav' });
};

interface Recorder { stop: () => Blob | null; cancel: () => void }

const startRecorder = async (onLevel: (l: number) => void): Promise<Recorder> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0; // never play the mic back through the speaker
  const chunks: Float32Array[] = [];
  node.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data));
    let peak = 0;
    for (let i = 0; i < data.length; i += 64) peak = Math.max(peak, Math.abs(data[i]));
    onLevel(peak);
  };
  source.connect(node); node.connect(mute); mute.connect(ctx.destination);
  const cleanup = () => {
    node.onaudioprocess = null;
    try { source.disconnect(); node.disconnect(); mute.disconnect(); } catch { /* noop */ }
    stream.getTracks().forEach(t => t.stop());
    ctx.close().catch(() => {});
  };
  return {
    stop: () => {
      cleanup();
      const blob = encodeWav(chunks, ctx.sampleRate);
      return blob.size < 4096 ? null : blob;
    },
    cancel: cleanup,
  };
};

const transcribe = async (blob: Blob, _language: string, names: string[]): Promise<string> => {
  const form = new FormData();
  form.append('file', new File([blob], 'recording.wav', { type: 'audio/wav' }));
  // No language lock: lets foreign names come through as spoken.
  if (names.length) form.append('names', names.slice(0, 200).join(', ').slice(0, 2000));
  const { data, error } = await supabase.functions.invoke('ai-transcribe', { body: form });
  if (error) throw error;
  return (data?.text || '').trim();
};

export const VoiceScheduleButton = ({ context, onParsed, lang = 'en-US' }: Props) => {
  const { toast } = useNotifications();
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState<false | 'hearing' | 'writing'>(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const recRef = useRef<Recorder | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spokenLang = lang !== 'en-US' ? lang : (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const clearTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };

  useEffect(() => () => { clearTick(); recRef.current?.cancel(); }, []);

  const stop = async () => {
    const rec = recRef.current;
    recRef.current = null;
    clearTick();
    setListening(false);
    if (!rec) return;
    const blob = rec.stop();
    if (!blob) { toast({ title: 'Nothing recorded — try again.' }); return; }
    setThinking('hearing');
    try {
      const transcript = await transcribe(blob, spokenLang, context.clients.map(c => c.name).filter(Boolean));
      if (!transcript) { toast({ title: "Couldn't hear any words — try again." }); return; }
      setThinking('writing');
      const aiDraft = await parseWithAi(transcript, context).catch(() => null);
      if (!aiDraft) toast({ title: 'Understood it offline', description: 'Check the details before saving.' });
      onParsed(aiDraft || parseTranscript(transcript, context), transcript);
    } catch {
      toast({ title: 'Could not understand the recording', description: 'Check your connection and try again.', variant: 'destructive' });
    } finally {
      setThinking(false);
    }
  };

  const start = async () => {
    if (listening || thinking) return;
    try {
      recRef.current = await startRecorder((l) => setLevel(l));
    } catch {
      toast({ title: 'Microphone permission denied', variant: 'destructive' });
      return;
    }
    setSeconds(0);
    setListening(true);
    tickRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) void stop();
        return s + 1;
      });
    }, 1000);
  };

  if (!supported) {
    return (
      <Button size="sm" variant="outline" className="h-9 w-9 rounded-full p-0"
        onClick={() => toast({ title: 'Voice input is not available on this device.', variant: 'destructive' })}
        title="Voice input unavailable">
        <Mic className="h-4 w-4 opacity-50" />
      </Button>
    );
  }

  const mm = `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;

  return (
    <>
      <Button size="sm" onClick={start} disabled={!!thinking}
        className="h-9 w-9 rounded-full p-0 bg-primary hover:bg-primary/90" title="Voice schedule">
        {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
      </Button>

      {(listening || thinking) && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pointer-events-none">
          <div className="mx-auto max-w-md rounded-2xl border-2 border-primary bg-card shadow-2xl p-4 space-y-3 pointer-events-auto">
            {thinking ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-bold text-sm">{thinking === 'hearing' ? 'Listening back…' : 'Writing the job…'}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
                  </span>
                  <span className="font-bold text-sm">Recording {mm}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">pause freely — tap Stop when done</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${Math.min(100, level * 250)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground italic">Say the date, the client, the car and the work…</p>
                <Button size="sm" variant="destructive" className="w-full" onClick={() => void stop()}>
                  <Square className="h-4 w-4 mr-1" /> Stop
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceScheduleButton;
