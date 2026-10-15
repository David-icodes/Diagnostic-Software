import { PDFDocument } from "pdf-lib";
import { ApiError } from "../../utils/api-error";

/** Preserve each already-authorized print part's page boxes, vectors and rotation. */
export async function mergePrintedReports(parts: Buffer[]): Promise<Buffer> {
  if (!parts.length) throw new ApiError(422, "No selected report is ready to print");
  const output = await PDFDocument.create();
  for (const bytes of parts) {
    const source = await PDFDocument.load(bytes, { updateMetadata: false });
    for (const page of await output.copyPages(source, source.getPageIndices())) output.addPage(page);
  }
  return Buffer.from(await output.save());
}
