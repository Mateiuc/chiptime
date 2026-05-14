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

    const taskOwnershipCache = new Map<string, boolean>()
    const checkTaskOwnership = async (taskId: string): Promise<boolean> => {
      if (taskOwnershipCache.has(taskId)) return taskOwnershipCache.get(taskId)!
      const { data, error } = await supabase
        .from('app_sync')
        .select('sync_id')
        .eq('workspace_id', wsId)
        .filter('data', '@?', `$.tasks[*] ? (@.id == "${taskId}")`)
        .limit(1)
        .maybeSingle()
      const owned = !error && !!data
      taskOwnershipCache.set(taskId, owned)
      return owned
    }

    const safePaths: string[] = []
    for (const p of paths) {
      if (typeof p !== 'string') continue
      if (p.includes('..') || p.includes('//')) continue
      const segs = p.split('/')
      if (!segs.every(isSafeSegment)) continue
      const last = segs[segs.length - 1]
      if (!last.toLowerCase().endsWith('.jpg')) continue

      if (segs.length === 3) {
        // Prefixed: wsId/taskId/photoId.jpg — must match caller workspace.
        if (segs[0] !== wsId) continue
        safePaths.push(p)
      } else if (segs.length === 2) {
        // Legacy: taskId/photoId.jpg — verify caller's workspace owns this task.
        const taskId = segs[0]
        if (await checkTaskOwnership(taskId)) safePaths.push(p)
      } else {
        // Unknown shape — drop.
        continue
      }
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
