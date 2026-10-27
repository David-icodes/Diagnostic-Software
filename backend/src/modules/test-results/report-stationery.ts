import {PDFDocument} from 'pdf-lib';
// Chromium can fall back to the default page on a fragmented table continuation.
// This stylesheet is applied only inside the isolated clinical-PDF render context.
export const clinicalReportPrintCss = `@page {size:A4 portrait;margin:42mm 7mm 16mm 15mm;} @page lab-report {size:A4 portrait;margin:42mm 7mm 16mm 15mm;} .lis-report-paper tbody td:first-child:not([colspan]) {padding-right:3mm;}`;
/** One unchanged JPEG behind each physical page; report text stays selectable/vector. */
export async function applyReportStationery(bytes:Buffer,artwork:Buffer):Promise<Buffer>{
 const source=await PDFDocument.load(bytes),output=await PDFDocument.create();
 if(source.getTitle())output.setTitle(source.getTitle()!);
 const image=await output.embedJpg(artwork),pages=await output.embedPages(source.getPages());
 for(const [index,embedded] of pages.entries()){
  const {width,height}=source.getPage(index).getSize();const page=output.addPage([width,height]);
  const scale=Math.min(width/image.width,height/image.height),w=image.width*scale,h=image.height*scale;
  page.drawImage(image,{x:(width-w)/2,y:(height-h)/2,width:w,height:h});
  page.drawPage(embedded,{x:0,y:0,width,height});
 }
 return Buffer.from(await output.save());
}
