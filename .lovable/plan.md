Plan:

1. Fix worker attribution when timers start/resume
   - Update the desktop timer start/resume logic so every new session is stamped with the current worker id.
   - When a timer period is created on stop/auto-pause, stamp that period with the same current worker id.
   - If a task/session was created before worker attribution existed, fill missing `createdBy` with the current user when that worker starts or stops the session.

2. Fix the visible chip fallback
   - Update `useWorkers().getWorker()` so if a user id exists but the profile map has not loaded yet, the chip shows a short fallback instead of a blank/unknown-looking value.
   - Keep the intended priority: nickname (`Chip`) first, then first display name (`Ciprian`), then email local-part.

3. Keep mobile consistent
   - The mobile page has separate timer logic and currently does not stamp worker ids in several paths, so apply the same worker-id stamping there too.
   - This prevents future sessions started from the phone view from showing no worker.

4. Verify
   - Check the profile request already returns `nickname: "Chip"`, so no database change is needed.
   - Verify the session row renders the chip using `Chip` once `createdBy` is present.