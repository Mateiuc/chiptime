import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { __test } from "./cors.ts";

const { originAllowed } = __test;

// Configure allowlist via env. Set BEFORE import would be ideal, but
// originAllowed reads env on every call, so setting here works.
Deno.env.set("LOVABLE_PREVIEW_ORIGIN", "*.lovable.app,https://chiptime.lovable.app");
Deno.env.delete("APP_ENV"); // non-production, so localhost is allowed

Deno.test("canonical production origin is allowed", () => {
  assertEquals(originAllowed("https://chiptime.chipplc.one"), true);
});

Deno.test("legitimate *.lovable.app subdomains match", () => {
  assertEquals(originAllowed("https://abc.lovable.app"), true);
  assertEquals(originAllowed("https://id-preview--bf13d8da.lovable.app"), true);
});

Deno.test("evil-lovable.app must NOT match *.lovable.app", () => {
  // No leading dot → endsWith('.lovable.app') is false. Bypass blocked.
  assertEquals(originAllowed("https://evil-lovable.app"), false);
});

Deno.test("path-injection attempt must NOT match", () => {
  // URL parses host=attacker.com, path=/lovable.app → host check fails.
  assertEquals(originAllowed("https://attacker.com/lovable.app"), false);
});

Deno.test("http (non-https) wildcard subdomains rejected", () => {
  assertEquals(originAllowed("http://abc.lovable.app"), false);
});

Deno.test("bare wildcard suffix (no subdomain) rejected", () => {
  // host === 'lovable.app' has no leading-dot prefix beyond the suffix
  assertEquals(originAllowed("https://lovable.app"), false);
});

Deno.test("localhost allowed when not production", () => {
  assertEquals(originAllowed("http://localhost:5173"), true);
  assertEquals(originAllowed("http://localhost:8080"), true);
  assertEquals(originAllowed("http://127.0.0.1:5173"), true);
});

Deno.test("localhost rejected in production", () => {
  Deno.env.set("APP_ENV", "production");
  try {
    assertEquals(originAllowed("http://localhost:5173"), false);
  } finally {
    Deno.env.delete("APP_ENV");
  }
});

Deno.test("unknown origin rejected", () => {
  assertEquals(originAllowed("https://evil.example.com"), false);
});

Deno.test("malformed origin rejected", () => {
  assertEquals(originAllowed("not a url"), false);
  assertEquals(originAllowed(""), false);
});
