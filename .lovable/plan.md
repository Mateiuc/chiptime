

# Fix Client Portal — Pass All Rates to Cloud Sync

## Problem
`syncPortalToCloud()` only passes `defaultHourlyRate` to `calculateClientCosts()`, but the function needs all 5 rate parameters (hourly, cloning, programming, addKey, allKeysLost). This means cloud-synced portal data shows $0 for all specialty rates. The fallback path (URL hash encoding) correctly passes all rates, but the cloud sync path does not.

This affects every place the portal is synced: share link, mark billed, mark paid, complete work, and portal preview.

## Changes

### 1. `src/lib/clientPortalUtils.ts` — Update `syncPortalToCloud` signature
Add the 4 missing optional rate parameters and pass them through to `calculateClientCosts`:
- `defaultCloningRate?: number`
- `defaultProgrammingRate?: number`
- `defaultAddKeyRate?: number`
- `defaultAllKeysLostRate?: number`

### 2. `src/pages/DesktopDashboard.tsx` — Update all 5 call sites
Pass `settings.defaultCloningRate, settings.defaultProgrammingRate, settings.defaultAddKeyRate, settings.defaultAllKeysLostRate` to every `syncPortalToCloud(...)` call:
- `handleMarkBilled` (line 589)
- `handleMarkPaid` (line 602)
- Share link button (lines 1129, 1132)
- Portal preview button (line 1166)

Also re-sync portal data before opening preview (Eye button) so portal always shows latest data.

### 3. `src/pages/Index.tsx` — Update all 3 call sites
Pass all rate settings to `syncPortalToCloud` calls in:
- `handleCompleteWork` (line 327)
- `handleMarkBilled` (line 435)
- `handleMarkPaid` (line 454)

### 4. `src/components/DesktopClientsView.tsx` — Update 2 call sites
Pass all rates in the `handleShareLink` function (lines 179, 182).

### 5. `src/components/ManageClientsDialog.tsx` — Update call sites
Pass all rates to `syncPortalToCloud` calls in the share link handler.

## Files to edit
1. `src/lib/clientPortalUtils.ts`
2. `src/pages/DesktopDashboard.tsx`
3. `src/pages/Index.tsx`
4. `src/components/DesktopClientsView.tsx`
5. `src/components/ManageClientsDialog.tsx`

