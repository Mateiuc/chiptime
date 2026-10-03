// Turns a recorded voice clip (WAV) into text via the Lovable AI Gateway.
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';

const MODEL = 'google/gemini-3.5-transcribe';
const MAX_BYTES = 14 * 1024 * 1024;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  const headers = { ...corsHeaders(req), 'Content-Type': 'application/json' };

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
    const lang = form.get('language');
    if (typeof lang === 'string' && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(lang)) out.append('language', lang);

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
