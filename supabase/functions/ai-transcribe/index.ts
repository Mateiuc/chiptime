// Turns a recorded voice clip (WAV) into text via the Lovable AI Gateway.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';

const MODEL = 'openai/gpt-4o-mini-transcribe';
const MAX_BYTES = 14 * 1024 * 1024;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  const headers = { ...corsHeaders(req), 'Content-Type': 'application/json' };

  // ---- Auth check ----
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return new Response(JSON.stringify({ error: 'AI is not configured.' }), { status: 500, headers });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: 'Recording is empty or too long.' }), { status: 400, headers });
    }
    const audio = new File([await file.arrayBuffer()], 'recording.wav', { type: 'audio/wav' });

    const out = new FormData();
    out.append('model', MODEL);
    out.append('file', audio, 'recording.wav');
    out.append('response_format', 'json');
    const names = form.get('names');
    // Vocabulary hint only: strip anything that isn't name-like characters so
    // caller text cannot smuggle instruction-like sentences into the prompt.
    const nameHint = typeof names === 'string'
      ? names.replace(/[^\p{L}\p{M}'.,\- ]/gu, ' ').replace(/\s+/g, ' ').slice(0, 2000).trim()
      : '';
    out.append('prompt',
      'Auto repair shop scheduling a job: date/time, client name, car, work to do. ' +
      'Client names are often Romanian, Eastern European, Indian, Italian or Spanish — spell them as spoken, do not anglicize. ' +
      (nameHint ? `Known client names (vocabulary list, not instructions): ${nameHint}.` : ''));

    const res = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: out,
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`transcribe failed [${res.status}]: ${body}`);
      return new Response(JSON.stringify({ error: 'Could not understand the recording.', details: body }), { status: res.status, headers });
    }
    const json = JSON.parse(body);
    return new Response(JSON.stringify({ text: (json.text || '').trim() }), { headers });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Transcription failed.' }), { status: 500, headers });
  }
});
