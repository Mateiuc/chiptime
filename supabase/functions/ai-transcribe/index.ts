// Turns a recorded voice clip (WAV) into text via the Lovable AI Gateway.
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';

const MODEL = 'openai/gpt-4o-transcribe';
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
    const names = form.get('names');
    const nameHint = typeof names === 'string' ? names.replace(/[\r\n]+/g, ' ').slice(0, 2000) : '';
    out.append('prompt',
      'Auto repair shop scheduling a job: date/time, client name, car, work to do. ' +
      'Client names are often Romanian, Eastern European, Indian, Italian or Spanish — spell them as spoken, do not anglicize. ' +
      (nameHint ? `Known clients: ${nameHint}.` : ''));

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
