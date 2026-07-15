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
  if (!mem) throw new Error("No workspace found");
  const { data: sync } = await supabase
    .from("app_sync")
    .select("data")
    .eq("workspace_id", mem.workspace_id)
    .maybeSingle();
  return (sync?.data as any) || {};
}

export default defineTool({
  name: "list_tasks",
  title: "List tasks",
  description:
    "List work tasks in the user's ChipTime workspace. Filter by status and/or client. Sessions and photos are omitted; use get_task for details.",
  inputSchema: {
    status: z
      .enum(["pending", "in-progress", "paused", "completed", "billed", "paid"])
      .optional()
      .describe("Filter by task status."),
    clientId: z.string().optional().describe("Filter to tasks for a specific client id."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, clientId, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const data = await loadWorkspaceData(ctx);
    const clientsById = new Map(
      (data.clients || []).map((c: any) => [c.id, c]),
    );
    let tasks = Array.isArray(data.tasks) ? data.tasks : [];
    if (status) tasks = tasks.filter((t: any) => t.status === status);
    if (clientId) tasks = tasks.filter((t: any) => t.clientId === clientId);
    tasks.sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
    const rows = tasks.slice(0, limit ?? 50).map((t: any) => ({
      id: t.id,
      status: t.status,
      customerName: t.customerName || (clientsById.get(t.clientId) as any)?.name,
      carVin: t.carVin,
      totalTimeSeconds: t.totalTime,
      createdAt: t.createdAt,
      paidAt: t.paidAt,
      sessionCount: (t.sessions || []).length,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { tasks: rows, total: tasks.length },
    };
  },
});
