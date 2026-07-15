// Ambient declaration for the Node/Deno `process` object used by MCP tool
// handlers. Those handlers run inside a Deno edge function (which shims
// `process.env`) — but the source lives in the Vite project, which is
// browser-typed. Declaring it here keeps the MCP tool files import-safe
// without pulling `@types/node` into the whole app.
declare const process: { env: Record<string, string | undefined> };
