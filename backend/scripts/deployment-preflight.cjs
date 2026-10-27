/* Offline by default: never imports server.js or connects to MongoDB. */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const root = process.cwd();
function check(ok, message) { if (!ok) throw new Error(message); }
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
try {
 const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
 const lock = JSON.parse(fs.readFileSync('package-lock.json','utf8'));
 for (const group of ['dependencies','devDependencies']) check(JSON.stringify(pkg[group]) === JSON.stringify(lock.packages[''][group]), 'Manifest/lock dependency mismatch: '+group);
 for (const file of ['dist/server.js','dist/app.js','dist/modules/whatsapp/whatsapp.routes.js','dist/assets/report-header.png']) check(fs.existsSync(file),'Missing required runtime file: '+file);
 const files = walk(path.join(root,'dist')).filter(f => f.endsWith('.js') && !f.endsWith('.test.js') && !f.includes(path.sep+'scripts'+path.sep));
 for (const file of files) {
  check(spawnSync(process.execPath,['--check',file],{stdio:'pipe'}).status === 0,'Syntax check failed: '+path.relative(root,file));
  const source=fs.readFileSync(file,'utf8'); const resolver=createRequire(file);
  for (const match of source.matchAll(/(?:require\s*\(|import\s*\()\s*["']([^"']+)["']/g)) {
   try { resolver.resolve(match[1]); } catch { throw new Error('Unresolved import in '+path.relative(root,file)+': '+match[1]); }
  }
 }
 check(fs.readFileSync('dist/validations/test-result.js','utf8').includes('resultDisplay'),'Missing resultDisplay contract');
 check(fs.readFileSync('dist/modules/lab-bills/lab-bill.routes.js','utf8').includes('/:id/invoice-print-eligibility'),'Missing invoice eligibility contract');
 for (const name of Object.keys(pkg.dependencies)) createRequire(path.join(root,'package.json')).resolve(name);
 if (process.argv.includes('--runtime')) {
  require('dotenv').config({path:path.join(root,'.env'),quiet:true});
  for(const name of ['MONGODB_URI','JWT_SECRET','PORT','WHATSAPP_RENDER_API_ORIGIN']) check(Boolean(process.env[name]),'Missing required setting: '+name);
  const port=Number(process.env.PORT); check(Number.isInteger(port)&&port>=1024&&port<=65535&&port===5002,'Candidate PORT must be 5002');
  const origin=new URL(process.env.WHATSAPP_RENDER_API_ORIGIN);
  check(['localhost','127.0.0.1','[::1]'].includes(origin.hostname)&&origin.port===String(port)&&origin.pathname==='/'&&!origin.search&&!origin.hash&&!origin.username&&!origin.password,'Renderer must use candidate loopback origin without a path');
  check(process.env.JWT_SECRET.length>=16,'JWT_SECRET fails minimum length');
  require(path.join(root,'dist/config/env.js'));
  require(path.join(root,'dist/app.js')); // route registration only; no listen/connect
  const {chromium}=require('playwright'); check(fs.existsSync(chromium.executablePath()),'Chromium is not installed for this Linux deployment user');
 }
 console.log('PASS: syntax, literal import resolution, assets, manifests, dependencies and contracts ('+files.length+' modules).');
} catch(error) { console.error('Preflight failed: '+error.message); process.exitCode=1; }
