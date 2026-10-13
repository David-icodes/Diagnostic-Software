const assert=require('node:assert/strict');
const fs=require('node:fs');
const {parse}=require('../backend/node_modules/dotenv');
const {chromium}=require('../backend/node_modules/playwright');
(async()=>{
 const env=parse(fs.readFileSync('backend/.env'));
 assert.equal(env.NODE_ENV,'development');
 const response=await fetch('http://localhost:5000/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD})});
 assert.equal(response.status,200);
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720}});
  await context.addCookies(response.headers.getSetCookie().map(s=>{const part=s.split(';')[0],split=part.indexOf('=');return {name:part.slice(0,split),value:part.slice(split+1),url:'http://localhost:3000',httpOnly:true,sameSite:'Lax'};}));
  const page=await context.newPage();let writes=0;page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes++;});
  await page.goto('http://localhost:3000/billing/osp/new');
  const dob=page.getByRole('textbox',{name:'Date of birth',exact:true});await dob.fill('07092002');
  assert.equal(await dob.getAttribute('placeholder'),null);assert.equal(await page.getByLabel('Age years',{exact:true}).inputValue(),'24');
  assert.equal(await page.getByLabel('Age years',{exact:true}).getAttribute('readonly'),'');
  await page.screenshot({path:'tmp/screenshots/osp-ddmmyyyy-age-2026-10-13.png'});
  for(const input of ['31022002','14102099','0709']){await dob.fill(input);assert.equal(await page.getByLabel('Age years',{exact:true}).inputValue(),'');assert.equal(await dob.getAttribute('aria-invalid'),'true');}
  await dob.fill('29022024');assert.equal(await dob.getAttribute('aria-invalid'),'false');await dob.fill('');assert.equal(await page.getByLabel('Age years',{exact:true}).inputValue(),'');assert.equal(writes,0);
  console.log(JSON.stringify({passed:true,checks:8,app:'http://localhost:3000',databaseWrites:0,submitted:false}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
