

## Fix: Missing Vehicle Data + Remove Back Arrow from Client Portal

Two issues to fix:

---

### Issue 1: Client Portal Receives Incomplete Data

**Root Cause**: When work is completed in `handleCompleteWork` (Index.tsx line 267-308), the cloud sync fires on line 300 using the `tasks` state variable -- but `updateTask` on line 283 is async and hasn't updated the state yet. So the portal gets synced with **stale task data** (missing the just-completed session description, parts, and status).

**Fix**: Build the updated tasks array manually before passing it to `syncPortalToCloud`, rather than relying on the not-yet-updated React state:

```text
// In handleCompleteWork, after updateTask call:
const updatedTasks = tasks.map(t =>
  t.id === activeTask.id
    ? { ...t, status: 'completed', sessions: updatedSessions, needsFollowUp }
    : t
);
syncPortalToCloud(client, vehicles, updatedTasks, settings.defaultHourlyRate)
```

Also apply the same fix in `ManageClientsDialog.tsx` -- although it already re-syncs on share click, ensuring it always reads the latest from storage would make it more robust.

---

### Issue 2: Remove Back Arrow from Client Portal

**What changes**: Remove the `ChevronLeft` back button from the client portal header in all three views (PIN screen, cost breakdown, and error state) inside `ClientPortal.tsx`. The client should not see a "back" arrow since they don't have access to the main app.

Affected lines in `ClientPortal.tsx`:
- Lines 101-103 (error state back button)
- Lines 113-115 (PIN screen header back button)
- Lines 158-160 (cost breakdown header back button)

---

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Index.tsx` (lines 297-307) | Build fresh tasks array with completed session data before calling `syncPortalToCloud` |
| `src/pages/ClientPortal.tsx` (lines 101-103, 113-115, 158-160) | Remove all back arrow buttons from portal views |

