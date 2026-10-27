import test from 'node:test';import assert from 'node:assert/strict';import {PDFDocument,rgb} from 'pdf-lib';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import QRCode from 'qrcode';
import {visiblePdfBoxes} from './pdf-visible-bounds';import {composeExternalStationery} from './external-report-stationery';
test('outside layout trims white margins but retains pale graphics, edge marks and every report row',async()=>{
 const source=await PDFDocument.create(),page=source.addPage([595.28,841.89]);
 page.drawText('SYNTHETIC OUTSIDE REPORT',{x:55,y:690,size:13});
 for(let i=0;i<22;i++)page.drawText(`Fictional investigation ${i+1}      ${i+10}      synthetic-unit`,{x:55,y:660-i*19,size:11});
 page.drawText('Synthetic technician signature',{x:330,y:170,size:10});page.drawRectangle({x:48,y:160,width:490,height:545,borderColor:rgb(0.3,0.3,0.3),borderWidth:0.5});
 page.drawRectangle({x:30,y:150,width:5,height:5,color:rgb(0.99,0.99,0.99)});
 const original=Buffer.from(await source.save()),hash=createHash('sha256').update(original).digest('hex'),[box]=await visiblePdfBoxes(original);assert.ok(box,'Installed renderer must verify whitespace');assert.ok(box.left<=30&&box.bottom<=150&&box.top>=705);assert.ok(box.top-box.bottom<650);assert.ok(box.right>=538);
 const qr=await QRCode.toDataURL('https://synthetic.invalid/shared-report#'+'S'.repeat(43));const output=await composeExternalStationery(original,readFileSync('../frontend/public/report-stationery.jpg'),qr),document=await PDFDocument.load(output);assert.equal(document.getPageCount(),1);assert.equal(createHash('sha256').update(original).digest('hex'),hash);
 mkdirSync('../output/pdf/whatsapp-cleanup-20261027',{recursive:true});writeFileSync('../output/pdf/whatsapp-cleanup-20261027/outside-synthetic.pdf',output);
});
