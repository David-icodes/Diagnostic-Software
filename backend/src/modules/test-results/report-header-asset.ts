import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
let loaded:Promise<Buffer>|undefined;
/** Immutable branding only. Patient PDFs and authorization results are never cached here. */
export function sharedReportHeader():Promise<Buffer>{
 if(!loaded)loaded=(async()=>{const packaged=path.resolve(__dirname,'../../assets/report-header.png');const source=existsSync(packaged)?packaged:path.resolve(__dirname,'../../../../frontend/public/report-header.png');const bytes=await readFile(source);if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Shared report header is not a PNG image');return bytes;})().catch(error=>{loaded=undefined;throw error;});
 return loaded;
}
export async function sharedReportStationery(){const packaged=path.resolve(__dirname,'../../assets/report-stationery.jpg');const source=existsSync(packaged)?packaged:path.resolve(__dirname,'../../../../frontend/public/report-stationery.jpg');const bytes=await readFile(source);if(bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error('Report stationery is not a JPEG');return bytes;}
export async function reportHeaderVersion(){const packaged=path.resolve(__dirname,'../../assets/report-stationery.jpg');const source=existsSync(packaged)?packaged:path.resolve(__dirname,'../../../../frontend/public/report-stationery.jpg');return createHash('sha256').update(await sharedReportHeader()).update(await readFile(source)).digest('hex');}
