import { PDFDocument } from "pdf-lib";
import { ApiError } from "../../utils/api-error";

export type PdfKind = "report" | "invoice";
export const MAX_PDF_BYTES = 16 * 1024 * 1024;

/** Parse and check every page without modifying the original clinical PDF bytes. */
export async function validatePdf(pdf: Buffer, kind: PdfKind): Promise<void> {
  try {
    if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-")) || pdf.length > MAX_PDF_BYTES ||
      !pdf.subarray(-2048).includes(Buffer.from("%%EOF"))) throw new Error();
    const document = await PDFDocument.load(pdf, { updateMetadata: false, throwOnInvalidObject: true });
    const pages = document.getPages();
    if (!pages.length || pages.length > 1000) throw new Error();
    for (const page of pages) {
      let { width, height } = page.getSize();
      if (Math.abs(page.getRotation().angle % 180) === 90) [width, height] = [height, width];
      const expected = kind === "report" ? [595.28, 841.89] : [841.89, 595.28];
      if (Math.abs(width - expected[0]) > 2 || Math.abs(height - expected[1]) > 2) throw new Error();
    }
  } catch {
    throw new ApiError(422, `The generated ${kind} PDF is invalid, incomplete, oversized, or has incorrect A4 orientation`);
  }
}
