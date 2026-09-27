// VIN reading through the app's backend AI (Claude vision). No device API key.
import { supabase } from '@/integrations/supabase/client';
import { validateVinStrict } from '@/lib/vinDecoder';

export interface OcrResult {
  vin: string | null;
  rawText: string;
  candidates: { vin: string; valid: boolean; checksum: boolean }[];
}

interface Args {
  base64Image: string;
  mediaType?: string;
  signal?: AbortSignal;
  debug?: boolean;
}

export async function readVinWithClaude(args: Args): Promise<string | null | OcrResult> {
  const { base64Image, mediaType = 'image/png', debug } = args;

  const { data, error } = await supabase.functions.invoke('ai-vin-ocr', {
    body: { imageBase64: base64Image, mediaType },
  });

  if (error) {
    if (debug) return { vin: null, rawText: error.message || 'AI request failed', candidates: [] };
    return null;
  }

  const vin: string | null = data?.vin || null;
  const accepted = vin && validateVinStrict(vin) ? vin : null;

  if (!debug) return accepted;

  return {
    vin: accepted,
    rawText: data?.rawText || '',
    candidates: vin
      ? [{ vin, valid: /^[A-HJ-NPR-Z0-9]{17}$/.test(vin), checksum: validateVinStrict(vin) }]
      : [],
  };
}
