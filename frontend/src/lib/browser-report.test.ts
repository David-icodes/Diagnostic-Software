import test from "node:test";
import assert from "node:assert/strict";
import {browserReportUrl} from "./browser-report.ts";
test("native report URL preserves modes and stable identifiers without credentials or patient text",()=>{
 const url=new URL(browserReportUrl("https://example.test/api/v1/",{billId:"bill",testIds:["test1","test2"],includeHeader:true,onlyEntered:true,printMode:"department",download:true}));
 assert.equal(url.pathname,"/api/v1/lab-test-results/report.pdf");assert.equal(url.searchParams.get("testIds"),"test1,test2");
 for(const key of ["includeHeader","onlyEntered","download"])assert.equal(url.searchParams.get(key),"true");
 assert.equal(url.searchParams.has("patientName"),false);assert.equal(url.searchParams.has("token"),false);
});
import {validatedReportPdf, generateBrowserReport} from "./browser-report.ts";

test("PDF response validation rejects HTML, server failure and corrupt bytes",async()=>{
 await assert.rejects(validatedReportPdf(new Response(JSON.stringify({message:"Report is not submitted"}),{status:422,headers:{"content-type":"application/json"}})),/not submitted/);
 await assert.rejects(validatedReportPdf(new Response("<html>login</html>",{headers:{"content-type":"text/html"}})),/did not return a PDF/);
 await assert.rejects(validatedReportPdf(new Response("not a pdf",{headers:{"content-type":"application/pdf"}})),/not a valid PDF/);
 assert.equal(await(await validatedReportPdf(new Response("%PDF-synthetic",{headers:{"content-type":"application/pdf"}}))).text(),"%PDF-synthetic");
});

test("Generate reserves a tab before fetching, includes credentials and closes on failure",async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,"window");
 const events:string[]=[];let closed=false;
 const tab={opener: {},closed:false,close:()=>{closed=true;},location:{replace:()=>{events.push("navigate");}}};
 Object.defineProperty(globalThis,"window",{configurable:true,value:{open:()=>{events.push("open");return tab;},setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},addEventListener:()=>{},removeEventListener:()=>{}}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,"window",previous);else Reflect.deleteProperty(globalThis,"window");});
 t.mock.method(globalThis,"fetch",async(_url:unknown,options?:RequestInit)=>{events.push("fetch");assert.equal(options?.credentials,"include");return new Response(JSON.stringify({message:"Not authorized"}),{status:403});});
 await assert.rejects(generateBrowserReport({billId:"bill",testIds:["test"]}),/Not authorized/);
 assert.deepEqual(events,["open","fetch"]);assert.equal(closed,true);assert.equal(tab.opener,null);
});
