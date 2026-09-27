// Shared Claude (Anthropic) caller through the Lovable AI Gateway.
// Uses the native Anthropic Messages format at /v1/messages.

export const CLAUDE_MODEL = 'anthropic/claude-haiku-4-5';

export interface ClaudeContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
  // deno-lint-ignore no-explicit-any
  [k: string]: any;
}

export interface ClaudeError {
  status: number;
  message: string;
}

export async function callClaude(body: Record<string, unknown>): Promise<
  { ok: true; content: ClaudeContentBlock[] } | { ok: false; error: ClaudeError }
> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    return { ok: false, error: { status: 500, message: 'AI is not configured for this app.' } };
  }

  let res: Response;
  try {
    res = await fetch('https://ai.gateway.lovable.dev/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({ model: CLAUDE_MODEL, ...body }),
    });
  } catch (_e) {
    return { ok: false, error: { status: 503, message: 'Could not reach the AI service. Check your connection.' } };
  }

  if (!res.ok) {
    let message = 'The AI service returned an error.';
    try {
      const j = await res.json();
      message = j?.message || j?.error?.message || message;
    } catch { /* keep default */ }
    if (res.status === 402) message = 'AI credits are used up. Add credits in Settings → Plans & credits.';
    if (res.status === 429) message = 'Too many AI requests right now. Wait a moment and try again.';
    return { ok: false, error: { status: res.status, message } };
  }

  const data = await res.json();
  return { ok: true, content: (data?.content || []) as ClaudeContentBlock[] };
}
