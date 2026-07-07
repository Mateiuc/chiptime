## Problem

The client PIN (access code) can silently change on its own. Two paths cause it:

1. **`syncPortalToCloud`** always sends an `accessCode` to the backend. If the local client record doesn't have one (e.g. it was pulled from cloud sync, which strips the PIN for security), it calls `generateAccessCode()` and sends a **brand-new PIN**, which the edge function then upserts over the real one stored in the portal row.
2. The **`sync-portal` edge function** unconditionally overwrites `access_code` on every upsert, so any accidental new value from step 1 replaces the good one.

The user wants: once a PIN is generated, it stays fixed until they explicitly regenerate it.

## Fix

Make the stored PIN authoritative and only change it on an explicit regenerate action.

### 1. `supabase/functions/sync-portal/index.ts`
- Accept an optional `regenerate: boolean` flag in the request body.
- When upserting:
  - If the row already exists and `regenerate` is not true → **keep the existing `access_code`** (don't overwrite, even if the caller sent one).
  - If the row is new → store whatever `accessCode` was sent (or leave null if none).
  - If `regenerate === true` → store the new `accessCode` sent by the caller.
- Always return the **effective** `access_code` from the DB row after the upsert, so the client can persist the true value locally.

### 2. `src/lib/clientPortalUtils.ts` — `syncPortalToCloud`
- Add an optional `opts?: { regenerate?: boolean }` parameter (keep the long positional signature intact; add as final arg).
- Do **not** call `generateAccessCode()` implicitly. Only send an `accessCode` when:
  - `client.accessCode` exists (pass it through for new-row creation), OR
  - `opts.regenerate === true` (generate a fresh one and send it with `regenerate: true`).
- Otherwise send `accessCode: null` and let the edge function preserve/leave-empty.
- Return the `access_code` the server reports back (authoritative), so callers can `updateClient({ accessCode })` with the true value — this also heals devices that lost the PIN via the security strip in `appSyncService`.

### 3. Callers — stop implicit regeneration on Copy/Share
Files: `src/components/ManageClientsDialog.tsx`, `src/components/DesktopClientsView.tsx`, `src/pages/DesktopDashboard.tsx`, `src/pages/Index.tsx`.

- The auto-sync paths in `Index.tsx` (lines 386, 498, 521) and the "Copy PIN" / "Copy Link" buttons must call `syncPortalToCloud` **without** `regenerate`. They then update the local client with the `accessCode` returned from the server (so a device that pulled a stripped client record gets healed to the real PIN).
- Add an explicit **"Regenerate PIN"** action (small button/menu item next to the existing PIN chip in `ManageClientsDialog` and `DesktopClientsView`) that:
  - Confirms with the user ("This will invalidate the current PIN. Continue?").
  - Calls `syncPortalToCloud(..., { regenerate: true })`.
  - Updates local client with the returned `accessCode` and toasts the new PIN.

### 4. Local generation on first-ever share
Keep the current "Set PIN" flow (`client.accessCode || generateAccessCode()` in the two places at `ManageClientsDialog.tsx:656` and `DesktopClientsView.tsx:163`) — that's the initial creation before any cloud row exists, and it only fires when there is no local `accessCode`. No change needed there.

## Not changing
- `appSyncService.ts` continues to strip `accessCode` from the app-sync blob (security). Healing happens via the sync-portal response instead.
- PIN storage schema, RLS, rate limiting, `get-portal` verification flow.
- `src/pages/ClientPortal.tsx` — no UI changes needed there.

## Files touched
- `supabase/functions/sync-portal/index.ts`
- `src/lib/clientPortalUtils.ts`
- `src/components/ManageClientsDialog.tsx`
- `src/components/DesktopClientsView.tsx`
- `src/pages/DesktopDashboard.tsx`
- `src/pages/Index.tsx`
