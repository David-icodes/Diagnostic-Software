import {LabBill} from '../../models/lab-bill.model';
import {ApiError} from '../../utils/api-error';
/** Same conservative balance as verifiedOutstandingDue, across every date. */
export const outstandingExpression={$max:['$dueAmount',{$round:[{$max:[0,{$subtract:['$netAmount','$paidAmount']}]},2]}]};
export async function getOutstandingBills(page=1,limit=20){
 page=Math.max(1,Math.floor(page)||1);limit=Math.max(1,Math.min(100,Math.floor(limit)||20));
 const invalid=await LabBill.exists({status:'generated',$or:['dueAmount','netAmount','paidAmount'].flatMap(field=>[{[field]:{$not:{$gte:0}}},{[field]:{$gt:Number.MAX_VALUE}},{[field]:{$not:{$type:'number'}}}])});
 if(invalid)throw new ApiError(422,'Outstanding bill balances could not be verified.');
 const [result]=await LabBill.aggregate([
 {$match:{status:'generated'}},{$addFields:{outstanding:outstandingExpression}},{$match:{outstanding:{$gt:0}}},
 {$facet:{summary:[{$group:{_id:null,total:{$sum:1},totalDue:{$sum:'$outstanding'}}}],items:[
 {$sort:{createdAt:-1,_id:-1}},{$skip:(page-1)*limit},{$limit:limit},
 {$lookup:{from:'patients',localField:'patientId',foreignField:'_id',as:'patient'}},{$unwind:{path:'$patient',preserveNullAndEmptyArrays:true}},
 {$project:{_id:0,id:{$toString:'$_id'},billNo:'$billNumber',billDate:'$createdAt',patientId:{$ifNull:['$patient.patientId','—']},patientName:{$ifNull:['$patient.fullName','—']},net:'$netAmount',paid:'$paidAmount',due:'$outstanding'}},
 ]}}]).exec();
 const total=result?.summary[0]?.total??0;return {items:result?.items??[],totalDue:Math.round((result?.summary[0]?.totalDue??0)*100)/100,pagination:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))}};
}
