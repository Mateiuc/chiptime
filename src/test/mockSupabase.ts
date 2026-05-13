import { vi } from "vitest";

export type QueuedResult = { data: any; error: any };

export interface MockSupabase {
  supabase: any;
  /** Push results FIFO; each terminal call (await / maybeSingle / single) consumes one. */
  queue: QueuedResult[];
  /** Recorded call log: every chainable method invocation. */
  calls: Array<{ method: string; args: any[] }>;
  /** Captured payloads passed to update/insert/upsert. */
  payloads: Array<{ op: "update" | "insert" | "upsert"; data: any }>;
  reset(): void;
}

export function createMockSupabase(): MockSupabase {
  const ms: MockSupabase = {
    supabase: null,
    queue: [],
    calls: [],
    payloads: [],
    reset() {
      ms.queue.length = 0;
      ms.calls.length = 0;
      ms.payloads.length = 0;
    },
  };

  const next = (): QueuedResult => {
    if (ms.queue.length === 0) {
      throw new Error("mockSupabase: no queued result for terminal call");
    }
    return ms.queue.shift()!;
  };

  const makeBuilder = () => {
    // Builder is both thenable (so `await builder` resolves) and chainable.
    const builder: any = {};
    const record = (method: string, args: any[]) => {
      ms.calls.push({ method, args });
    };
    const chain = (method: string) =>
      (...args: any[]) => {
        record(method, args);
        return builder;
      };

    builder.select = chain("select");
    builder.eq = chain("eq");
    builder.neq = chain("neq");
    builder.order = chain("order");
    builder.limit = chain("limit");

    builder.update = (data: any) => {
      ms.payloads.push({ op: "update", data });
      ms.calls.push({ method: "update", args: [data] });
      return builder;
    };
    builder.insert = (data: any) => {
      ms.payloads.push({ op: "insert", data });
      ms.calls.push({ method: "insert", args: [data] });
      return builder;
    };
    builder.upsert = (data: any) => {
      ms.payloads.push({ op: "upsert", data });
      ms.calls.push({ method: "upsert", args: [data] });
      return builder;
    };

    builder.maybeSingle = async () => next();
    builder.single = async () => next();

    // Make builder awaitable (for chains that don't end in maybeSingle/single)
    builder.then = (resolve: any, reject: any) => {
      try {
        const r = next();
        return Promise.resolve(r).then(resolve, reject);
      } catch (e) {
        return Promise.reject(e).then(resolve, reject);
      }
    };
    return builder;
  };

  ms.supabase = {
    from: (table: string) => {
      ms.calls.push({ method: "from", args: [table] });
      return makeBuilder();
    },
  };

  return ms;
}

export const mockSupabaseInstance = createMockSupabase();

/** Helper to install the singleton mock for `vi.mock('@/integrations/supabase/client')`. */
export function getMockedSupabase() {
  return mockSupabaseInstance;
}
