import {visiblePdfBoxes} from "./pdf-visible-bounds";
import {PDFDocument, PDFName, StandardFonts, degrees} from "pdf-lib";
import {ApiError} from "../../utils/api-error";
import {validatePdf} from "../documents/pdf-integrity";

export function externalCollectedOn(value?:Date|string):string {
  if(!value)return '';
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).formatToParts(date);
  const part=(type:string)=>parts.find(p=>p.type===type)?.value??'';
  return part('day')+'-'+part('month')+'-'+part('year')+' '+part('hour')+':'+part('minute')+' '+part('dayPeriod').toUpperCase();
}

/** A separate print copy: preserve every source page, fit it inside the same A4
 * stationery margins, and reserve QR space instead of covering clinical content. */
export async function composeExternalStationery(original:Buffer, artwork?:Buffer, qrDataUrl?:string, collectedAt?:Date|string):Promise<Buffer> {
  await validatePdf(original,"attachment");
  const source=await PDFDocument.load(original,{updateMetadata:false});
  if(source.catalog.has(PDFName.of("AcroForm")))throw new ApiError(422,"Interactive or signed PDFs must be viewed unchanged. Print the original without composition.");
  const output=await PDFDocument.create();
  if(source.getTitle())output.setTitle(source.getTitle()!);
  const collectionText=artwork?externalCollectedOn(collectedAt):'';
  const font=collectionText?await output.embedFont(StandardFonts.TimesRoman):undefined;
  const background=artwork?await output.embedJpg(artwork):undefined;
  if(qrDataUrl&&!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(qrDataUrl))throw new ApiError(422,"Invalid report QR");
  const qr=qrDataUrl?await output.embedPng(Buffer.from(qrDataUrl.split(",")[1],"base64")):undefined;
  const mm=72/25.4,width=210*mm,height=297*mm,left=15*mm,right=7*mm,top=(collectionText?53:42)*mm,bottom=16*mm,qrBand=qr?30*mm:0;
  const visible=await visiblePdfBoxes(original);
  for(const [index,originalPage] of source.getPages().entries()){
    if(originalPage.node.Annots()?.size())throw new ApiError(422,"Annotated or signed PDFs must be printed unchanged; composition is unavailable.");
    const originalCrop=originalPage.getCropBox(),bounds=visible[index],crop=bounds?{x:bounds.left,y:bounds.bottom,width:bounds.right-bounds.left,height:bounds.top-bounds.bottom}:originalCrop,rotation=((originalPage.getRotation().angle%360)+360)%360;
    if(![0,90,180,270].includes(rotation)||crop.width<=0||crop.height<=0)throw new ApiError(422,"Unsupported uploaded PDF page geometry");
    const page=output.addPage([width,height]);
    if(background)page.drawImage(background,{x:0,y:0,width,height});
    if(collectionText&&font)page.drawText('COLLECTED ON : '+collectionText,{x:left,y:height-46*mm,size:10,font});
    const sourceWidth=rotation===90||rotation===270?crop.height:crop.width,sourceHeight=rotation===90||rotation===270?crop.width:crop.height;
    const availableWidth=width-left-right,availableHeight=height-top-bottom-qrBand;
    const scale=Math.min(availableWidth/sourceWidth,availableHeight/sourceHeight,1.5);
    const embedded=await output.embedPage(originalPage,{left:crop.x,bottom:crop.y,right:crop.x+crop.width,top:crop.y+crop.height});
    const x=left,y=height-top-sourceHeight*scale;
    const position:Record<number,{x:number;y:number;angle:number}>={0:{x:0,y:0,angle:0},90:{x:0,y:crop.width,angle:270},180:{x:crop.width,y:crop.height,angle:180},270:{x:crop.height,y:0,angle:90}};
    const offset=position[rotation];
    page.drawPage(embedded,{x:x+offset.x*scale,y:y+offset.y*scale,width:crop.width*scale,height:crop.height*scale,rotate:degrees(offset.angle)});
    if(qr){const size=23*mm;page.drawImage(qr,{x:(width-size)/2,y:bottom+2*mm,width:size,height:size});}
  }
  const bytes=Buffer.from(await output.save());await validatePdf(bytes,"report");return bytes;
}
