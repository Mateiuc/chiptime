# Tier A — security + sync race (P0 #4, #5, #6)

Three independent fixes. Order: **Item 1 first** (DB migration + service refactor — biggest blast radius), then Items 2 and 3 (each one file).

---

## Item 1 — `app_sync` version check + index (P0 #6)

### Database migration

```sql
ALTER TABLE public.app_sync
  ADD COLUMN data_version BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS app_sync_workspace_id_idx
  ON public.app_sync(workspace_id);
```

No data backfill needed. Existing rows start at `0`; the first push from any client uses the freshly-fetched server value as `expectedVersion`, so no stampede.

### `src/services/appSyncService.ts` — new contract

- New module-local cache `lastKnownVersion: number | null` (mirrors the existing `LOCAL_UPDATED_AT_KEY` pattern, but in-memory only — no localStorage).
- New typed `class VersionConflictError extends Error { remoteData; remoteVersion; }`.
- `pullFromCloud()` → returns `{ data, updatedAt, version }`. Sets `lastKnownVersion = version`.
- `getRemoteVersion()` → `SELECT data_version` only (lightweight). Used by the "first-push after deploy" path.
- `pushToCloud(data, opts?)` → new signature:
  - If `lastKnownVersion === null`, call `getRemoteVersion()` first to seed it (covers fresh tabs + post-deploy bootstrap).
  - Try a conditional `UPDATE ... SET data = $1, data_version = data_version + 1, updated_at = now() WHERE workspace_id = $2 AND data_version = $3 RETURNING data_version, updated_at`.
  - If 0 rows: re-fetch `data + version` and throw `VersionConflictError` with the fresh payload.
  - If 1 row: update `lastKnownVersion`, set `LOCAL_UPDATED_AT_KEY`, return `{ version, updatedAt }`.
  - Insert (no row exists at all): plain `insert` with `data_version = 1`. If insert hits unique-violation on `sync_id`, retry once via the conditional UPDATE path.
- Sanitization (strip `accessCode` / OCR keys) is preserved unchanged.

### `src/hooks/useStorage.ts` — conflict handling

Each mutation hook (`useClients/useVehicles/useTasks/useSettings`) already calls `immediatePushToCloud()` after writing local. Change:

- `immediatePushToCloud(changedIds?)` accepts an optional `{ clients?: string[]; vehicles?: string[]; tasks?: string[]; settingsChanged?: boolean }` so each hook can declare what it just edited.
- Wrap the `pushToCloud` call in try/catch.
  - On `VersionConflictError`:
    1. Take the conflict's `remoteData`.
    2. Build a merged snapshot: for each entity array, **local wins for any id in `changedIds`, remote wins for everything else**. For settings: local wins iff `settingsChanged`, else remote.
    3. Detect "real" conflict: if any `changedIds` entry has a counterpart on remote that differs from the local pre-merge value (i.e. someone else also edited the same row). When detected, fire a toast: `"Your changes conflicted with a recent sync. Some fields may have been overwritten — please reload if anything looks wrong."` (variant: destructive, 8s).
    4. Persist the merged snapshot to capacitorStorage + replaceAll into React state.
    5. Retry `pushToCloud(merged)` once (now with the fresh `lastKnownVersion`). If it conflicts again, surface a hard toast `"Sync conflict — please reload to see latest data."` and stop. No infinite retry loop.
  - On any other error: keep the existing 5 s retry-once behavior.
- The five mutations already pass through `setClients`/`setVehicles`/`setTasks`/`setSettings` — wire `changedIds` from each (`addClient` → `[client.id]`, `updateClient` → `[id]`, `deleteClient` → `[id]`, etc.). `replaceAll` callers (used by cloud-pull only) skip the push entirely (no change there).
- `pushNow(snapshot)` (desktop path): same conflict flow, but the desktop snapshot doesn't track `changedIds` — treat all entities as "local wins" on conflict and always show the soft toast.

### Files touched (Item 1)

- `supabase/migrations/<ts>_app_sync_version.sql` (new — created via the migration tool)
- `src/services/appSyncService.ts`
- `src/hooks/useStorage.ts`

---

## Item 2 — Portal HTML XSS hardening (P0 #4)

Single file: `src/lib/clientPortalUtils.ts`. The portal HTML is a string template; the script block is what runs on the client. I audited every interpolation site between lines ~625 and ~750. Findings:

