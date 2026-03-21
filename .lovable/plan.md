

# Upload Failed VIN Scan Photos to Cloud + Camera Optimization

## Overview
When Tesseract (or any provider) fails to recognize a VIN during manual capture, automatically upload the captured frame to cloud storage. This builds a library of failed scans for future OCR improvement. Also optimize camera settings for better VIN readability.

## Changes

### 1. Create storage bucket for VIN scan photos
**Database migration** — Create a `vin-scan-failures` storage bucket:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('vin-scan-failures', 'vin-scan-failures', false);
-- Allow anonymous uploads (no auth in this app)
CREATE POLICY "Allow anon uploads to vin-scan-failures"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'vin-scan-failures');
```

### 2. Upload failed frames in `VinScanner.tsx`
In the `captureSingleFrame` function, after OCR returns no valid VIN:
- Upload the base64 frame to `vin-scan-failures` bucket via the Supabase client
- File path: `{timestamp}_{provider}.jpg`
- Include metadata: provider used, raw OCR text, candidates found
- Fire-and-forget (don't block UI), show a subtle toast "Photo saved for improvement"

### 3. Camera optimization for VIN readability
In `startCamera()`:
- Request higher resolution: `video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }`
- Enable autofocus continuous mode if supported
- For Tesseract specifically, apply image preprocessing before OCR:
  - Increase JPEG quality to 0.98
  - Add grayscale conversion + contrast boost on the canvas before extracting base64

### 4. Tesseract OCR settings improvement
In `src/lib/tesseractVinOcr.ts`:
- Set Tesseract parameters for single-line text mode (`tessedit_pageseg_mode: '7'` — treat as single line)
- Set character whitelist to VIN-valid characters only (`tessedit_char_whitelist: 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'`)
- These dramatically improve accuracy for VIN-specific scanning

## Files to Change
1. **Database migration** — new `vin-scan-failures` bucket
2. `src/components/VinScanner.tsx` — upload failed frames + camera resolution boost
3. `src/lib/tesseractVinOcr.ts` — optimize Tesseract settings for VIN text

