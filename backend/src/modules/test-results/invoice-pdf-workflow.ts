import {createHash} from 'node:crypto';
import {ApiError} from '../../utils/api-error';
const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Dependency boundary for synthetic permission, eligibility and race tests. */
export async function invoicePdfWorkflow(input:{user?:{role:string};canViewBilling:boolean;vendorClientId?:string},deps:{getBill:()=>Promise<any>;assertAllowed:()=>Promise<unknown>;render:(bill:any)=>Promise<Buffer>}){
 if(!input.user)throw new ApiError(401,'Sign in before printing');
 if(input.user.role==='vendor'?!input.vendorClientId:!input.canViewBilling)throw new ApiError(403,'Permission denied');
 const bill=JSON.parse(JSON.stringify(await deps.getBill()));
 if(input.user.role==='vendor'&&String(bill.clientId?.id??bill.clientId?._id??bill.clientId)!==input.vendorClientId)throw new ApiError(404,'Bill not found');
 await deps.assertAllowed();const bytes=await deps.render(bill);await deps.assertAllowed();
 if(fingerprint(JSON.parse(JSON.stringify(await deps.getBill())))!==fingerprint(bill))throw new ApiError(409,'Bill changed during preparation. Retry printing.');
 return {bytes,filename:`${bill.billNumber}-invoice.pdf`.replace(/[^a-zA-Z0-9._-]/g,'_')};
}
