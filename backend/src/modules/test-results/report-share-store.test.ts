import {ApiError} from "../../utils/api-error";
import test from 'node:test';import assert from 'node:assert/strict';
import {createReportShareStore,reportShareDescriptor,shareHash,type SharedReport} from './report-share-store';
test('unguessable per-report fragment token, hashed storage, exact bytes, expiry and immediate change/revocation rejection',async()=>{
 const now=new Date('2026-10-26T00:00:00Z'),a=reportShareDescriptor('https://diagnostic-software.vercel.app',now),b=reportShareDescriptor('https://diagnostic-software.vercel.app',now);
 assert.notEqual(a.token,b.token);assert.match(a.token,/^[A-Za-z0-9_-]{43}$/);assert.equal(new URL(a.url).pathname,'/shared-report');assert.equal(a.expiresAt.getTime()-now.getTime(),30*86400000);
 let stored:SharedReport|null=null,changed=false,clock=now,validations=0;
 const store=createReportShareStore({now:()=>clock,find:async hash=>stored?.tokenHash===hash?stored:null,save:async row=>{stored=row;},validateCurrent:async()=>{validations++;if(changed)throw new ApiError(410,'Report link is unavailable');}});
 const {PDFDocument}=await import('pdf-lib');const document=await PDFDocument.create();for(let i=0;i<3;i++)document.addPage().drawText('Synthetic full-header report page '+i);const pdf=Buffer.from(await document.save());await store.publish({tokenHash:a.tokenHash,owner:'synthetic',input:{},version:'v1',pdf,sha256:shareHash(pdf),filename:'SYN-ONLY.pdf',expiresAt:a.expiresAt});
 assert.equal(JSON.stringify(stored).includes(a.token),false);assert.deepEqual((await store.view(a.token)).pdf,pdf);assert.equal(validations,2);assert.equal((await PDFDocument.load((await store.view(a.token)).pdf)).getPageCount(),3);
 await assert.rejects(store.view(b.token),/unavailable/);await assert.rejects(store.view('../patient-id'),/unavailable/);
 changed=true;await assert.rejects(store.view(a.token),/unavailable/);changed=false;
 stored!.revokedAt=now;await assert.rejects(store.view(a.token),/unavailable/);stored!.revokedAt=undefined;
 clock=a.expiresAt;await assert.rejects(store.view(a.token),/unavailable/);clock=now;
 stored!.pdf=Buffer.from('%PDF-tampered');await assert.rejects(store.view(a.token),/unavailable/);
 for(const origin of ['http://localhost:3000','https://bad.test/path','https://user:pass@bad.test','https://bad.test/?x=1'])assert.throws(()=>reportShareDescriptor(origin),/exact HTTPS/);
});

test('report generation rejects unauthenticated, unknown-role and unscoped vendor callers before bill reads',async t=>{
 process.env.MONGODB_URI='mongodb://127.0.0.1:1/synthetic_no_connection';process.env.JWT_SECRET='synthetic-test-only-secret';
 const [{browserReportPdf},{LabBill}]=await Promise.all([import('./report-pdf.service.js'),import('../../models/lab-bill.model.js')]);let calls=0;t.mock.method(LabBill,'findById',()=>{calls++;throw Error('Repository must not be called');});
 const input:any={billId:'a'.repeat(24),testIds:['b'.repeat(24)],onlyEntered:'false',includeHeader:'true',letterhead:'false',printMode:'continuous',download:'false'};
 await assert.rejects(browserReportPdf(input,{} as any),/Authentication/);
 for(const role of ['unknown-role','vendor'])await assert.rejects(browserReportPdf(input,{user:{id:'synthetic',role}} as any),/permission/);
 assert.equal(calls,0);
});
