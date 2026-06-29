## Goal
Revert desktop to fully manual cloud I/O. No automatic pulls, no automatic pushes. The user explicitly clicks **Reload** to pull from cloud and **Save** to push to cloud. Mobile stays as it is today (auto-sync, master).

## Header buttons (in the empty slot the user circled)

Two buttons, side by side, between **Vehicle** and **Clients**:

1. **Reload** — cloud-download icon. Pulls the latest cloud snapshot and replaces desktop state. Warns if there are unsaved local edits ("Reload will discard your unsaved changes. Continue?").
2. **Save** — cloud-upload icon. Pushes current desktop state to the cloud.
   - When there are unsaved changes → solid primary, label "Save (N)" where N = changed task count.
   - When clean → ghost, label "Saved".
   - While pushing → spinner + "Saving…".

A small "Last loaded / Last saved" timestamp sits under the pair.

## Behavior

### Desktop (changed back to manual)
- Remove auto-pull on window focus / visibility change.
- Remove auto-pull on mount beyond the very first load (first load still pulls once so the page isn't empty).
- Remove every implicit `cloudPatchTask` call from edit / stop / mark billed / mark paid / parts / etc. — those now mutate local state only and mark the task dirty.
- **Reload** = pull cloud snapshot → replace local state → clear dirty set.
- **Save** = for each dirty task, call existing `patchTaskInCloud` (per-task patch, NOT full snapshot, so mobile-only tasks are never touched) → clear dirty set on success.
- Beforeunload guard when dirty.

### Mobile (unchanged)
- `src/pages/Index.tsx` keeps auto-push on every mutation. No edits there.

## Conflict safety (lightweight)
Per-task patch already protects mobile-only tasks. For tasks the desktop edited:
- Save sends only the fields the desktop changed (existing patch API). It does not overwrite the whole row, so mobile's edits to other fields survive.
- No prompts, no merges — keep it simple, matches the "I decide" model.

## Files touched

- `src/pages/DesktopDashboard.tsx`
  - Add `dirtyTaskIds: Set<string>`, `lastLoadedAt`, `lastSavedAt`, `isLoading`, `isSaving` state.
  - Remove the focus/visibility auto-pull effect added in the earlier "mobile as master" change.
  - Replace every `cloudPatchTask(...)` call inside mutation handlers with a local `markDirty(taskId)` call.
  - Add `handleReload()` and `handleSave()`.
  - Render the two buttons in the header slot.
- New `src/components/DesktopSyncControls.tsx` (~70 lines) — presentational Reload + Save pair with status text.
- `src/hooks/useBeforeUnload.ts` (new, ~15 lines) — warns when dirty.

## Out of scope
- Mobile (`src/pages/Index.tsx`) is not touched.
- No changes to billing, deposit, portal sync, or photo upload paths.
- No automatic conflict prompts.
