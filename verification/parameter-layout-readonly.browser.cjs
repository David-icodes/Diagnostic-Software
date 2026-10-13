const assert=require('node:assert/strict');
const fs=require('node:fs');
const {parse}=require('../backend/node_modules/dotenv');
const {chromium}=require('../backend/node_modules/playwright');
(async()=>{
 const env=parse(fs.readFileSync('backend/.env'));
 const auth=await fetch('http://localhost:5000/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD})});assert.equal(auth.status,200);
 const cookies=auth.headers.getSetCookie().map(s=>s.split(';')[0]);const browser=await chromium.launch({headless:true});
 try{const context=await browser.newContext();await context.addCookies(cookies.map(s=>{const p=s.indexOf('=');return{name:s.slice(0,p),value:s.slice(p+1),url:'http://localhost:3000',httpOnly:true,sameSite:'Lax'};}));const page=await context.newPage();let writes=0;page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method())&&r.url().includes('/api/v1/'))writes++;});
 await page.goto('http://localhost:3000/laboratory/master/lab-test-parameter');await page.locator('#param-dept').waitFor();const evidence=[];
 for(const width of [1920,1280,1024,768,480]){await page.setViewportSize({width,height:720});await page.evaluate(()=>window.scrollTo(0,0));const geometry=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,overflow:Array.from(document.querySelectorAll('.lis-parameter-master *')).filter(e=>e.clientWidth>0&&e.scrollWidth>e.clientWidth+2&&['auto','scroll'].includes(getComputedStyle(e).overflowX)).map(e=>({tag:e.tagName,class:e.className,width:e.clientWidth,scroll:e.scrollWidth})),clippedLabels:Array.from(document.querySelectorAll('.lis-compact-field label')).filter(e=>e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflow==='hidden').map(e=>e.textContent)}));evidence.push(geometry);assert.ok(geometry.documentWidth<=width+1,JSON.stringify(geometry));assert.deepEqual(geometry.overflow,[],JSON.stringify(geometry));assert.deepEqual(geometry.clippedLabels,[]);await page.screenshot({path:`tmp/screenshots/parameter-layout-${width}-2026-10-13.png`,fullPage:true});}
 assert.equal(writes,0);fs.writeFileSync('reports/parameter-layout-readonly-verification-2026-10-13.json',JSON.stringify({passed:true,writes,evidence},null,2));console.log(JSON.stringify({passed:true,writes,evidence}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
