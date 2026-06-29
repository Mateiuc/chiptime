// Developed by Chip
// Fully offline voice → schedule draft. No network calls, no edge functions,
// no STT/LLM APIs. Uses the browser Web Speech API + chrono-node + fuse.js.
import { useEffect, useRef, useState } from 'react';
import * as chrono from 'chrono-node';
import Fuse from 'fuse.js';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';

// Minimal local typings for webkitSpeechRecognition so we don't pull extra @types.
interface SRAlternative { transcript: string }
interface SRResult { 0: SRAlternative; isFinal: boolean; length: number }
interface SREvent { results: ArrayLike<SRResult> & { length: number }; resultIndex: number }
interface SRErrorEvent { error: string }
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
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
  vehicleId: string | null;
  assignedTo: string | null;
  date: string | null; // YYYY-MM-DD local
  time: string | null; // HH:mm 24h local
  requestedWork: string;
}

interface Props {
  context: VoiceContext;
  onParsed: (draft: VoiceDraft, transcript: string) => void;
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

  return { clientId, vehicleId, assignedTo, date, time, requestedWork };
};

export const VoiceScheduleButton = ({ context, onParsed }: Props) => {
  const { toast } = useNotifications();
  const SR = getSRCtor();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef<string>('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSilence = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stop = () => {
    clearSilence();
    try { recRef.current?.stop(); } catch { /* noop */ }
  };

  const armSilence = () => {
    clearSilence();
    silenceTimerRef.current = setTimeout(() => {
      try { recRef.current?.stop(); } catch { /* noop */ }
    }, 1500);
  };

  useEffect(() => {
    return () => {
      clearSilence();
      try { recRef.current?.abort(); } catch { /* noop */ }
    };
  }, []);

  if (!SR) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-9 w-9 rounded-full p-0"
        onClick={() => toast({ title: 'Voice input needs Chrome.', variant: 'destructive' })}
        title="Voice input needs Chrome"
      >
        <Mic className="h-4 w-4 opacity-50" />
      </Button>
    );
  }

  const start = () => {
    if (listening) return;
    let rec: SpeechRecognitionLike;
    try { rec = new SR(); } catch {
      toast({ title: 'Voice input unavailable', variant: 'destructive' });
      return;
    }
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    finalRef.current = '';
    setInterim('');

    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0].transcript;
        if (r.isFinal) finalRef.current += (finalRef.current ? ' ' : '') + txt.trim();
        else interimText += txt;
      }
      setInterim(interimText);
      armSilence();
    };
    rec.onerror = (e) => {
      clearSilence();
      const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone permission denied'
        : e.error === 'no-speech'
          ? 'No speech detected'
          : `Voice error: ${e.error}`;
      toast({ title: msg, variant: 'destructive' });
      setListening(false);
      setInterim('');
    };
    rec.onend = () => {
      clearSilence();
      setListening(false);
      setInterim('');
      const transcript = (finalRef.current || '').trim();
      if (!transcript) return;
      const draft = parseTranscript(transcript, context);
      onParsed(draft, transcript);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      toast({ title: 'Could not start microphone', variant: 'destructive' });
    }
  };

  return (
    <>
      <Button
        size="sm"
        onClick={start}
        className="h-9 w-9 rounded-full p-0 bg-primary hover:bg-primary/90"
        title="Voice schedule"
      >
        <Mic className="h-4 w-4" />
      </Button>

      {listening && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pointer-events-none">
          <div className="mx-auto max-w-md rounded-2xl border-2 border-primary bg-card shadow-2xl p-4 space-y-3 pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
              <span className="font-bold text-sm">Listening…</span>
              <span className="ml-auto text-[10px] text-muted-foreground">auto-stops on pause</span>
            </div>
            <div className="min-h-[3rem] max-h-32 overflow-y-auto rounded-md bg-muted/50 p-2 text-sm">
              <span className="text-foreground">{finalRef.current}</span>
              {interim && <span className="text-muted-foreground"> {interim}</span>}
              {!finalRef.current && !interim && (
                <span className="text-muted-foreground italic">Say the client, car, work, and when…</span>
              )}
            </div>
            <Button size="sm" variant="destructive" className="w-full" onClick={stop}>
              <Square className="h-4 w-4 mr-1" /> Stop
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceScheduleButton;
