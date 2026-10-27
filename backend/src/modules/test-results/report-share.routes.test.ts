import test from 'node:test';import assert from 'node:assert/strict';
process.env.MONGODB_URI='mongodb://127.0.0.1:1/synthetic_no_connection';process.env.JWT_SECRET='synthetic-test-only-secret';
for(const key of ['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'])process.env[key]='';
test('public report endpoint accepts only a scoped token, refuses changed links, and does not unlock patient APIs',async t=>{
 const [{default:app},{reportShareStore}]=await Promise.all([import('../../app.js'),import('./report-pdf.service.js')]);
 const errors:unknown[]=[];t.mock.method(console,'error',(...args:unknown[])=>{errors.push(args);});
 const token='A'.repeat(43),pdf=Buffer.from('%PDF-synthetic-full-header-all-pages');let unavailable=false,calls=0;
 t.mock.method(reportShareStore,'view',async (value:string)=>{calls++;assert.equal(value,token);if(unavailable){const {ApiError}=await import('../../utils/api-error.js');throw new ApiError(410,'Report link is unavailable');}return {pdf,filename:'SYN-ONLY-report.pdf'} as any;});
 const server=(app as unknown as import('express').Express).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const request=(body:any,headers:any={})=>fetch(base+'/api/v1/report-shares/view',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 const malformed=await fetch(base+'/api/v1/report-shares/view',{method:'POST',headers:{'Content-Type':'application/json'},body:'{\"token\":'+token});assert.equal(malformed.status,400);assert.equal(JSON.stringify(errors).includes(token),false);
 let response=await request({token});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),pdf);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 assert.equal((await request({token,billId:'foreign'})).status,410);assert.equal(calls,1);assert.equal((await fetch(base+'/api/v1/report-shares/view')).status,405);
 assert.equal((await fetch(base+'/api/v1/patients')).status,401);unavailable=true;assert.equal((await request({token})).status,410);unavailable=false;
 for(let i=0;i<61;i++)response=await request({token},{'X-Forwarded-For':`192.0.2.${i}`});assert.equal(response.status,429);assert.ok(calls<=60);
});
