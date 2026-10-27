import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {applyReportStationery,clinicalReportPrintCss} from './report-stationery';

test('original stationery is embedded once and preserves physical pages and vector report content',async()=>{
 const source=await PDFDocument.create();source.setTitle("GP-SYN001-report");const font=await source.embedFont(StandardFonts.Helvetica);
 for(let i=0;i<3;i++)source.addPage([595.28,841.89]).drawText(`Synthetic page ${i+1}`,{x:32,y:620,font});
 const artwork=await readFile(path.resolve(__dirname,'../../../../frontend/public/report-stationery.jpg'));
 const bytes=await applyReportStationery(Buffer.from(await source.save()),artwork);
 const result=await PDFDocument.load(bytes);assert.equal(result.getPageCount(),3);assert.equal(result.getTitle(),"GP-SYN001-report");
 for(const page of result.getPages()){assert.deepEqual(page.getSize(),{width:595.28,height:841.89});assert.ok(page.node.Contents());}
 assert.match(clinicalReportPrintCss,/@page \{size:A4 portrait;margin:42mm 7mm 16mm 15mm/);
});
