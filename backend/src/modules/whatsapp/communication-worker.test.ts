import {createRequire} from 'node:module';
import test from 'node:test';import assert from 'node:assert/strict';import {Types} from 'mongoose';
import {LabBill} from '../../models/lab-bill.model';import {Patient} from '../../models/patient.model';import {WhatsAppMessage} from '../../models/whatsapp-message.model';import {CommunicationJob,CommunicationConsent,CommunicationSettings} from '../../models/communication.model';import {phoneHash} from './communication-guards';
process.env.MONGODB_URI='mongodb://127.0.0.1:1/synthetic_never_connect';process.env.JWT_SECRET='synthetic-communication-worker-only-secret';process.env.FRONTEND_URL='https://synthetic.invalid';process.env.WHATSAPP_PATIENT_THANK_YOU_LANGUAGE='en_US';
const localRequire=createRequire(__filename);
const q=(value:unknown)=>{const query:any={select:()=>query,limit:()=>query,exec:async()=>value};return query;};
for(const scenario of ['accepted','opted-out','revoked-before-send','claim-lost','unknown-send-outcome'] as const)test(`worker ${scenario}: mocked repositories only, no automatic duplicate or unknown-outcome retry`,async t=>{
 const {processCommunicationQueue}=localRequire('./communication-worker.ts');
 const hash=phoneHash('+919876543210'),job={_id:new Types.ObjectId(),kind:'thank-you',patientId:new Types.ObjectId(),billId:new Types.ObjectId(),templateName:'patient_thank_you',mobileHash:hash};let claimed=false,calls=0,consentReads=0;const states:string[]=[];
 t.mock.method(LabBill,'find',()=>q([]));t.mock.method(LabBill,'findOne',()=>q({whatsappThanksConsentAt:new Date(),whatsappThanksMobileHash:hash}));t.mock.method(LabBill,'exists',()=>q(true));
 t.mock.method(CommunicationSettings,'findOne',()=>q({autoThankYou:true}));t.mock.method(CommunicationJob,'updateMany',(_filter:any,update:any)=>{assert.equal(update.$set.state,'uncertain');return q({modifiedCount:0});});
 t.mock.method(CommunicationJob,'findOneAndUpdate',(filter:any)=>{assert.equal(filter.state,'queued');const value=claimed?null:job;claimed=true;return q(value);});t.mock.method(CommunicationJob,'exists',()=>Promise.resolve(scenario==='claim-lost'?null:true) as any);t.mock.method(CommunicationJob,'updateOne',(_filter:any,update:any)=>{states.push(update.$set.state);return q({modifiedCount:1});});
 t.mock.method(Patient,'findOne',()=>q({fullName:'Fictional Recipient',mobile:'+919876543210'}));t.mock.method(CommunicationConsent,'findOne',()=>{consentReads++;return q(scenario==='opted-out'||scenario==='revoked-before-send'&&consentReads>1?{mobileHash:hash,optOutAt:new Date()}:null);});
 const templates=async()=>[{id:'synthetic-template',name:'patient_thank_you',language:'en_US',status:'APPROVED',category:'UTILITY',components:[{type:'BODY',text:'Thanks {{1}} from {{2}}'}]}];
 t.mock.method(globalThis,'fetch',async(url:any)=>{assert.equal(new URL(url).origin,'https://synthetic.invalid');return new Response(JSON.stringify({name:'Synthetic Centre'}));});
 const send=async()=>{calls++;if(scenario==='unknown-send-outcome')throw new Error('Synthetic network disconnect');return {metaMessageId:'wamid.synthetic-job'};};t.mock.method(WhatsAppMessage,'updateOne',()=>q({modifiedCount:1}));
 await processCommunicationQueue({templates,send});assert.equal(calls,['opted-out','revoked-before-send','claim-lost'].includes(scenario)?0:1);if(scenario==='claim-lost')assert.deepEqual(states,[]);else assert.ok(states.includes(scenario==='accepted'?'accepted':['opted-out','revoked-before-send'].includes(scenario)?'blocked':'uncertain'));
});
