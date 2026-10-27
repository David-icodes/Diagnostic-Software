const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../../frontend/public/report-header.png');
const target=path.resolve(__dirname,'../dist/assets/report-header.png');
if(!fs.existsSync(source))throw new Error('Shared report-header asset is missing. Generate it in the project before building.');
fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
console.log('Shared report header packaged for standalone backend runtime.');

const stationery=path.resolve(__dirname,'../../frontend/public/report-stationery.jpg');
if(!fs.existsSync(stationery))throw new Error('Report stationery asset is missing');
fs.copyFileSync(stationery,path.resolve(__dirname,'../dist/assets/report-stationery.jpg'));
