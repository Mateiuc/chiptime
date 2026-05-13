import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Constant-time string compare to avoid leaking access-code prefixes via
// response-time differences. Length check is acceptable here — portal
// PINs are a fixed length, so length is not secret.
function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const preview = url.searchParams.get('preview') === '1'
    const code = url.searchParams.get('code')

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabase
      .from('client_portals')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Portal lookup error:', error)
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!data) {
      return new Response(JSON.stringify({ error: 'Portal not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If portal has an access code, validate it server-side
    if (data.access_code && !preview) {
      // No code provided — return metadata only (requiresCode flag).
      // Surface lock state so the client can disable input early.
      if (!code) {
        const lockedUntilMs = data.locked_until ? new Date(data.locked_until).getTime() : 0
        const isLocked = lockedUntilMs > Date.now()
        return new Response(JSON.stringify({
          requiresCode: true,
          clientName: data.client_name,
          locked: isLocked,
          lockedUntil: isLocked ? new Date(lockedUntilMs).toISOString() : null,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Enforce lockout before checking the code at all.
      const lockedUntilMs = data.locked_until ? new Date(data.locked_until).getTime() : 0
      if (lockedUntilMs > Date.now()) {
        const retryAfterSeconds = Math.ceil((lockedUntilMs - Date.now()) / 1000)
        return new Response(JSON.stringify({
          error: 'Too many attempts. Try again later.',
          locked: true,
          lockedUntil: new Date(lockedUntilMs).toISOString(),
          retryAfterSeconds,
        }), {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfterSeconds),
          },
        })
      }

      // Code provided but incorrect — track failures in a 30-min window.
      if (!constantTimeEqual(code, data.access_code)) {
        const WINDOW_MS = 30 * 60 * 1000
        const LOCK_MS = 60 * 60 * 1000
        const MAX_ATTEMPTS = 3

        const firstFailedMs = data.first_failed_at ? new Date(data.first_failed_at).getTime() : 0
        const windowActive = firstFailedMs > 0 && (Date.now() - firstFailedMs) < WINDOW_MS
        const newCount = windowActive ? (data.failed_attempts || 0) + 1 : 1
        const newFirstFailed = windowActive ? data.first_failed_at : new Date().toISOString()

        if (newCount >= MAX_ATTEMPTS) {
          const newLockedUntil = new Date(Date.now() + LOCK_MS).toISOString()
          await supabase
            .from('client_portals')
            .update({
              failed_attempts: newCount,
              first_failed_at: newFirstFailed,
              locked_until: newLockedUntil,
            })
            .eq('id', id)
          const retryAfterSeconds = Math.ceil(LOCK_MS / 1000)
          return new Response(JSON.stringify({
            error: 'Too many attempts. Try again later.',
            locked: true,
            lockedUntil: newLockedUntil,
            retryAfterSeconds,
          }), {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': String(retryAfterSeconds),
            },
          })
        }

        await supabase
          .from('client_portals')
          .update({
            failed_attempts: newCount,
            first_failed_at: newFirstFailed,
            locked_until: null,
          })
          .eq('id', id)

        return new Response(JSON.stringify({
          error: 'Invalid access code',
          attemptsRemaining: MAX_ATTEMPTS - newCount,
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Code matched — clear failure state.
      if (data.failed_attempts || data.first_failed_at || data.locked_until) {
        await supabase
          .from('client_portals')
          .update({ failed_attempts: 0, first_failed_at: null, locked_until: null })
          .eq('id', id)
      }
    }

    // Code valid or no code required — return data (never expose accessCode).
    // Resolve any private storage paths in the photo arrays into short-lived
    // signed URLs so the public portal can render them without making the
    // session-photos bucket public.
    let portalData = await signPortalPhotos(supabase, data.data)
    portalData = await signPortalDiagnosticPdfs(supabase, portalData)

    return new Response(JSON.stringify({
      data: portalData,
      clientName: data.client_name,
      requiresCode: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('get-portal error:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Walk the slimmed portal payload and replace storage paths in `ph[]` with
// short-lived signed URLs. Entries that look like legacy public/signed
// session-photos URLs are also re-signed by extracting their storage path.
async function signPortalPhotos(supabase: any, payload: any): Promise<any> {
  if (!payload || !Array.isArray(payload.v)) return payload

  const LEGACY_URL_RE = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/session-photos\/([^?#]+)/i
  const extractPath = (entry: string): string | null => {
    if (!entry) return null
    if (!/^https?:\/\//i.test(entry)) return entry
    const m = entry.match(LEGACY_URL_RE)
    if (!m) return null
    try { return decodeURIComponent(m[1]) } catch { return m[1] }
  }

  const paths = new Set<string>()
  for (const vehicle of payload.v) {
    if (!Array.isArray(vehicle?.s)) continue
    for (const session of vehicle.s) {
      if (!Array.isArray(session?.ph)) continue
      for (const entry of session.ph) {
        if (typeof entry !== 'string') continue
        const p = extractPath(entry)
        if (p) paths.add(p)
      }
    }
  }

  if (paths.size === 0) return payload

  const pathList = Array.from(paths)
  const map: Record<string, string> = {}
  const { data: signed, error } = await supabase.storage
    .from('session-photos')
    .createSignedUrls(pathList, 60 * 60) // 1h
  if (error) {
    console.error('Portal photo signing error:', error)
    return payload
  }
  for (const item of signed || []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl
  }

  for (const vehicle of payload.v) {
    if (!Array.isArray(vehicle?.s)) continue
    for (const session of vehicle.s) {
      if (!Array.isArray(session?.ph)) continue
      session.ph = session.ph.map((entry: string) => {
        if (typeof entry !== 'string') return entry
        const p = extractPath(entry)
        return p && map[p] ? map[p] : entry
      })
    }
  }

  return payload
}


// Walk the slimmed portal payload and replace `dpdf` storage paths with
// short-lived signed URLs from the diagnostic-pdfs bucket. Entries that
// already look like absolute URLs (legacy) are left untouched.
async function signPortalDiagnosticPdfs(supabase: any, payload: any): Promise<any> {
  if (!payload || !Array.isArray(payload.v)) return payload

  const LEGACY_URL_RE = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/diagnostic-pdfs\/([^?#]+)/i
  const extractPath = (entry: string): string | null => {
    if (!entry) return null
    if (!/^https?:\/\//i.test(entry)) return entry
    const m = entry.match(LEGACY_URL_RE)
    if (!m) return null
    try { return decodeURIComponent(m[1]) } catch { return m[1] }
  }

  const paths = new Set<string>()
  for (const vehicle of payload.v) {
    if (!Array.isArray(vehicle?.s)) continue
    for (const session of vehicle.s) {
      const entry = session?.dpdf
      if (typeof entry !== 'string' || !entry) continue
      const p = extractPath(entry)
      if (p) paths.add(p)
    }
  }

  if (paths.size === 0) return payload

  const pathList = Array.from(paths)
  const map: Record<string, string> = {}
  const { data: signed, error } = await supabase.storage
    .from('diagnostic-pdfs')
    .createSignedUrls(pathList, 60 * 60) // 1h
  if (error) {
    console.error('Portal diagnostic PDF signing error:', error)
    return payload
  }
  for (const item of signed || []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl
  }

  for (const vehicle of payload.v) {
    if (!Array.isArray(vehicle?.s)) continue
    for (const session of vehicle.s) {
      const entry = session?.dpdf
      if (typeof entry !== 'string' || !entry) continue
      const p = extractPath(entry)
      if (p && map[p]) session.dpdf = map[p]
    }
  }

  return payload
}
