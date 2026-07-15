declare const process: { env: Record<string, string | undefined> };
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

export default defineTool({
  name: "list_schedule",
  title: "List scheduled jobs",
  description:
    "List upcoming or open ChipTime schedule entries (jobs planned but not yet started).",
  inputSchema: {
    status: z
      .enum(["scheduled", "started", "cancelled"])
      .optional()
      .describe("Filter by schedule status (default: scheduled)."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: mem } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!mem) return { content: [{ type: "text", text: "No workspace" }], isError: true };
    const { data: sync } = await supabase
      .from("app_sync")
      .select("data")
      .eq("workspace_id", mem.workspace_id)
      .maybeSingle();
    const data = (sync?.data as any) || {};
    const clientsById = new Map((data.clients || []).map((c: any) => [c.id, c]));
    const vehiclesById = new Map((data.vehicles || []).map((v: any) => [v.id, v]));
    const filterStatus = status ?? "scheduled";
    let entries = (data.schedule || []).filter((s: any) => s.status === filterStatus);
    entries.sort(
      (a: any, b: any) =>
        new Date(a.scheduledAt || a.createdAt || 0).getTime() -
        new Date(b.scheduledAt || b.createdAt || 0).getTime(),
    );
    const rows = entries.slice(0, limit ?? 50).map((s: any) => {
      const client: any = clientsById.get(s.clientId);
      const vehicle: any = vehiclesById.get(s.vehicleId);
      return {
        id: s.id,
        client: client?.name,
        vehicle: vehicle
          ? `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim()
          : null,
        requestedWork: s.requestedWork,
        scheduledAt: s.scheduledAt,
        notes: s.notes,
      };
    });
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { entries: rows, total: entries.length },
    };
  },
});
