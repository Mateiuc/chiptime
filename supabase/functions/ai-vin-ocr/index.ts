// Reads a VIN out of a photo using Claude vision via the Lovable AI Gateway.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { callClaude } from '../_shared/claude.ts';

const PROMPT = [
  'You are given a cropped photo of a vehicle VIN plate, door sticker, windshield etching or barcode label.',
  'Read the 17-character VIN.',
  'Valid characters: A-H, J-N, P, R-Z and digits 0-9. The letters I, O and Q never appear in a VIN.',
  'Common confusions: O -> 0, I -> 1, Q -> 0, S -> 5, B -> 8, Z -> 2, G -> 6.',
  'Respond with ONLY the 17-character VIN in uppercase and nothing else.',
  'If you cannot read a full, confident 17-character VIN, respond with exactly: NONE',
].join(' ');

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const cors = corsHeaders(req);
  const headers = { ...cors, 'Content-Type': 'application/json' };

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
    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'No image supplied.' }), { status: 400, headers });
    }
    // ~6MB base64 guard
    if (imageBase64.length > 8_000_000) {
      return new Response(JSON.stringify({ error: 'Image is too large.' }), { status: 400, headers });
    }

    const result = await callClaude({
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType || 'image/png', data: imageBase64 },
          },
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error.message }), { status: result.error.status, headers });
    }

    const text = result.content.filter((c) => c.type === 'text').map((c) => c.text || '').join(' ');
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const vin = /^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned) ? cleaned : null;

    return new Response(JSON.stringify({ vin, rawText: text.trim() }), { status: 200, headers });
  } catch (e) {
    console.error('[ai-vin-ocr]', e);
    return new Response(JSON.stringify({ error: 'Could not read the photo.' }), { status: 500, headers });
  }
});
