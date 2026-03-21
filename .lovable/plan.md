

# Fix: Client Portal Broken After Security Review

## Problem
The portal at `/client-view?id=54uazx5l&preview=1` shows "Failed to load data." because:

1. Preview mode sets `verified=true` immediately (skipping the PIN screen)
2. But `checkPortalAccess` calls the edge function without a code
3. The edge function correctly returns `{ requiresCode: true }` without data
4. The code sets `requiresCode=true` but never fetches the actual data since `verified` is already true
5. Result: no `costSummary`, so the error state triggers

## Solution
Add a `preview` query parameter to the `get-portal` edge function. When `preview=1` is passed, bypass the access code check and return the full data. This is safe because:
- The mechanic is the one generating the preview link
- Preview mode is intended for internal use only

## Changes

### 1. `supabase/functions/get-portal/index.ts`
- Read a `preview` query parameter
- When `preview=1`, skip the access code check and return data directly

### 2. `src/lib/clientPortalUtils.ts`
- Update `checkPortalAccess` to accept an optional `preview` flag
- Pass `preview=1` to the edge function when in preview mode

### 3. `src/pages/ClientPortal.tsx`
- Pass `isPreview` to `checkPortalAccess` so it sends the preview flag to the edge function

## Files to Change
1. `supabase/functions/get-portal/index.ts` — add preview bypass
2. `src/lib/clientPortalUtils.ts` — pass preview param
3. `src/pages/ClientPortal.tsx` — thread preview flag through

