// Shared CORS helper for all edge functions.
//
// Returns headers that echo the request Origin only when it's in the
// allowlist; otherwise falls back to the canonical production origin
// (the browser then blocks the response on mismatch — server logic
// stays simple and we don't leak origin policy via response codes).
//
// Always emits `Vary: Origin` so CDNs/proxies cache per-origin.

const CANONICAL = 'https://chiptime.chipplc.one';

const LOCAL_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
]);

// Built-in Lovable preview origins (https only, leading-dot suffix match).
const BUILTIN_WILDCARDS = [
  '.lovableproject.com',
  '.lovable.app',
  '.lovable.dev',
];

const ALLOW_HEADERS = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
  'x-supabase-client-platform',
  'x-supabase-client-platform-version',
  'x-supabase-client-runtime',
  'x-supabase-client-runtime-version',
].join(', ');

interface AllowEntry {
  literal?: string;       // exact origin match (scheme + host)
  wildcardSuffix?: string; // host suffix incl. leading dot, e.g. '.lovable.app'
}

function parseAllowlistEnv(): AllowEntry[] {
  const raw = Deno.env.get('LOVABLE_PREVIEW_ORIGIN') || '';
  const entries: AllowEntry[] = [];
  for (const item of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (item.startsWith('*.')) {
      // Wildcard form: *.lovable.app → suffix '.lovable.app'
      entries.push({ wildcardSuffix: item.slice(1).toLowerCase() });
    } else {
      try {
        const u = new URL(item);
        entries.push({ literal: `${u.protocol}//${u.host}` });
      } catch {
        // ignore malformed entry
      }
    }
  }
  return entries;
}

function isLocalAllowed(): boolean {
  return Deno.env.get('APP_ENV') !== 'production';
}

function originAllowed(origin: string): boolean {
  if (!origin) return false;
  if (origin === CANONICAL) return true;

  let host: string;
  let scheme: string;
  try {
    const u = new URL(origin);
    // URL parsing rejects path-injected origins like
    // "https://attacker.com/lovable.app" — they parse as host=attacker.com,
    // path=/lovable.app, so the suffix check below sees attacker.com.
    host = u.host.toLowerCase();
    scheme = u.protocol;
  } catch {
    return false;
  }

  if (isLocalAllowed() && LOCAL_ORIGINS.has(origin)) return true;

  for (const suffix of BUILTIN_WILDCARDS) {
    if (scheme === 'https:' && host.endsWith(suffix) && host.length > suffix.length) {
      return true;
    }
  }

  for (const entry of parseAllowlistEnv()) {
    if (entry.literal && entry.literal.toLowerCase() === origin.toLowerCase()) {
      return true;
    }
    if (entry.wildcardSuffix) {
      // Require https for wildcard subdomains and a leading-dot suffix
      // match — prevents 'evil-lovable.app' from matching '.lovable.app'.
      if (scheme === 'https:' && host.endsWith(entry.wildcardSuffix) && host.length > entry.wildcardSuffix.length) {
        return true;
      }
    }
  }
  return false;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = originAllowed(origin) ? origin : CANONICAL;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}

// Exported for unit testing.
export const __test = { originAllowed };
