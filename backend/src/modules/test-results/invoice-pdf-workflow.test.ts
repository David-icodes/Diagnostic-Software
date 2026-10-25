import test from 'node:test';import assert from 'node:assert/strict';import {invoicePdfWorkflow} from './invoice-pdf-workflow';
test('invoice workflow denies unauthorized identities before data access and isolates vendor ownership',async()=>{
 let reads=0,renders=0;const deps={getBill:async()=>{reads++;return {clientId:'own',billNumber:'SYN'};},assertAllowed:async()=>{},render:async()=>{renders++;return Buffer.from('%PDF-synthetic');}};
 for(const input of [{canViewBilling:false},{user:{role:'operator'},canViewBilling:false},{user:{role:'vendor'},canViewBilling:true}])await assert.rejects(invoicePdfWorkflow(input,deps),/Sign in|Permission/);
 assert.equal(reads,0);await assert.rejects(invoicePdfWorkflow({user:{role:'vendor'},vendorClientId:'other',canViewBilling:false},deps),/not found/);assert.equal(renders,0);
});
test('invoice eligibility is rechecked, approved roles print and changing bills cannot print stale data',async()=>{
 let checks=0;const bill={clientId:'own',billNumber:'SYN',netAmount:100};const deps={getBill:async()=>({...bill}),assertAllowed:async()=>{checks++;},render:async()=>Buffer.from('%PDF-synthetic')};
 for(const role of ['admin','staff','operator','vendor'])assert.equal((await invoicePdfWorkflow({user:{role},canViewBilling:true,vendorClientId:'own'},deps)).filename,'SYN-invoice.pdf');
 assert.equal(checks,8);
 await assert.rejects(invoicePdfWorkflow({user:{role:'admin'},canViewBilling:true},{...deps,render:async()=>{bill.netAmount++;return Buffer.from('synthetic');}}),/changed/);
 await assert.rejects(invoicePdfWorkflow({user:{role:'admin'},canViewBilling:true},{...deps,assertAllowed:async()=>{throw Error('Not eligible');}}),/Not eligible/);
});
