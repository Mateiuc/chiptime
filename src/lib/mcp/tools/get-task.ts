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
  name: "get_task",
  title: "Get task detail",
  description:
    "Fetch a single ChipTime task with its work sessions, parts, jobs, and billing status. Photo binary data is omitted.",
  inputSchema: {
    taskId: z.string().min(1).describe("Task id (from list_tasks)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ taskId }, ctx) => {
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
    const task = (data.tasks || []).find((t: any) => t.id === taskId);
    if (!task) return { content: [{ type: "text", text: "Task not found" }], isError: true };
    const client = (data.clients || []).find((c: any) => c.id === task.clientId);
    const vehicle = (data.vehicles || []).find((v: any) => v.id === task.vehicleId);
    const sessions = (task.sessions || []).map((s: any) => ({
      id: s.id,
      description: s.description,
      createdAt: s.createdAt,
      completedAt: s.completedAt,
      periods: (s.periods || []).map((p: any) => ({
        startTime: p.startTime,
        endTime: p.endTime,
        duration: p.duration,
      })),
      parts: s.parts || [],
      jobs: s.jobs || [],
      extraCharge: s.extraCharge,
      photoCount: (s.photos || []).length,
    }));
    const detail = {
      id: task.id,
      status: task.status,
      customerName: task.customerName || client?.name,
      carVin: task.carVin,
      vehicle: vehicle
        ? { year: vehicle.year, make: vehicle.make, model: vehicle.model, color: vehicle.color }
        : null,
      totalTimeSeconds: task.totalTime,
      createdAt: task.createdAt,
      paidAt: task.paidAt,
      needsFollowUp: task.needsFollowUp,
      importedSalary: task.importedSalary,
      sessions,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
      structuredContent: detail,
    };
  },
});
