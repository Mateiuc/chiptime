

# Fix Diagnostic PDF Duplication + Photo Lightbox Cut Off

## Issues

1. **Diagnostic PDF shown per session instead of per task**: `calculateClientCosts` sets `diagnosticPdfUrl` on every session within a task. If a task has 3 sessions, the link appears 3 times. Fix: only attach it to the **first** session of each task.

2. **Photo lightbox showing only half**: The `Dialog` component uses `absolute inset-0` positioning (designed for the mobile phone frame preview). On the actual client portal page (no phone frame), `absolute` doesn't cover the full viewport when scrolled — it clips. Fix: use a custom `fixed` overlay for the lightbox instead of the Dialog component.

## Changes

### 1. `src/lib/clientPortalUtils.ts` — Deduplicate diagnostic PDF
In `calculateClientCosts`, only set `diagnosticPdfUrl` on the first session of each task (track with a boolean flag per task iteration).

### 2. `src/components/ClientCostBreakdown.tsx` — Fix photo lightbox
Replace the `<Dialog>` lightbox with a plain `fixed inset-0` overlay div (using a React portal to `document.body`). This ensures full-screen coverage regardless of scroll position or container. Keep the same prev/next/keyboard navigation.

### Files
1. `src/lib/clientPortalUtils.ts`
2. `src/components/ClientCostBreakdown.tsx`

