import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClientsTool from "./tools/list-clients";
import listTasksTool from "./tools/list-tasks";
import getTaskTool from "./tools/get-task";
import listScheduleTool from "./tools/list-schedule";

// OAuth issuer must be the direct Supabase auth host, derived from the
// project ref at build time — never from SUPABASE_URL (which may be a
// .lovable.cloud proxy on Cloud). The fallback keeps the issuer well-formed
// during the manifest-extract eval where a token never verifies.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "chiptime-mcp",
  title: "ChipTime MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for ChipTime — an automotive service time & billing app. Use list_clients to find a customer, list_tasks to see current or completed work orders (filter by status), get_task for full session/parts/jobs detail on one work order, and list_schedule for upcoming jobs on the shop calendar. All calls act as the signed-in ChipTime user and are scoped to their workspace.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listClientsTool, listTasksTool, getTaskTool, listScheduleTool],
});
