import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PDFDocument,degrees} from 'pdf-lib';
import QRCode from 'qrcode';
import {composeExternalStationery,externalCollectedOn} from './external-report-stationery';
test('all synthetic outside pages retain their content and rotations within branded A4 margins with same-page QR',async()=>{
 const source=await PDFDocument.create();
 source.addPage([595.28,841.89]).drawText('SYNTHETIC OUTSIDE PAGE ONE 0.05',{x:35,y:600,size:12});
 source.addPage([792,612]).drawText('SYNTHETIC OUTSIDE PAGE TWO 12.0',{x:35,y:450,size:12});
 const rotated=source.addPage([612,792]);rotated.drawText('SYNTHETIC ROTATED PAGE THREE',{x:35,y:450,size:12});rotated.setRotation(degrees(90));
 const original=Buffer.from(await source.save()),hash=createHash('sha256').update(original).digest('hex');
 const artwork=readFileSync('../frontend/public/report-stationery.jpg');
 const qr=await QRCode.toDataURL('https://diagnostic-software.vercel.app/shared-report#'+'S'.repeat(43),{margin:4,width:240});
 for(const header of [true,false]){
  const bytes=await composeExternalStationery(original,header?artwork:undefined,qr,new Date("2026-10-27T06:59:00Z")),document=await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(),3);
  for(const page of document.getPages()){assert.ok(Math.abs(page.getWidth()-595.28)<1);assert.ok(Math.abs(page.getHeight()-841.89)<1);assert.equal(page.getRotation().angle,0);}
  mkdirSync('../output/pdf/report-workflow-repair-20261027',{recursive:true});writeFileSync('../output/pdf/report-workflow-repair-20261027/outside-'+(header?'header':'none')+'.pdf',bytes);
 }
 assert.equal(createHash('sha256').update(original).digest('hex'),hash);
});
test('interactive PDF and malformed QR fail closed before composition',async()=>{
 const document=await PDFDocument.create();const page=document.addPage();document.getForm().createTextField('synthetic').addToPage(page);
 await assert.rejects(composeExternalStationery(Buffer.from(await document.save())),/Interactive or signed/);
 const plain=await PDFDocument.create();plain.addPage();await assert.rejects(composeExternalStationery(Buffer.from(await plain.save()),undefined,'https://unapproved.test/qr'),/Invalid report QR/);
});

test('outside collection date uses saved India time and never fabricates missing dates',()=>{
 assert.equal(externalCollectedOn('2026-10-27T06:59:00Z'),'27-10-2026 12:29 PM');
 assert.equal(externalCollectedOn(undefined),'');assert.equal(externalCollectedOn('invalid'),'');
});
