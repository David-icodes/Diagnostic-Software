import test from "node:test";
import assert from "node:assert/strict";
import { fullReportRows } from "./full-report-export.ts";
test("export consumes every filtered page beyond the existing 1000-row cap",async()=>{
 const rows=Array.from({length:1001},(_,i)=>({id:i})); let calls=0;
 const result=await fullReportRows({data:rows.slice(0,1000),pagination:{total:1001,totalPages:2}},async(page)=>{calls++;return {data:rows.slice((page-1)*100,page*100),pagination:{total:1001,totalPages:11}};});
 assert.equal(calls,11);assert.deepEqual(result,rows);
});
test("small exports remain unchanged; changed or incomplete datasets cannot download silently",async()=>{
 const initial={data:[1],pagination:{total:1,totalPages:1}};
 assert.equal(await fullReportRows(initial,async()=>{throw new Error("Must not fetch");}),initial.data);
 await assert.rejects(fullReportRows({...initial,pagination:{total:2,totalPages:2}},async()=>initial),/changed during export/);
 await assert.rejects(fullReportRows({...initial,pagination:{total:2,totalPages:2}},async()=>({data:[1],pagination:{total:2,totalPages:1}})),/complete filtered/);
});
