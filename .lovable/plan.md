

# Fix: Data Not Loading After Security Changes

## What Happened

The security fix replaced the hardcoded sync ID (`chiptime-default`) with a random key. This is correct for security, but created a problem: every time the browser cache clears (including Lovable preview reloads), a brand new empty sync key is generated. The app then looks up that new key in the cloud, finds nothing, and shows empty data.

Your data is safe in the cloud — 12 clients, 30 vehicles, 29 tasks including Session 8 (the ~6h GLS session) — all under sync key `c2c4cedb36129ec1a2541c195c3d1875`.

## Root Cause

The mobile page (`src/pages/Index.tsx`) has NO recovery prompt. The desktop has `SyncKeyPrompt`, but the mobile view just silently shows empty data when the key is lost.

## Fix

### 1. Add SyncKeyPrompt to mobile Index page (`src/pages/Index.tsx`)
- After cloud sync completes, if clients AND tasks are both empty AND no `localUpdatedAt` exists, show the `SyncKeyPrompt` dialog
- When user pastes their key or chooses "Start fresh", proceed normally
- Same component already used by desktop — just wire it into mobile

### 2. No other file changes
- `appSyncService.ts` — no changes
- `useStorage.ts` — no changes
- `SyncKeyPrompt.tsx` — no changes (already works correctly)

### What this fixes
- After any cache clear on mobile web or Lovable preview, the app prompts you to enter your existing sync key instead of silently creating an empty row
- Once you paste key `c2c4cedb36129ec1a2541c195c3d1875`, all 12 clients and 29 tasks load immediately

