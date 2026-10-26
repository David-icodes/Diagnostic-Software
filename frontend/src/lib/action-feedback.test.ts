import test from 'node:test';import assert from 'node:assert/strict';
import {actionSuccessMessage,ACTION_SUCCESS_EVENT} from './action-feedback.ts';
import {api} from './api.ts';
test('success wording excludes reads, authentication, previews and existing bill print prompts',()=>{
 for(const [method,path] of [['GET','/patients'],['POST','/auth/login'],['POST','/lab-bills'],['POST','/lab-test-parameters/calculation-preview'],['POST','/api/whatsapp/lis/review']])assert.equal(actionSuccessMessage(method,path),undefined);
 assert.equal(actionSuccessMessage('POST','/lab-test-results/results/submit'),'Test results submitted successfully.');
 assert.equal(actionSuccessMessage('DELETE','/database/packages/synthetic'),'Deleted successfully.');
});
test('only confirmed successful writes announce a popup; failed responses and searches never do',async()=>{
 const fetchBefore=globalThis.fetch,windowBefore=Object.getOwnPropertyDescriptor(globalThis,'window'),target=new EventTarget();const messages:string[]=[];
 Object.defineProperty(globalThis,'window',{value:target,configurable:true});target.addEventListener(ACTION_SUCCESS_EVENT,event=>messages.push((event as CustomEvent).detail.message));
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({success:false,message:'Synthetic denied'}),{status:403});await assert.rejects(api.delete('/patients/synthetic'));assert.equal(messages.length,0);
  globalThis.fetch=async()=>new Response(JSON.stringify({success:true,data:{}}),{status:200});await api.get('/patients');assert.equal(messages.length,0);
  await api.patch('/patients/synthetic',{});await api.delete('/database/packages/synthetic');assert.deepEqual(messages,['Updated successfully.','Deleted successfully.']);
 }finally{globalThis.fetch=fetchBefore;if(windowBefore)Object.defineProperty(globalThis,'window',windowBefore);else Reflect.deleteProperty(globalThis,'window');}
});
