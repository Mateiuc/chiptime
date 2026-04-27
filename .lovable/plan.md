## Investigation result

I re-read `src/pages/Index.tsx` and the collapse logic **is correctly implemented**:

- Line 92: `expandedClients` starts as an **empty Set** → every group is collapsed.
- Lines 791 & 856: Task list only renders when `!isCollapsed`.
- No other code anywhere in the project mutates `expandedClients` on mount.

So in the web preview, every client group **must** load collapsed. If you're still seeing them expanded, the cause is almost certainly one of these:

### Most likely cause: stale app on your phone
You're testing on the installed mobile app (Capacitor/PWA). Capacitor bundles the JS at build time, and PWAs aggressively cache. Your phone is still running the **old** JS where groups defaulted to expanded. The fix in code is already there — your device just hasn't picked it up.

### What to do

**Option A — Quick check (no code change needed):**
1. Open the **web preview** (https://chiptime.lovable.app) in your phone browser, hard-refresh (close tab, reopen). Groups should be collapsed. This proves the code works.
2. If yes → the installed app needs a fresh build/install to get the new JS.

**Option B — If even the web preview shows them expanded**, then I'll add diagnostic changes:
1. Add a `console.log('[Index] expandedClients on mount', expandedClients.size)` to confirm initial state.
2. Check if anything in `useStorage`/sync is causing a remount that loses state — unlikely, but worth verifying.
3. Force-reset `expandedClients` to empty whenever the active tab changes, as a defensive measure.

### My recommendation
Try Option A first (open the published web URL on your phone in a fresh browser tab). That will tell us in 10 seconds whether this is a code problem or a stale-build problem — and save us from changing code that's already correct.

Reply telling me which you see in the **web browser** (not the installed app):
- ✅ Collapsed in browser → it's a stale install; rebuild & reinstall the mobile app.
- ❌ Still expanded in browser → approve this plan and I'll add the diagnostics in Option B.