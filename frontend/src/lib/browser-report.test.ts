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

test("Generate keeps the current screen while pending and opens only validated PDF bytes",async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,"window");const events:string[]=[];
 const tab={opener:{} as unknown,closed:false};
 Object.defineProperty(globalThis,"window",{configurable:true,value:{open:(url:string)=>{assert.ok(url.startsWith('blob:'));events.push('open-pdf');return tab;},setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},addEventListener:()=>{},removeEventListener:()=>{}}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,"window",previous);else Reflect.deleteProperty(globalThis,"window");});
 let finish!:(response:Response)=>void;
 t.mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{assert.equal(options?.credentials,'include');events.push('fetch');return new Promise<Response>(resolve=>{finish=resolve;});});
 const request=generateBrowserReport({billId:'synthetic',testIds:['test']});assert.deepEqual(events,['fetch']);
 finish(new Response('%PDF-synthetic',{headers:{'content-type':'application/pdf'}}));await request;assert.deepEqual(events,['fetch','open-pdf']);assert.equal(tab.opener,null);
});

test("failed generation never opens a blank page",async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,"window");let opens=0;
 Object.defineProperty(globalThis,"window",{configurable:true,value:{open:()=>{opens++;},setTimeout,clearTimeout}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,"window",previous);else Reflect.deleteProperty(globalThis,"window");});
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({message:'Not authorized'}),{status:403}));
 await assert.rejects(generateBrowserReport({billId:'synthetic',testIds:['test']}),/Not authorized/);assert.equal(opens,0);
});

test("a blocked popup opens the finished PDF in the current tab without another click",async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,"window");let navigated='';
 Object.defineProperty(globalThis,"window",{configurable:true,value:{open:()=>null,location:{assign:(url:string)=>{navigated=url;}},setTimeout,clearTimeout}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,"window",previous);else Reflect.deleteProperty(globalThis,"window");});
 t.mock.method(globalThis,'fetch',async()=>new Response('%PDF-synthetic',{headers:{'content-type':'application/pdf'}}));
 await generateBrowserReport({billId:'synthetic',testIds:['test']});assert.ok(navigated.startsWith('blob:'));
});

import {reportDownloadFilename} from './browser-report.ts';
test('report downloads retain the authorized patient ID filename and sanitize unsafe paths',()=>{
 assert.equal(reportDownloadFilename("attachment; filename*=UTF-8''GP-SYN001-report.pdf"),'GP-SYN001-report.pdf');
 assert.equal(reportDownloadFilename('inline; filename="../bad/report.pdf"'),'.._bad_report.pdf');
 assert.equal(reportDownloadFilename(null),'report.pdf');
});

test('explicit download uses the authorized filename without opening a blank tab',async t=>{
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document');let clicked=false;
 const link={href:'',download:'',click:()=>{clicked=true;}};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{setTimeout:()=>0,clearTimeout:()=>{},open:()=>{throw Error('download must not open a tab');}}});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>link}});
 t.after(()=>{for(const [key,old] of [['window',oldWindow],['document',oldDocument]] as const){if(old)Object.defineProperty(globalThis,key,old);else Reflect.deleteProperty(globalThis,key);}});
 t.mock.method(globalThis,'fetch',async()=>new Response('%PDF-synthetic',{headers:{'content-type':'application/pdf','content-disposition':"attachment; filename*=UTF-8''GP-SYN001-report.pdf"}}));
 await generateBrowserReport({billId:'synthetic',testIds:['test'],download:true});assert.equal(clicked,true);assert.equal(link.download,'GP-SYN001-report.pdf');URL.revokeObjectURL(link.href);
});

import {reportViewerHtml} from './browser-report.ts';
test('memory-only PDF viewer has named download and no authenticated server navigation',()=>{
 const html=reportViewerHtml('blob:https://synthetic.test/local-pdf','SYN-ONLY-report.pdf');
 assert.match(html,/<title>SYN-ONLY-report.pdf<\/title>/);assert.match(html,/download="SYN-ONLY-report.pdf"/);
 assert.doesNotMatch(html,/api\/v1|fetch\(|(?:src|href)="https?:/);
 assert.match(reportViewerHtml('blob:safe','<img onerror=evil>'),/&lt;img/);
 assert.throws(()=>reportViewerHtml('https://example.test/api','report.pdf'));
});
