import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

async function loadWorkspaceData(ctx: ToolContext) {
  const supabase = supabaseForUser(ctx);
  const { data: mem, error: memErr } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", ctx.getUserId())
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (memErr) throw new Error(memErr.message);
  if (!mem) throw new Error("No workspace found for user");
  const { data: sync, error: syncErr } = await supabase
    .from("app_sync")
    .select("data")
    .eq("workspace_id", mem.workspace_id)
    .maybeSingle();
  if (syncErr) throw new Error(syncErr.message);
  return { workspaceId: mem.workspace_id, data: (sync?.data as any) || {} };
}

export default defineTool({
  name: "list_clients",
  title: "List clients",
  description:
    "List clients in the signed-in user's ChipTime workspace, optionally filtered by a name/email substring search.",
  inputSchema: {
    search: z
      .string()
      .optional()
      .describe("Case-insensitive substring match against name, email, or company."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data } = await loadWorkspaceData(ctx);
    let clients = Array.isArray(data.clients) ? data.clients : [];
    if (search) {
      const q = search.toLowerCase();
      clients = clients.filter((c: any) =>
        [c.name, c.email, c.companyName, c.phone]
          .filter(Boolean)
          .some((v: string) => String(v).toLowerCase().includes(q)),
      );
    }
    const rows = clients.slice(0, limit ?? 50).map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      companyName: c.companyName,
      prepaidAmount: c.prepaidAmount,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { clients: rows, total: clients.length },
    };
  },
});
