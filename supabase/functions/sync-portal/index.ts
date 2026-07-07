import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'
import { checkRateLimit } from '../_shared/ratelimit.ts'

function generateId(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  for (const byte of arr) {
    result += chars[byte % chars.length]
  }
  return result
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req)
  if (pre) return pre
  const rl = await checkRateLimit(req, 'sync-portal', { windowSec: 60, maxRequests: 60 })
  if (rl) return rl
  const cors = corsHeaders(req)

  try {
    // ---- Authenticate caller ----
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')

    // Service-role client for DB writes
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify the user
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const userId = userData.user.id

    const { clientLocalId, clientName, accessCode, data, regenerate } = await req.json()

    if (!clientLocalId || !clientName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Resolve the user's primary workspace
    const { data: ws, error: wsErr } = await admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (wsErr || !ws) {
      return new Response(JSON.stringify({ error: 'No workspace for user' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const workspaceId = ws.workspace_id

    // Find an existing portal for this client within this workspace only.
    // We select `access_code` too so we can PRESERVE it across syncs — the PIN
    // must stay stable until the caller explicitly asks to regenerate it.
    const { data: existing } = await admin
      .from('client_portals')
      .select('id, access_code')
      .eq('client_local_id', clientLocalId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    const portalId = existing?.id || generateId()

    // PIN resolution:
    // - regenerate=true → use the caller's new code (or generate one if missing)
    // - existing row    → keep whatever is already stored, ignore incoming code
    // - new row         → use the caller's code, or generate a 4-digit one
    let effectiveAccessCode: string | null
    const gen4 = () => String(Math.floor(1000 + Math.random() * 9000))
    if (regenerate === true) {
      effectiveAccessCode = (accessCode && String(accessCode)) || gen4()
    } else if (existing) {
      effectiveAccessCode = existing.access_code ?? (accessCode ? String(accessCode) : null)
    } else {
      effectiveAccessCode = (accessCode && String(accessCode)) || gen4()
    }

    const { error } = await admin
      .from('client_portals')
      .upsert({
        id: portalId,
        client_local_id: clientLocalId,
        client_name: clientName,
        access_code: effectiveAccessCode,
        data: data || {},
        workspace_id: workspaceId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (error) {
      console.error('Upsert error:', error)
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ id: portalId, access_code: effectiveAccessCode }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('sync-portal error:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
