import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { clientLocalId, clientName, accessCode, data } = await req.json()

    if (!clientLocalId || !clientName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if portal exists for this client
    const { data: existing } = await supabase
      .from('client_portals')
      .select('id')
      .eq('client_local_id', clientLocalId)
      .maybeSingle()

    const portalId = existing?.id || generateId()

    const { error } = await supabase
      .from('client_portals')
      .upsert({
        id: portalId,
        client_local_id: clientLocalId,
        client_name: clientName,
        access_code: accessCode || null,
        data: data || {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_local_id' })

    if (error) {
      console.error('Upsert error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ id: portalId, access_code: accessCode || null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('sync-portal error:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
