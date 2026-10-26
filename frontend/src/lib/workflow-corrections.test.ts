import test from 'node:test';import assert from 'node:assert/strict';
import {resultPresentation} from './result-presentation.ts';import {duePaymentRequest} from './due-payment-request.ts';import {sampleIsCollected} from './lab-workflows.ts';import {patientAgeDetailedLabel} from './patient-age.ts';
test('presentation uses approved flag, persisted edit status and regular normal/default styling',()=>{
 assert.match(resultPresentation(true),/text-red-700/);assert.match(resultPresentation(true),/font-black/);assert.match(resultPresentation(true,false,'report'),/text-black/);assert.doesNotMatch(resultPresentation(true,false,'report'),/red/);
 assert.equal(resultPresentation(false),'font-normal text-black');assert.match(resultPresentation(false,true),/font-bold/);
});
test('refresh reuses the same opaque payment key and recollection only enables the sample indicator',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 const first=duePaymentRequest(storage,'synthetic-bill',()=> '123e4567-e89b-42d3-a456-426614174000');
 assert.equal(duePaymentRequest(storage,'synthetic-bill',()=>{throw Error('must retain key');}),first);
 assert.equal(sampleIsCollected('RECOLLECTED'),true);assert.equal(sampleIsCollected('REJECTED'),false);
});
test('result entry shows completed years/months from DOB and never invents unknown months',()=>{
 assert.equal(patientAgeDetailedLabel({dateOfBirth:'2020-08-16'},new Date('2026-10-26T12:00:00')),'6 years, 2 months');
 assert.equal(patientAgeDetailedLabel({age:49}),'49 years');
});
