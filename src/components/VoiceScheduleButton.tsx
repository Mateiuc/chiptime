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


export const VoiceScheduleButton = ({ context, onParsed, lang = 'en-US' }: Props) => {
  const { toast } = useNotifications();
  const SR = getSRCtor();
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef<string>('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // True while the user wants to keep talking. Phones end recognition at every
  // breath; we silently restart until Stop is tapped or a long silence passes.
  const wantRef = useRef(false);
  const pendingInterimRef = useRef('');
  const spokenLang = lang !== 'en-US' ? lang : (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

  const clearSilence = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const finish = () => {
    wantRef.current = false;
    clearSilence();
    // Keep any words still in-flight when the session ended.
    if (pendingInterimRef.current.trim()) {
      finalRef.current += (finalRef.current ? ' ' : '') + pendingInterimRef.current.trim();
      pendingInterimRef.current = '';
    }
    setListening(false);
    setInterim('');
    const transcript = (finalRef.current || '').trim();
    if (!transcript) return;
    setThinking(true);
    parseWithAi(transcript, context)
      .catch(() => null)
      .then((aiDraft) => {
        if (!aiDraft) {
          toast({ title: 'Understood it offline', description: 'Check the details before saving.' });
        }
        onParsed(aiDraft || parseTranscript(transcript, context), transcript);
      })
      .finally(() => setThinking(false));
  };

  const stop = () => {
    wantRef.current = false;
    clearSilence();
    try { recRef.current?.stop(); } catch { /* noop */ }
  };

  // Long pause window: only a real 6s silence ends listening automatically.
  const armSilence = () => {
    clearSilence();
    silenceTimerRef.current = setTimeout(() => {
      wantRef.current = false;
      try { recRef.current?.stop(); } catch { /* noop */ }
    }, 6000);
  };

  useEffect(() => {
    return () => {
      wantRef.current = false;
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

  const startSession = (): boolean => {
    let rec: SpeechRecognitionLike;
    try { rec = new SR(); } catch { return false; }
    rec.lang = spokenLang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      // Rebuild the whole transcript from scratch each time. Android repeats
      // the full phrase so far in every result, so a result that starts with
      // the previous one replaces it instead of being added again.
      const parts: string[] = [];
      let interimText = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0].transcript.trim();
        if (!txt) continue;
        if (!r.isFinal) { interimText = txt; continue; }
        const last = parts[parts.length - 1];
        if (last && txt.toLowerCase().startsWith(last.toLowerCase())) parts[parts.length - 1] = txt;
        else if (last && last.toLowerCase().startsWith(txt.toLowerCase())) { /* older, shorter copy */ }
        else parts.push(txt);
      }
      const last = parts[parts.length - 1];
      if (interimText && last && interimText.toLowerCase().startsWith(last.toLowerCase())) {
        parts.pop();
      }
      finalRef.current = parts.join(' ');
      pendingInterimRef.current = interimText;
      setInterim(interimText);
      armSilence();
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      wantRef.current = false;
      const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone permission denied'
        : `Voice error: ${e.error}`;
      toast({ title: msg, variant: 'destructive' });
    };
    // One session only — no auto-restart (each restart makes the phone beep).
    rec.onend = () => finish();

    recRef.current = rec;
    try { rec.start(); return true; } catch { return false; }
  };

  const start = () => {
    if (listening) return;
    finalRef.current = '';
    pendingInterimRef.current = '';
    setInterim('');
    wantRef.current = true;
    if (startSession()) {
      setListening(true);
      armSilence();
    } else {
      wantRef.current = false;
      toast({ title: 'Could not start microphone', variant: 'destructive' });
    }
  };

  return (
    <>
      <Button
        size="sm"
        onClick={start}
        disabled={thinking}
        className="h-9 w-9 rounded-full p-0 bg-primary hover:bg-primary/90"
        title="Voice schedule"
      >
        {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
      </Button>

      {(listening || thinking) && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pointer-events-none">
          <div className="mx-auto max-w-md rounded-2xl border-2 border-primary bg-card shadow-2xl p-4 space-y-3 pointer-events-auto">
            {thinking ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-bold text-sm">Writing the job…</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                  </span>
                  <span className="font-bold text-sm">Listening…</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">tap Stop when done</span>
                </div>
                <div className="min-h-[3rem] max-h-32 overflow-y-auto rounded-md bg-muted/50 p-2 text-sm">
                  <span className="text-foreground">{finalRef.current}</span>
                  {interim && <span className="text-muted-foreground"> {interim}</span>}
                  {!finalRef.current && !interim && (
                    <span className="text-muted-foreground italic">Say the date, the client, the car and the work…</span>
                  )}
                </div>
                <Button size="sm" variant="destructive" className="w-full" onClick={stop}>
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
