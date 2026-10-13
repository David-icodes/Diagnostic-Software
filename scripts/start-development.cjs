const net = require('node:net');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname,'..');
function healthyService(kind,status,body) {
  if(status !== 200) return false;
  if(kind === 'frontend') return /Anjali Diagnostics/i.test(body);
  try {
    const data=JSON.parse(body);
    return data.success===true && data.message==='Diagnostic LIS API is running' && data.database==='connected';
  } catch {return false;}
}
async function occupied(port) {
  return new Promise(resolve=>{
    const socket=net.connect({host:'localhost',port});
    socket.setTimeout(2000);
    socket.once('connect',()=>{socket.destroy();resolve(true);});
    socket.once('error',()=>resolve(false));
    socket.once('timeout',()=>{socket.destroy();resolve(true);});
  });
}
async function main(kind) {
  if(!['frontend','backend'].includes(kind)) throw new Error('Choose frontend or backend');
  const port=kind==='frontend'?3000:5000;
  if(await occupied(port)) {
    let healthy=false;
    try {
      const response=await fetch(`http://localhost:${port}/${kind==='frontend'?'login':'health'}`,{signal:AbortSignal.timeout(5000)});
      healthy=healthyService(kind,response.status,await response.text());
    } catch {/* Occupied, but not verified healthy. Never terminate its owner. */}
    if(!healthy) throw new Error(`Port ${port} is occupied by an unverified or unhealthy service; inspect its owner. No process was stopped.`);
    console.log(`[development] Reusing healthy ${kind} at http://localhost:${port}; no duplicate started.`);
    return;
  }
  const npmCli=process.env.npm_execpath;
  if(!npmCli) throw new Error('Run this launcher through npm run dev:frontend or dev:backend');
  const args=[npmCli,'--prefix',path.join(root,kind),'run','dev'];
  if(kind==='frontend') args.push('--','--port','3000');
  const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});
  child.on('error',()=>{console.error(`Could not launch ${kind}`);process.exitCode=1;});
  child.on('exit',(code)=>{process.exitCode=code??1;});
}
module.exports={healthyService};
if(require.main===module) main(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});
