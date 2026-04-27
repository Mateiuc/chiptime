I checked the backend data for workspace **Chip EV**.

Findings:
- Workspace **Chip EV** exists and has 1 member.
- Its workspace-specific sync row is missing, so the phone pulls nothing for that workspace.
- The actual current data exists in the older shared sync row `chiptime-default` with:
  - 20 clients
  - 54 vehicles
  - 53 tasks
  - updated 2026-04-26 01:27:57 UTC
- The app code now syncs by `workspace_id`, but older data is still stored in rows where `workspace_id` is empty. That is why clearing cache/login on mobile cannot find it.

Plan to fix:
1. Restore the existing cloud data into the **Chip EV** workspace sync row.
   - Copy the data from the existing `chiptime-default` cloud row into the Chip EV workspace row.
   - Use Chip EV workspace ID as the sync row ID so the current app can find it.

2. Fix the sync write conflict target.
   - `app_sync` currently only has a primary key on `sync_id`, but the code upserts with `onConflict: 'workspace_id'`.
   - Add a safe unique constraint/index for `workspace_id` where it is not null, or change the app upsert to use `sync_id` consistently.
   - I will use the safest path: keep `sync_id = workspaceId`, `workspace_id = workspaceId`, and make app upsert conflict on `sync_id` so it matches the existing primary key.

3. Make mobile pull more robust after cache clear.
   - Ensure `appSyncService` receives the resolved workspace ID before pull.
   - Keep the forced pull when local clients/vehicles/tasks are empty.
   - Add clearer logs for: workspace loaded, remote row found/missing, data applied.

4. Verify after implementation.
   - Confirm the Chip EV row contains the copied data counts.
   - Confirm TypeScript build passes.
   - The expected result: after clearing mobile browser/app cache, login resolves Chip EV and pulls 20 clients, 54 vehicles, and 53 tasks from cloud automatically.