import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { downloadCsv } from '../frontend/src/components/reports/report-export';
let captured: Blob;
(globalThis as any).document={body:{appendChild(){},removeChild(){}},createElement(){return {click(){}}}};
URL.createObjectURL=(blob)=>{captured=blob as Blob;return 'blob:verification'};
URL.revokeObjectURL=()=>{};
(async()=>{
 const headers=['Bill No','Amount','Notes'];const rows=[['OSP202600001','1,234.50','He said "normal"'],['OSP202600002','0','Line one\nLine two']];
 downloadCsv('verified.csv',headers,rows);
 const bytes=Buffer.from(await captured.arrayBuffer()); assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf');
 const text=bytes.toString('utf8');assert.match(text,/"1,234.50"/);assert.match(text,/"He said ""normal"""/);assert.match(text,/OSP202600002/);
 await writeFile('../tmp/pdfs/excel-export-verification.csv',bytes);
 console.log('Existing Excel CSV preserves BOM, identifiers, amounts, quotes and multiline values.');
})().catch(e=>{console.error(e.message);process.exit(1)});
