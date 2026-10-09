import test from "node:test";
import assert from "node:assert/strict";
import { tableExportSchema, tableExportHtml, tableColumnWidths, exportTable } from "./table-export.service";
import { chromium } from "playwright";
const data = { format: "word" as const, title: "Filtered bill report", criteria: "09/10/2026", headers: ["Bill No","Patient","Amount"], rows: [["OSP202600001","Synthetic Patient","1,234.50"]] };
test("Word export is a real zipped DOCX; analytical HTML escapes content and preserves headings", async() => {
  const buffer=await exportTable(data); assert.equal(buffer.subarray(0,2).toString(),"PK");
  const html=tableExportHtml({...data,rows:[["<script>","A & B","123.45"]]});
  assert.match(html,/&lt;script&gt;/); assert.match(html,/A &amp; B/); assert.match(html,/Bill No/);
  assert.match(html,/A4 landscape/); assert.equal(tableExportSchema.safeParse({...data,rows:[["wrong"]]}).success,false);
  assert.equal(tableExportSchema.safeParse({...data,rows:[]}).success,false);
});
test("missing browser runtime returns actionable error without rendering or sending",async(t) => {
  t.mock.method(chromium,"launch",async() => { throw new Error("Executable doesn't exist at missing chromium"); });
  await assert.rejects(exportTable({...data,format:"pdf"}),/npm run pdf:install/);
});

test("wide analytical exports give identifiers and tests room without changing data", () => {
 const headers=["SNo","Bill Date","Bill No","Pat Id","Name","Dr Name","Lab Test","Total","Dscnt","Net","Paid","Balance","User","Pay Mode","Patient Type","Payment Status"];
 const widths=tableColumnWidths(headers);
 assert.ok(Math.abs(widths.reduce((a,b)=>a+b,0)-100)<0.001);
 assert.ok(widths[6]>widths[8]);assert.ok(widths[2]>widths[0]);
 const html=tableExportHtml({...data,headers,rows:[headers.map(()=>"unchanged")]});
 assert.match(html,/<colgroup>/);assert.match(html,/font: 7pt/);assert.equal((html.match(/unchanged/g)||[]).length,16);
});
