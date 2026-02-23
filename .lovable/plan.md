
# Enhanced Client Portal Vehicle Cards with Photos

## Overview
Improve the client portal desktop view by making vehicle cards bigger, showing session photos, and using a more spacious layout on larger screens. On mobile, the layout stays the same.

## Changes Required

### 1. Add photos to the data pipeline

**`src/lib/clientPortalUtils.ts`**

- Add `photoUrls: string[]` to the `SessionCostDetail` interface
- Add `ph?: string[]` (photo URLs array) to the `SlimSession` interface
- In `calculateClientCosts`: collect `session.photos` cloud URLs and pass them into `SessionCostDetail`
- In `slimDown`: map `photoUrls` to `ph` field
- In `inflateSlimPayload`: map `ph` back to `photoUrls`

### 2. Enhanced vehicle card layout on desktop

**`src/components/ClientCostBreakdown.tsx`**

- Import `AspectRatio` from `@/components/ui/aspect-ratio` (already installed)
- For each vehicle card on desktop (`md:` breakpoint and up):
  - Make the card header larger with bigger text and vehicle color badge
  - If sessions have photos, show a photo gallery section at the top of the card using a horizontal scrollable row of thumbnails
  - Each photo renders inside an `AspectRatio` with `ratio={4/3}`, displayed at a larger size on desktop (e.g. 200px wide)
- Scale up text sizes on desktop: session titles `md:text-lg`, descriptions `md:text-sm`, table text `md:text-base`
- Increase card padding on desktop with `md:p-6`
- Change grid from `lg:grid-cols-2` to single column on desktop for bigger, more detailed cards (or keep 2-col but with wider max-width container)

### 3. Widen desktop container

**`src/pages/ClientPortal.tsx`**

- Increase `lg:max-w-[960px]` to `lg:max-w-[1200px]` and add `xl:max-w-[1400px]` to give more room for the enhanced cards

### 4. Photo display details

- Photos will only show if `cloudUrl` exists (local-only photos won't appear in the shared portal since they can't be accessed remotely)
- On mobile: photos show as small thumbnails in a horizontal scroll
- On desktop: photos show larger (200-240px wide) with rounded corners and a lightbox-style click-to-expand (using a simple dialog/modal)

## Technical Details

### Data format changes in `clientPortalUtils.ts`

```typescript
// SessionCostDetail - add:
photoUrls: string[];

// SlimSession - add:
ph?: string[];  // optional, only present when photos exist

// calculateClientCosts - update session push:
photoUrls: (session.photos || [])
  .filter(p => p.cloudUrl)
  .map(p => p.cloudUrl!),

// slimDown - add to session mapping:
ph: s.photoUrls.length > 0 ? s.photoUrls : undefined,

// inflateSlimPayload - add to session mapping:
photoUrls: ss.ph || [],
```

### ClientCostBreakdown.tsx changes

- Add a photo gallery section per session when `session.photoUrls.length > 0`
- Use responsive sizing: `w-20 h-16` on mobile, `md:w-48 md:h-36` on desktop
- Horizontal scroll container with `overflow-x-auto flex gap-2`
- Optional: click photo to see full-size in a dialog
- Vehicle card header: bigger icon and text on desktop (`md:text-lg`, `md:py-4 md:px-6`)
- Session content: more padding on desktop (`md:p-6`)

### Self-contained HTML file

The `generatePortalHtmlFile` function also needs updating to include photos in its rendered output -- add photo thumbnails in each session's HTML block, linking to the cloud URLs directly.
