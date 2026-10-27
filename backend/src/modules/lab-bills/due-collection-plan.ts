import {createHash} from 'node:crypto';
import {ApiError} from '../../utils/api-error';
export interface DueReceipt {requestId:string;fingerprint:string;paymentMode?:string;paymentId:string;amount:number;discountAmount:number;remainingBalance:number;collectedAt:Date}
const round=(n:number)=>Math.round(n*100)/100;
export function dueCollectionPlan(bill:{status:string;totalAmount:number;netAmount:number;paidAmount:number;dueAmount:number;discountAmount:number;dueCollections?:DueReceipt[]},input:{requestId?:string;amount:number;discountAmount?:number;paymentMode:string;comments?:string;expectedDueAmount?:number}){
 const amount=round(input.amount),discount=round(input.discountAmount??0);
 const fingerprint=createHash('sha256').update(JSON.stringify({amount,discount,paymentMode:input.paymentMode,comments:input.comments?.trim()??''})).digest('hex');
 const previous=input.requestId?bill.dueCollections?.find(row=>row.requestId===input.requestId):undefined;
 if(previous){if(previous.fingerprint!==fingerprint)throw new ApiError(409,'This payment request was already used with different details');return {replay:true as const,previous};}
 if(bill.status!=='generated')throw new ApiError(422,'Only a generated bill can receive payment');
 if(![bill.totalAmount,bill.netAmount,bill.paidAmount,bill.dueAmount,bill.discountAmount,amount,discount].every(Number.isFinite)||[bill.totalAmount,bill.netAmount,bill.paidAmount,bill.dueAmount,bill.discountAmount].some(value=>value<0)||amount<=0||discount<0)throw new ApiError(422,'Invalid collection amount');
 const outstanding=round(bill.dueAmount);
 if(outstanding!==round(bill.netAmount-bill.paidAmount)||round(bill.totalAmount-bill.discountAmount)!==round(bill.netAmount))throw new ApiError(409,'Bill balance needs reconciliation before collection');
 if(input.expectedDueAmount!==undefined&&round(input.expectedDueAmount)!==outstanding)throw new ApiError(409,'Bill balance changed. Reload before collecting payment');
 if(outstanding<=0)throw new ApiError(422,'This bill has no outstanding balance');
 if(discount>outstanding||amount>round(outstanding-discount))throw new ApiError(422,'Collection and discount cannot exceed the outstanding balance');
 const discountAmount=round(bill.discountAmount+discount),netAmount=round(bill.totalAmount-discountAmount),paidAmount=round(bill.paidAmount+amount),dueAmount=round(netAmount-paidAmount);
 return {replay:false as const,fingerprint,amount,discount,totals:{discountAmount,discountPercent:bill.totalAmount?round(discountAmount/bill.totalAmount*100):0,netAmount,paidAmount,dueAmount}};
}
