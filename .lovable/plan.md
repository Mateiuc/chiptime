

# Fix: SyncKeyPrompt Showing Twice on Mobile + Sync Key Mismatch

## Two Problems

### Problem 1: SyncKeyPrompt appears twice on mobile
The effect that decides whether to show the prompt depends on `[syncing, syncChecked, clients.length, tasks.length]`. When a cloud pull completes:
1. `syncing` goes `false` → effect fires, sees `clients.length === 0` (state hasn't updated yet), shows prompt
2. Milliseconds later, `clients.length` changes to N → effect re-fires, but prompt already shown

The 500ms timeout helps but doesn't fully prevent the race. The prompt can flash, close when data arrives, then re-trigger.

### Problem 2: Desktop doesn't ask for code (this is CORRECT)
The desktop at `/chip` has sync key stored in browser Preferences. On refresh it pulls successfully using that key and loads data. No prompt needed. This is working as intended.

### Problem 3: Multiple sync keys in database
There are 5 different sync keys in the `app_sync` table, all with similar data sizes (~24KB). This suggests mobile may be generating new keys instead of reusing the stored one, or the user linked keys multiple times. The active key appears to be `c2c4cedb36129ec1a2541c195c3d1875`.

## Fix

### 1. Fix double-prompt race condition (`src/pages/Index.tsx`)
- Change the effect to only run once after `syncing` transitions from `true` to `false`
- Use a ref to track if we've already checked, preventing re-triggers from state changes
- Add a longer delay (1000ms) after sync completes to let `replaceAll` state updates settle before checking emptiness

```text
Current flow:
  syncing=true → syncing=false → effect fires (clients=0) → SHOW PROMPT
  → replaceAll(clients) → clients=5 → effect fires again → SHOW PROMPT AGAIN

Fixed flow:
  syncing=true → syncing=false → wait 1s → check clients/tasks → decide once
  (syncChecked ref prevents any re-trigger)
```

### 2. Guard against re-renders in the dependency array
- Remove `clients.length` and `tasks.length` from the effect dependencies
- Only depend on `syncing` — check data length inside the timeout callback using a fresh read from storage instead of stale React state

### What stays the same
- Desktop prompt logic (already works correctly)
- Sync key generation, storage, push/pull
- Edge function and RLS
- All other components

