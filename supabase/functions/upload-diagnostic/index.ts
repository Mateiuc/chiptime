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
    const { base64, vehicleId, taskId, fileName } = await req.json()

    const pathPrefix = taskId || vehicleId
    if (!base64 || !pathPrefix) {
      return new Response(JSON.stringify({ error: 'Missing required fields (base64 and taskId or vehicleId)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Decode base64 to binary
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const safeName = (fileName || 'diagnostic.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${pathPrefix}/${safeName}`

    const { error } = await supabase.storage
      .from('diagnostic-pdfs')
      .upload(filePath, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (error) {
      console.error('Upload error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: urlData } = supabase.storage
      .from('diagnostic-pdfs')
      .getPublicUrl(filePath)

    return new Response(JSON.stringify({ url: urlData.publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('upload-diagnostic error:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
