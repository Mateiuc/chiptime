import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, sync_id, data, old_sync_id, new_sync_id } = await req.json()

    if (!action) {
      return new Response(JSON.stringify({ error: 'Missing action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    switch (action) {
      case 'push': {
        if (!sync_id || !data) {
          return new Response(JSON.stringify({ error: 'Missing sync_id or data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const now = new Date().toISOString()
        const { error } = await supabase
          .from('app_sync')
          .upsert({ sync_id, data, updated_at: now }, { onConflict: 'sync_id' })

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ updated_at: now }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'pull': {
        if (!sync_id) {
          return new Response(JSON.stringify({ error: 'Missing sync_id' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: row, error } = await supabase
          .from('app_sync')
          .select('data, updated_at')
          .eq('sync_id', sync_id)
          .maybeSingle()

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (!row) {
          return new Response(JSON.stringify({ data: null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ data: row.data, updated_at: row.updated_at }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'check': {
        if (!sync_id) {
          return new Response(JSON.stringify({ error: 'Missing sync_id' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: row, error } = await supabase
          .from('app_sync')
          .select('updated_at')
          .eq('sync_id', sync_id)
          .maybeSingle()

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ updated_at: row?.updated_at || null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'migrate': {
        if (!old_sync_id || !new_sync_id) {
          return new Response(JSON.stringify({ error: 'Missing old_sync_id or new_sync_id' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: row, error: selectError } = await supabase
          .from('app_sync')
          .select('updated_at')
          .eq('sync_id', old_sync_id)
          .maybeSingle()

        if (selectError || !row) {
          return new Response(JSON.stringify({ found: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { error: updateError } = await supabase
          .from('app_sync')
          .update({ sync_id: new_sync_id })
          .eq('sync_id', old_sync_id)

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ found: true, updated_at: row.updated_at }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
  } catch (e) {
    console.error('sync-data error:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
