import { PDFDocument, PDFName, degrees } from "pdf-lib";
import type { Request } from "express";
import { ApiError } from "../../utils/api-error";
import { LabBill } from "../../models/lab-bill.model";
import { assertBillDocumentAllowed } from "./result-workflow.service";
import { readReportUpload } from "./report-upload.service";
import { sharedReportHeader } from "./report-header-asset";
import { validatePdf } from "../documents/pdf-integrity";

/** Reserve new stationery space above the visible source page. Source content
 * is embedded at scale 1; later pages keep their original boxes and rotations. */
export async function appendExternalPages(headerImage: Buffer, original: Buffer): Promise<Buffer> {
  await validatePdf(original, "attachment");
  const source = await PDFDocument.load(original, { updateMetadata: false });
  if (source.catalog.has(PDFName.of("AcroForm"))) throw new ApiError(422,"Interactive or signed PDFs must be viewed unchanged; header composition cannot preserve their form/signature semantics.");
  const first=source.getPage(0),crop=first.getCropBox();
  if(first.node.Annots()?.size())throw new ApiError(422,"The first page contains annotations. Use Without Header to preserve them unchanged.");
  const rotation=((first.getRotation().angle%360)+360)%360;
  if(![0,90,180,270].includes(rotation)||crop.width<=0||crop.height<=0)throw new ApiError(422,"Unsupported PDF page geometry. Use Without Header.");
  const width=rotation===90||rotation===270?crop.height:crop.width;
  const height=rotation===90||rotation===270?crop.width:crop.height;
  const output=await PDFDocument.create();
  const image=await output.embedPng(headerImage);
  const imageWidth=Math.min(width-24,571.28);
  if(imageWidth<=0)throw new ApiError(422,"The uploaded page is too narrow for report stationery.");
  const imageHeight=imageWidth*image.height/image.width,band=imageHeight+24;
  const page=output.addPage([width,height+band]);
  const embedded=await output.embedPage(first,{left:crop.x,bottom:crop.y,right:crop.x+crop.width,top:crop.y+crop.height});
  const positions:Record<number,{x:number;y:number;angle:number}>={0:{x:0,y:0,angle:0},90:{x:0,y:crop.width,angle:270},180:{x:crop.width,y:crop.height,angle:180},270:{x:crop.height,y:0,angle:90}};
  const position=positions[rotation];
  page.drawPage(embedded,{x:position.x,y:position.y,width:crop.width,height:crop.height,rotate:degrees(position.angle)});
  page.drawImage(image,{x:(width-imageWidth)/2,y:height+12,width:imageWidth,height:imageHeight});
  const remaining=await output.copyPages(source,source.getPageIndices().slice(1));
  for(const originalPage of remaining)output.addPage(originalPage);
  return Buffer.from(await output.save());
}

export async function printExternalReport(billId: string, testId: string, id: string,
  header: "header" | "none" | "letterhead", _req: Request) {
  const row = await readReportUpload(billId, testId, id);
  const bill = await LabBill.findById(billId).exec();
  if (!bill?.items.some(item => String(item.testId) === testId && item.outsideLabId))
    throw new ApiError(422, "Only an outside-laboratory test can use external report printing.");
  const collectionId = bill.items.find(item => String(item.testId) === testId)?.activeCollectionId;
  const bytes = header === "header" ? await appendExternalPages(
    await sharedReportHeader(), row.content!) : row.content!;
  const current = await LabBill.findById(billId).exec();
  if (!current?.items.some(item => String(item.testId) === testId && item.outsideLabId && String(item.activeCollectionId ?? "") === String(collectionId ?? "")))
    throw new ApiError(409, "The outside order changed. Reload before printing.");
  await assertBillDocumentAllowed(billId);
  return bytes;
}
