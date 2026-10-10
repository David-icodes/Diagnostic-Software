const fs = require('node:fs');
const path = require('node:path');
const {createHash, randomUUID} = require('node:crypto');
const root = path.resolve(__dirname, '..');
require(path.join(root,'backend/node_modules/dotenv')).config({path:path.join(root,'backend/.env'), quiet:true});
const {v2:c} = require(path.join(root,'backend/node_modules/cloudinary'));
const {PDFDocument,PageSizes} = require(path.join(root,'backend/node_modules/pdf-lib'));
const result = {timestamp:new Date().toISOString(), syntheticOnly:true, checks:[]};
const hash = b=>createHash('sha256').update(b).digest('hex');
async function request(url) { return fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)}); }
(async()=>{
 c.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET,secure:true});
 for(const kind of ['report','invoice']) {
  const doc=await PDFDocument.create(); doc.addPage(kind==='report'?PageSizes.A4:[PageSizes.A4[1],PageSizes.A4[0]]).drawText('Synthetic deployment verification - no patient data');
  const bytes=Buffer.from(await doc.save());
  const id='diagnostic-lis/verification/'+randomUUID()+'.pdf';
  let uploaded=false;
  const check={kind,upload:false,retrieval:false,unsignedDenied:false,expiredDenied:false,cleanup:false};
  try {
   await new Promise((resolve,reject)=>{const s=c.uploader.upload_stream({public_id:id,resource_type:'raw',type:'authenticated',overwrite:false,unique_filename:false,timeout:30000},(e,r)=>{if(e||!r||r.public_id!==id||r.type!=='authenticated')return reject(Error('upload'));uploaded=true;resolve();});s.on('error',()=>reject(Error('upload')));s.end(bytes);}); check.upload=true;
   const clockResponse=await request('https://api.cloudinary.com');const providerTime=Math.floor(Date.parse(clockResponse.headers.get('date'))/1000);check.localClockOffsetSeconds=providerTime-Math.floor(Date.now()/1000);const url=c.utils.private_download_url(id,'',{resource_type:'raw',type:'authenticated',timestamp:providerTime,expires_at:providerTime+60,attachment:true});
   const r=await request(url);check.retrievalStatus=r.status; check.providerDate=r.headers.get("date"); if(!r.ok){const reason=await r.text();let safeReason=reason;for(const val of [process.env.CLOUDINARY_CLOUD_NAME,process.env.CLOUDINARY_API_KEY,process.env.CLOUDINARY_API_SECRET,id]){if(val)safeReason=safeReason.split(val).join("[redacted]");}check.providerError=safeReason.replace(/https?:[^\s""<>]+/g,"[redacted-url]").slice(0,250);check.failureCategory=/signature/i.test(reason)?"signature":/expired|timestamp/i.test(reason)?"expiry-or-clock":/deny|untrusted|blocked|ACL/i.test(reason)?"delivery-policy":/format/i.test(reason)?"format":"other-provider-rejection";} if(r.ok){const got=Buffer.from(await r.arrayBuffer());check.retrieval=hash(got)===hash(bytes);}
   const unsigned=c.url(id,{resource_type:'raw',type:'authenticated',secure:true}); const u=await request(unsigned);check.unsignedStatus=u.status;check.unsignedDenied=[401,403,404].includes(u.status);
   const expired=c.utils.private_download_url(id,'',{resource_type:'raw',type:'authenticated',timestamp:providerTime,expires_at:providerTime-120,attachment:true});const e=await request(expired);check.expiredStatus=e.status;check.expiredDenied=[401,403,404].includes(e.status);
  }catch{check.error='Provider operation failed; sensitive provider details suppressed';}
  finally{if(uploaded){try{const d=await c.uploader.destroy(id,{resource_type:'raw',type:'authenticated',invalidate:true});check.cleanup=d.result==='ok';}catch{check.cleanup=false;}}}
  result.checks.push(check); console.log(JSON.stringify(check));
 }
 fs.writeFileSync(path.join(root,'reports/cloudinary-live-verification.json'),JSON.stringify(result,null,2));
})().catch(()=>{console.error('Verification failed; sensitive details suppressed');process.exitCode=1;});
