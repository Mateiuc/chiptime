// Per-IP rate limiter backed by the public.rate_limit_buckets table and
// the public.consume_rate_limit() SECURITY DEFINER function.
//
// Storage rationale: Deno KV (Deno.openKv) is not enabled in Supabase
// Edge runtime; no Upstash/Redis connector is configured. A Postgres
// table with an atomic increment-and-check function is the simplest
// option available today. Each call costs ~1 round-trip (~5–15ms warm).
//
// Failure mode: if the limiter itself errors, fail-open (log + null)
// rather than locking the whole app out on infra hiccups.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

export interface RateLimitOpts {
  windowSec: number;
  maxRequests: number;
}

let cachedClient: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient;
  cachedClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
  return cachedClient;
}

function extractIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

/**
 * Returns a 429 Response if the caller is over the limit, otherwise null.
 * Caller short-circuits when a Response is returned.
 */
export async function checkRateLimit(
  req: Request,
  bucketKey: string,
  opts: RateLimitOpts
): Promise<Response | null> {
  const ip = extractIp(req);
  try {
    const { data, error } = await getAdmin().rpc('consume_rate_limit', {
      _key: bucketKey,
      _ip: ip,
      _window_sec: opts.windowSec,
      _max: opts.maxRequests,
    });
    if (error) {
      console.error(`[ratelimit:${bucketKey}] rpc error — fail-open:`, error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.allowed === false) {
      const retryAfter = Math.max(1, Number(row.retry_after) || opts.windowSec);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: {
            ...corsHeaders(req),
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
          },
        }
      );
    }
    return null;
  } catch (err) {
    console.error(`[ratelimit:${bucketKey}] exception — fail-open:`, err);
    return null;
  }
}
