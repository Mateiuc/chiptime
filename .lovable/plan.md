

# Fix Share Link Domain to `chiptime.chipplc.one`

## Changes

### 1. `src/lib/clientPortalUtils.ts`
Add a constant near the top of the file:
```typescript
export const PORTAL_BASE_URL = 'https://chiptime.chipplc.one';
```

### 2. `src/components/ManageClientsDialog.tsx`
- Add `PORTAL_BASE_URL` to the existing import from `@/lib/clientPortalUtils`
- **Line 611**: Replace `${window.location.origin}` with `${PORTAL_BASE_URL}`
- **Line 622**: Replace `${window.location.origin}` with `${PORTAL_BASE_URL}`

No other domain references exist elsewhere in the codebase.

## Custom Domain Setup (you do this after approval)

1. Go to project **Settings > Domains**
2. Click **Connect Domain** and enter `chiptime.chipplc.one`
3. At your DNS provider for `chipplc.one`, add:
   - **A record**: Name = `chiptime`, Value = `185.158.133.1`
   - **TXT record**: as shown in the Lovable setup flow
4. Wait for DNS propagation and SSL (usually minutes, up to 72 hours)

Until the domain is active, generated links won't resolve, but the app keeps working on `chiptime.lovable.app`.

