

## Fix: Preserve Photos Across Cache Clears and XML Import/Export

### Problem

Photos are stored separately from task data (in IndexedDB on web, filesystem on native). The XML backup only exports task metadata -- it does not include photo references or data. After clearing cache or importing XML, tasks have `filePath` references that point to nothing.

### Solution

Two changes to make photos resilient:

---

### 1. Include photo metadata in XML export/import

**File: `src/lib/xmlConverter.ts`**

- **Export**: After the `</Parts>` block inside each `<Session>`, add a `<Photos>` section that writes each photo's `id`, `filePath`, `cloudUrl`, `capturedAt`, `sessionNumber`, and optionally the `base64` data if still present.
- **Import** (`parseXMLString`): Parse the `<Photos>` section back into `SessionPhoto[]` objects when reading the XML, restoring `id`, `filePath`, `cloudUrl`, `capturedAt`, and `sessionNumber`.

This ensures that even if local blobs are gone, the `cloudUrl` (from previous portal shares) survives the round-trip.

---

### 2. Fall back to `cloudUrl` when local photo is missing

**File: `src/components/TaskCard.tsx`** (PDF generation)

- When loading photos for the bill PDF, if `photoStorageService.loadPhoto(filePath)` returns `null` and the photo has a `cloudUrl`, fetch the image from the cloud URL instead.
- Convert the fetched image to base64 for embedding in the PDF.

**File: `src/components/ClientCostBreakdown.tsx`** (portal display, if applicable)

- Same fallback: if local load fails, use `cloudUrl` as the `<img>` source.

---

### 3. Optionally embed base64 in XML for full offline backup

Add a setting or flag to include base64 photo data directly in the XML export. This makes the XML file larger but fully self-contained. When importing, the base64 is saved back into IndexedDB/filesystem via `photoStorageService.savePhoto()`.

This step is optional and can be behind a toggle (e.g., "Include photos in backup") since it significantly increases file size.

---

### Technical Details

**XML export addition** (inside each Session element):

```text
<Photos>
  <Photo id="..." filePath="..." cloudUrl="..." capturedAt="..." sessionNumber="1" />
</Photos>
```

**Fallback loading logic** (pseudo-code):

```text
let photoData = await photoStorageService.loadPhoto(photo.filePath);
if (!photoData && photo.cloudUrl) {
  // Fetch from cloud
  const response = await fetch(photo.cloudUrl);
  const blob = await response.blob();
  photoData = await blobToBase64(blob);
}
```

**Import restoration**: When importing XML that contains `cloudUrl` references, those URLs are preserved on the `SessionPhoto` objects so the fallback path works immediately.

### Files to modify

| File | Change |
|------|--------|
| `src/lib/xmlConverter.ts` | Add Photos export/import in XML format |
| `src/components/TaskCard.tsx` | Add cloudUrl fallback when loading photos for PDF |
| `src/components/ClientCostBreakdown.tsx` | Add cloudUrl fallback for portal photo display (if needed) |

