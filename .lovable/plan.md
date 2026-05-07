# Fix: "Portal" button does nothing on desktop

## Root cause

In `src/pages/DesktopDashboard.tsx` (lines ~1464–1474), the **Portal** button handler is:

```ts
onClick={async () => {
  const result = await syncPortalToCloud(...);   // async network call
  updateClient(...);
  window.open(`${PORTAL_BASE_URL}/client-view?id=${result.portalId}&preview=1`, '_blank');
}}
```

`window.open` runs **after** an `await`, so it is no longer tied to the original user click. Chrome/Edge/Safari treat this as a programmatic popup and silently block it — exactly matching the reported symptom: *nothing happens, no new tab*.

The Share button doesn't suffer from this because it copies to clipboard instead of opening a window.

## Fix

Open the tab **synchronously** at click time, then navigate it once `syncPortalToCloud` resolves.

### Change in `src/pages/DesktopDashboard.tsx` (Portal button, ~line 1464)

```ts
onClick={async () => {
  // Open the tab synchronously so the browser keeps the user-gesture trust
  const win = window.open('about:blank', '_blank');
  try {
    const result = await syncPortalToCloud(
      client, vehicles, tasks,
      settings.defaultHourlyRate, settings.defaultCloningRate,
      settings.defaultProgrammingRate, settings.defaultAddKeyRate,
      settings.defaultAllKeysLostRate,
      settings.paymentLink, settings.paymentLabel, settings.paymentMethods,
      client.portalLogoUrl || settings.portalLogoUrl,
      client.portalBgColor || settings.portalBgColor,
      client.portalBusinessName || settings.portalBusinessName,
      client.portalBgImageUrl || settings.portalBgImageUrl,
    );
    updateClient(client.id, { portalId: result.portalId, accessCode: result.accessCode });
    const url = `${PORTAL_BASE_URL}/client-view?id=${result.portalId}&preview=1`;
    if (win) win.location.href = url;
    else window.open(url, '_blank'); // fallback if popup was blocked
  } catch {
    if (win) win.close();
    toast({ title: 'Error', description: 'Could not open portal preview', variant: 'destructive' });
  }
}}
```

## Verification

1. Click **Portal** on a client card in the desktop dashboard.
2. A new tab should open immediately (showing about:blank), then navigate to `https://chiptime.chipplc.one/client-view?id=...&preview=1` once sync finishes.
3. Confirm no popup-blocker icon appears in the address bar.

## Out of scope

- No changes to `syncPortalToCloud`, the edge function, or the client-portal route itself.
- Share / PIN / PDF buttons are unaffected.
