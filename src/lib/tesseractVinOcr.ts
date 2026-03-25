import { createWorker } from 'tesseract.js';
import { generateVinCandidates, validateVin, validateVinStrict } from './vinDecoder';

export interface OcrResult {
  vin: string | null;
  rawText: string;
  candidates: Array<{ vin: string; valid: boolean; checksum: boolean }>;
}

interface TesseractParams {
  base64Image: string;
  signal?: AbortSignal;
  debug?: boolean;
}

// Clean text: normalize common OCR confusions and remove invalid VIN characters
const cleanText = (text: string): string => {
  return text
    .toUpperCase()
    // Convert common OCR misreads to valid VIN characters FIRST
    .replace(/[OÖØ]/g, '0')    // Letter O → Zero (O is invalid in VIN)
    .replace(/[IÏÎ]/g, '1')    // Letter I → One (I is invalid in VIN)
    .replace(/Q/g, '0')        // Q → Zero (Q is invalid in VIN)
    .replace(/Ü/g, 'U')
    .replace(/Ä/g, 'A')
    .replace(/[^A-HJ-NPR-Z0-9\s\n]/g, '') // Keep only valid VIN chars + whitespace
    .trim();
};

export const readVinWithTesseract = async ({
  base64Image,
  signal,
  debug = false
}: TesseractParams): Promise<string | null | OcrResult> => {
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  
  try {
    // Check for abort before starting
    if (signal?.aborted) {
      throw new Error('Aborted');
    }

    // Create worker with English language
    worker = await createWorker('eng', 1, {
      logger: () => {} // Suppress progress logs
    });

    // Optimize for VIN-specific single-line text
    // No whitelist — let Tesseract recognize all chars naturally, cleanText() maps O→0, I→1
    await worker.setParameters({
      tessedit_pageseg_mode: '7' as any, // Single text line
      tessedit_ocr_engine_mode: '2' as any, // Legacy + LSTM combined for best accuracy
    } as any);

    // Check abort again after worker creation
    if (signal?.aborted) {
      throw new Error('Aborted');
    }

    // Recognize text from base64 image
    const imageData = `data:image/jpeg;base64,${base64Image}`;
    const { data: { text } } = await worker.recognize(imageData);

    // Clean and process the extracted text
    const cleanedText = cleanText(text);
    
    // Extract potential VIN candidates
    const allCandidates: Array<{ vin: string; valid: boolean; checksum: boolean }> = [];
    
    // Helper to add candidates without duplicates
    const addCandidate = (potentialVin: string) => {
      const candidates = generateVinCandidates(potentialVin);
      for (const candidate of candidates) {
        if (!allCandidates.find(c => c.vin === candidate)) {
          allCandidates.push({
            vin: candidate,
            valid: validateVin(candidate),
            checksum: validateVinStrict(candidate)
          });
        }
      }
    };
    
    // Method 1: Split by whitespace and search lines >= 17 chars
    const lines = cleanedText.split(/[\n\s]+/).filter(line => line.length >= 17);
    for (const line of lines) {
      for (let i = 0; i <= line.length - 17; i++) {
        addCandidate(line.substring(i, i + 17));
      }
    }
    
    // Method 2: Sliding window on full text with all whitespace removed
    const fullText = cleanedText.replace(/[\s\n]+/g, '');
    for (let i = 0; i <= fullText.length - 17; i++) {
      addCandidate(fullText.substring(i, i + 17));
    }

    // Find best candidate (valid checksum preferred)
    const validVin = allCandidates.find(c => c.checksum)?.vin || 
                     allCandidates.find(c => c.valid)?.vin || 
                     null;

    if (debug) {
      return {
        vin: validVin,
        rawText: text,
        candidates: allCandidates
      };
    }

    return validVin;
    
  } catch (error) {
    if (error instanceof Error && error.message === 'Aborted') {
      console.log('[Tesseract] Scan aborted');
    } else {
      console.error('[Tesseract] OCR error:', error);
    }
    
    if (debug) {
      return {
        vin: null,
        rawText: '',
        candidates: []
      };
    }
    return null;
    
  } finally {
    // Always terminate the worker
    if (worker) {
      await worker.terminate();
    }
  }
};
