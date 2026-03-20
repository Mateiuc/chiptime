/**
 * Strip diacritical marks from text for jsPDF compatibility.
 * jsPDF's built-in helvetica font lacks extended Latin characters (é, ñ, ü, etc.).
 */
export const stripDiacritics = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Merge a diagnostic PDF (fetched from URL) into a jsPDF-generated bill.
 * Uses pdf-lib to combine the two PDFs.
 */
export const mergePdfs = async (billBlob: Blob, diagnosticUrl: string): Promise<Blob> => {
  const { PDFDocument } = await import('pdf-lib');

  const billBytes = await billBlob.arrayBuffer();
  const diagResponse = await fetch(diagnosticUrl);
  const diagBytes = await diagResponse.arrayBuffer();

  const mergedPdf = await PDFDocument.load(billBytes);
  const diagPdf = await PDFDocument.load(diagBytes);

  const pages = await mergedPdf.copyPages(diagPdf, diagPdf.getPageIndices());
  pages.forEach(page => mergedPdf.addPage(page));

  const mergedBytes = await mergedPdf.save();
  return new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
};
