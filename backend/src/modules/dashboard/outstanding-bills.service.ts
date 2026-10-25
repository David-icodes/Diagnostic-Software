import { displayPatientCode } from "../../utils/patient-code";
import {Types, type PipelineStage} from "mongoose";
import {LabBill} from '../../models/lab-bill.model';
import {ApiError} from '../../utils/api-error';
/** Same conservative balance as verifiedOutstandingDue, across every date. */
export const outstandingExpression={$max:['$dueAmount',{$round:[{$max:[0,{$subtract:['$netAmount','$paidAmount']}]},2]}]};
export async function getOutstandingBills(page=1,limit=20,cursorMode=false,before?:string){
 page=Math.max(1,Math.floor(page)||1);limit=Math.max(1,Math.min(100,Math.floor(limit)||20));
 const invalid=await LabBill.exists({status:'generated',$or:['dueAmount','netAmount','paidAmount'].flatMap(field=>[{[field]:{$not:{$gte:0}}},{[field]:{$gt:Number.MAX_VALUE}},{[field]:{$not:{$type:'number'}}}])});
 if(invalid)throw new ApiError(422,'Outstanding bill balances could not be verified.');
 let cursorStages: PipelineStage.Match[]=[];
 if(cursorMode&&before){
  if(!Types.ObjectId.isValid(before))throw new ApiError(400,'Invalid bill cursor');
  const anchor=await LabBill.findById(before).select('createdAt').lean().exec();
  if(!anchor?.createdAt)throw new ApiError(409,'Bill cursor is unavailable. Refresh outstanding bills.');
  cursorStages=[{$match:{$or:[{createdAt:{$lt:anchor.createdAt}},{createdAt:anchor.createdAt,_id:{$lt:anchor._id}}]}}];
 }
 const [result]=await LabBill.aggregate([
 {$match:{status:'generated'}},{$addFields:{outstanding:outstandingExpression}},{$match:{outstanding:{$gt:0}}},
 {$facet:{summary:[{$group:{_id:null,total:{$sum:1},totalDue:{$sum:'$outstanding'}}}],items:[
 ...cursorStages,{$sort:{createdAt:-1,_id:-1}},...(!cursorMode?[{$skip:(page-1)*limit}]:[]),{$limit:cursorMode?limit+1:limit},
 {$lookup:{from:'patients',localField:'patientId',foreignField:'_id',as:'patient'}},{$unwind:{path:'$patient',preserveNullAndEmptyArrays:true}},
 {$project:{_id:0,id:{$toString:'$_id'},billNo:'$billNumber',billDate:'$createdAt',patientId:{$ifNull:['$patient.patientId','—']},patientName:{$ifNull:['$patient.fullName','—']},net:'$netAmount',paid:'$paidAmount',due:'$outstanding'}},
 ]}}]).exec();
 const total=result?.summary[0]?.total??0;const found=result?.items??[];const items=cursorMode?found.slice(0,limit):found;return {items:items.map((row:any)=>typeof row.patientId === "string" ? {...row,patientId:displayPatientCode(row.patientId)} : row),...(cursorMode?{nextCursor:found.length>limit?items.at(-1)?.id:undefined}:{}),totalDue:Math.round((result?.summary[0]?.totalDue??0)*100)/100,pagination:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))}};
}
