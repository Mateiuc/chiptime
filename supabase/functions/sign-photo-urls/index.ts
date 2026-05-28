import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'
import { checkRateLimit } from '../_shared/ratelimit.ts'

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/
const isSafeSegment = (s: string) => SAFE_SEGMENT.test(s)

Deno.serve(async (req) => {
  const pre = handlePreflight(req)
  if (pre) return pre
  const rl = await checkRateLimit(req, 'sign-photo-urls', { windowSec: 60, maxRequests: 120 })
  if (rl) return rl
  const cors = corsHeaders(req)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { paths, expiresIn } = await req.json().catch(() => ({}))
    if (!Array.isArray(paths) || paths.length === 0) {
      return new Response(JSON.stringify({ urls: {} }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (paths.length > 200) {
      return new Response(JSON.stringify({ error: 'Too many paths (max 200)' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Resolve caller's workspace
    const { data: wsId, error: wsErr } = await supabase.rpc(
      'user_primary_workspace',
      { _user_id: userData.user.id }
    )
    if (wsErr || !wsId) {
      return new Response(JSON.stringify({ error: 'No workspace for user' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Match the caller's workspace row OR the legacy shared `chiptime-default`
    // row (predates workspaces; workspace_id IS NULL). We intentionally scan
    // JSON in TypeScript instead of using PostgREST JSON-path filters because
    // the data API rejects the `@?` operator for this project.
    const { data: syncRows, error: syncErr } = await supabase
      .from('app_sync')
      .select('sync_id, workspace_id, data')
      .or(`workspace_id.eq.${wsId},sync_id.eq.chiptime-default`)

    if (syncErr) {
      console.error('[sign-photo-urls] failed to load sync rows:', syncErr)
      return new Response(JSON.stringify({ error: 'Sync lookup error' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const ownedTaskIds = new Set<string>()
    for (const row of syncRows || []) {
      const tasks = Array.isArray(row?.data?.tasks) ? row.data.tasks : []
      for (const task of tasks) {
        if (typeof task?.id === 'string') ownedTaskIds.add(task.id)
      }
    }

    const checkTaskOwnership = (taskId: string): boolean => {
      const owned = ownedTaskIds.has(taskId)
      if (!owned) {
        console.warn(`[sign-photo-urls] ownership denied for task=${taskId} ws=${wsId}`)
      }
      return owned
    }

    const safePaths: string[] = []
    const dropped: Array<{ path: string; reason: string }> = []
    for (const p of paths) {
      if (typeof p !== 'string') { dropped.push({ path: String(p), reason: 'not-string' }); continue }
      if (p.includes('..') || p.includes('//')) { dropped.push({ path: p, reason: 'unsafe-chars' }); continue }
      const segs = p.split('/')
      if (!segs.every(isSafeSegment)) { dropped.push({ path: p, reason: 'invalid-segment' }); continue }
      const last = segs[segs.length - 1]
      if (!last.toLowerCase().endsWith('.jpg')) { dropped.push({ path: p, reason: 'not-jpg' }); continue }

      if (segs.length === 3) {
        // Prefixed: wsId/taskId/photoId.jpg — must match caller workspace.
        if (segs[0] !== wsId) { dropped.push({ path: p, reason: `ws-mismatch (${segs[0]} != ${wsId})` }); continue }
        safePaths.push(p)
      } else if (segs.length === 2) {
        // Legacy: taskId/photoId.jpg — verify caller's workspace owns this task.
        const taskId = segs[0]
        if (checkTaskOwnership(taskId)) safePaths.push(p)
        else dropped.push({ path: p, reason: 'no-task-ownership' })
      } else {
        dropped.push({ path: p, reason: `unknown-shape (${segs.length} segs)` })
        continue
      }
    }
    if (dropped.length > 0) {
      console.warn(`[sign-photo-urls] dropped ${dropped.length}/${paths.length} paths:`, dropped.slice(0, 10))
    }

    const urls: Record<string, string> = {}
    if (safePaths.length === 0) {
      return new Response(JSON.stringify({ urls }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const ttl = Math.min(Math.max(Number(expiresIn) || 3600, 60), 60 * 60 * 24)
    const { data: signed, error } = await supabase.storage
      .from('session-photos')
      .createSignedUrls(safePaths, ttl)

    if (error) {
      console.error('createSignedUrls error:', error)
      return new Response(JSON.stringify({ error: 'Storage error' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    for (const item of signed || []) {
      if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
    }

    return new Response(JSON.stringify({ urls }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('sign-photo-urls error:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
