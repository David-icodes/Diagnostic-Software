import test from 'node:test';import assert from 'node:assert/strict';
import {consentAllowed,assertCampaignTemplate,failureState,phoneHash,thankYouIntent,assertThankYouTemplate} from './communication-guards';
test('campaign approval, English locale, numeric variables and media checks fail closed',()=>{
 const template={status:'APPROVED',category:'MARKETING',language:'en_US',components:[{type:'BODY',text:'Camp {{1}} at {{2}}'}]};
 assert.doesNotThrow(()=>assertCampaignTemplate(template,['Saturday','Synthetic venue']));
 for(const bad of [{...template,status:'PENDING'},{...template,category:'UTILITY'},{...template,language:'te'},{...template,components:[{type:'HEADER',format:'IMAGE'}]}])assert.throws(()=>assertCampaignTemplate(bad,['Saturday','Synthetic venue']));
 assert.throws(()=>assertCampaignTemplate(template,['Saturday']));assert.throws(()=>assertCampaignTemplate({...template,components:[]}));
});
test('consent binds to exact mobile, requires explicit scope/time and respects immediate opt-out',()=>{
 const consent={mobileHash:'synthetic-hash',optInAt:new Date(),marketingOptIn:true,serviceOptIn:false};
 assert.equal(consentAllowed(consent,'synthetic-hash','camp'),true);assert.equal(consentAllowed(consent,'other','camp'),false);assert.equal(consentAllowed({...consent,optOutAt:new Date()},'synthetic-hash','camp'),false);assert.equal(consentAllowed(consent,'synthetic-hash','thank-you'),false);assert.equal(consentAllowed(null,'synthetic-hash','camp'),false);
});
test('automatic thanks is a durable new-bill intent only with explicit OSP service consent',()=>{
 assert.deepEqual(thankYouIntent('osp','generated',false,'not-a-number'),{});assert.deepEqual(thankYouIntent('vendor','generated',true,'not-a-number'),{});assert.deepEqual(thankYouIntent('osp','draft',true,'not-a-number'),{});
 const intent=thankYouIntent('osp','generated',true,'+919876543210');assert.equal(intent.whatsappThanksPending,true);assert.equal(intent.whatsappThanksMobileHash,phoneHash('+919876543210'));assert.ok(intent.whatsappThanksConsentAt instanceof Date);
 assert.equal(failureState(false,false),'blocked');assert.equal(failureState(true,true),'failed');assert.equal(failureState(true,false),'uncertain');
});

test('greeting template rejects missing, named and extra variables or media',()=>{
 assert.doesNotThrow(()=>assertThankYouTemplate({components:[{type:'BODY',text:'Thanks {{1}} from {{2}}'}]}));
 for(const text of ['Hello','Hello {{1}}','Hello {{patient}} {{2}}','Hello {{1}} {{2}} {{3}}'])assert.throws(()=>assertThankYouTemplate({components:[{type:'BODY',text}]}));
 assert.throws(()=>assertThankYouTemplate({components:[{type:'HEADER'},{type:'BODY',text:'{{1}} {{2}}'}]}));
});

test('empty or invalid mobile never creates an automatic thank-you intent',()=>{for(const mobile of ['', '  ', '123', 'invalid'])assert.deepEqual(thankYouIntent('osp','generated',true,mobile),{});});
