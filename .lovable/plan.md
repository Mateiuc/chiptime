

# Fix: App Can't Load Cloud Data

## Problem
The `app_sync` table has an RLS policy that blocks ALL access (`USING (false)`), but the app code (`appSyncService.ts`) tries to read/write the table directly using the anonymous client. Every sync attempt silently fails, so no data loads.

## Root Cause
A previous security hardening locked down `app_sync` with `USING (false)` for all operations. Unlike `client_portals` (which has an edge function proxy), `app_sync` has no edge function — the app accesses it directly. The lockdown broke all sync.

## Solution
Replace the restrictive RLS policy with one that allows public read/write access to `app_sync`. This table stores app data keyed by a sync ID and doesn't contain auth-protected data — it's designed for open device-to-device sync.

## Changes

### 1. Database Migration
```sql
DROP POLICY "No direct access to app_sync" ON public.app_sync;

CREATE POLICY "Allow public read access to app_sync"
ON public.app_sync FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to app_sync"
ON public.app_sync FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to app_sync"
ON public.app_sync FOR UPDATE USING (true);
```

### 2. No code changes needed
`appSyncService.ts` already uses `chiptime-default` as the sync ID and queries the table directly — it just needs the RLS to allow it through.

## What Happens After the Fix
- The app will attempt to pull data for sync_id `chiptime-default`
- If no row exists (your data is currently under device-specific keys), the app will seed a new `chiptime-default` row from local storage on next push
- Your mobile app's local data remains intact — sync is additive