| Line | Interpolation | Context | Status |
|---|---|---|---|
| 688 | `esc(s.n)` | innerHTML text | ✅ already escaped |
| 690 | vehicle name | text inside esc() | ✅ |
| 692 | `esc(v.vin)` | text | ✅ |
| 695 | session date / desc / status | text via esc() | ✅ |
| 698 | `fmtTime(pd[0/1])` | numeric, controlled | ✅ |
| 706 | `<img src="'+esc(url)+'"` | **HTML attribute** — `esc()` only escapes `<>&`, NOT `"` | ❌ XSS via `url = 'x" onerror=alert(1)'` |
| 709 | diagnostic PDF href | same attr issue + arbitrary URL | ❌ |
| 712 | part name | text via esc() | ✅ |
| 740 | payment method `pm.u` href + `pm.i` icon + `pm.l` label | href has attr-escape issue; `pm.i` is interpolated **raw** | ❌ |
| 740 (else branch) | `s.pl` href + `s.plbl` label | same attr issue | ❌ |
| 746 | lightbox `'+urls[ci]+'` inside `ov.innerHTML = ...'<img src="'+urls[ci]+'"...'` | **fully unescaped** | ❌ critical |

### Fixes (all inline in the generated portal `<script>` block)

1. **Strengthen `esc()`** to also handle `"` and `'`:
   ```js
   function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
   ```
2. **Add `safeUrl(u, allowExternal)`**: parses with `new URL(u)`, returns `''` unless protocol is `https:`. When `allowExternal=false` (photos, diagnostic PDFs), additionally require host matches `/\.supabase\.co$/`. When `allowExternal=true` (payment methods), accept any `https:`. Return value is plain string suitable for further `esc()`.
3. **Photos (L706)**: build `src` as `esc(safeUrl(url, false))`, fall back to a 1x1 transparent data URL if rejected. Wrap each thumbnail click handler with the URL pre-validated and JSON-encoded once into a `data-urls` attribute, not interpolated as JS.
4. **Diagnostic PDF (L709)**: `href="'+esc(safeUrl(ss.dpdf, false))+'"`; if empty, omit the link entirely.
5. **Payment links (L740)**: `safeUrl(pm.u, true)` + `esc(pm.l)`; for `pm.i` (icon) treat as text only — `esc(pm.i)`. Same for `s.pl` / `s.plbl`.
6. **Lightbox `openLB` (L744–748)**: rewrite using DOM construction:
   - Create elements via `document.createElement`.
   - Assign URL via `imgEl.setAttribute('src', safeUrl(urls[ci], false))`.
   - Counter, prev/next buttons, close `×` all via `textContent`.
   - No more `innerHTML` inside the overlay.
7. **PIN catch (P1 #24 piggyback)**: the existing `tryDecrypt(pin).then(...).catch(...)` (L668–679) already handles the rejection cleanly (resets inputs, shows "Incorrect code"). Confirmed working. Add a synchronous guard at the top of `verifyPin` for missing `E.salt/E.iv/E.ct` (corrupt payload) that hits the same error path so the screen never hangs even on malformed envelopes.

### Files touched (Item 2)

- `src/lib/clientPortalUtils.ts` only.

---

## Item 3 — PIN constant-time compare (P0 #5)

Single file: `supabase/functions/get-portal/index.ts`.

Add at module top:

```ts
function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
```

Replace L90 `if (code !== data.access_code)` with `if (!constantTimeEqual(code, data.access_code))`. Length check stays — portal PINs are fixed-length (4), so length is not secret in this context.

### Verification (Item 3)

After deploy, hit `get-portal` 100× each with three PINs (correct, half-correct, wholly wrong) via `supabase--curl_edge_functions`, capture latency, report median + IQR. Expect indistinguishable distributions for the two wrong-PIN cases. (The brute-force lockout fires after 3 attempts per portal id, so the timing test will run against a freshly seeded test portal id, or I'll temporarily widen the lock window for the test; I'll create a throwaway portal row for measurement and clean it up after.)

---

## Verification summary (all three items)

- **Item 1**: open desktop + mobile preview tabs side-by-side on the same workspace. Edit task A in tab 1, task B in tab 2. Both persist, both versions reflect both edits after refresh. Then edit task A in both tabs simultaneously — second push reconciles, soft toast fires, both edits visible (one wins per field), no silent loss. Confirm `data_version` increments monotonically via a `read_query` after each push.
- **Item 2**: temporarily seed a test client with photo URL `https://attacker.example/x.png" onerror=alert(1)` and a session description `<script>alert('xss')</script>`; generate the portal HTML, open in a fresh tab, confirm no alert + thumbnail substituted with placeholder + description rendered as visible text. Bad PIN never hangs.
- **Item 3**: latency table from the curl loop (medians within ~5 ms of each other). Manual: correct PIN unlocks, wrong PIN returns 403.

After all three pass, Tier A is closed. Tier B (math consolidation + `formatCurrency` ceil) is the natural next batch.
