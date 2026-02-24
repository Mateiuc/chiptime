
# Fix: Paid Tab Charts Should Use Payment Date

## Problem
The "Revenue by Month" and "Cars by Month" charts on the Paid tab currently group data by the **session creation date** (when the work was done). The user expects them to be grouped by the **date the task was marked as paid**.

## Solution
1. Add a `paidAt` timestamp to tasks when they are marked as paid
2. Pass this date through the portal data pipeline
3. Use it for chart grouping instead of the session date

## Changes

### 1. `src/types/index.ts`
- Add `paidAt?: Date` and `billedAt?: Date` fields to the `Task` interface

### 2. `src/pages/Index.tsx`
- In `handleMarkBilled`: store `billedAt: new Date()` alongside the status change
- In `handleMarkPaid`: store `paidAt: new Date()` alongside the status change
- Pass these dates in the `updatedTasks` array for cloud sync

### 3. `src/lib/clientPortalUtils.ts`
- Add `statusDate?: Date` to `SessionCostDetail` (the date when it entered its current status)
- In `calculateClientCosts`: set `statusDate` to `task.paidAt` (for paid), `task.billedAt` (for billed), or fall back to `session.createdAt`
- Add `sdt?: number` (status date timestamp) to `SlimSession`
- Update `slimDown` and `inflateSlimPayload` to handle `sdt`

### 4. `src/components/ClientCostBreakdown.tsx`
- In `monthlyData` computation: use `session.statusDate` (if available) instead of `session.date` when grouping paid sessions by month

## Backward Compatibility
- `paidAt` and `billedAt` are optional fields, so existing tasks without them still work
- The chart falls back to `session.date` if `statusDate` is not available (for older data)
- The slim format uses an optional `sdt` field, so older portal links still inflate correctly
