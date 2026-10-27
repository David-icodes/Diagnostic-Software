import {z} from 'zod';import {Types,type PipelineStage} from 'mongoose';
import {LabBill} from '../../models/lab-bill.model';import {Patient} from '../../models/patient.model';import {CommunicationConsent} from '../../models/communication.model';
import {businessDayStart} from '../../utils/business-date';import {campAudience} from './camp-audience';import {consentAllowed,phoneHash} from './communication-guards';
const day=z.string().trim().refine(v=>!v||Boolean(businessDayStart(v)),'Enter a valid date.').optional();
export const campFilterFields={fromDate:day,toDate:day,name:z.string().trim().max(120).optional(),billNo:z.string().trim().max(80).optional()};
export const campFiltersSchema=z.object(campFilterFields).strict().superRefine((v,c)=>{if(v.fromDate&&v.toDate&&v.fromDate>v.toDate)c.addIssue({code:z.ZodIssueCode.custom,message:'From date must not follow To date.'});});
const billIds=z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(20000);
export const campSelectionSchema=z.discriminatedUnion('all',[z.object({all:z.literal(true),filters:campFiltersSchema,excludedBillIds:billIds.default([])}).strict(),z.object({all:z.literal(false),billIds:billIds.min(1)}).strict()]);
export type CampSelection=z.infer<typeof campSelectionSchema>;
export type CampFilters=z.infer<typeof campFiltersSchema>;
function escaped(value:string){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function source(filters:CampFilters,selected?:string[],excluded?:string[],cutoff?:Date):PipelineStage[]{
 const range:Record<string,Date>={};if(filters.fromDate)range.$gte=businessDayStart(filters.fromDate)!;if(filters.toDate)range.$lt=new Date(businessDayStart(filters.toDate)!.getTime()+86400000);if(cutoff)range.$lte=cutoff;
 return [{$match:{billType:'osp',status:'generated',...(Object.keys(range).length?{createdAt:range}:{}),...(filters.billNo?{billNumber:{$regex:escaped(filters.billNo),$options:'i'}}:{}),...(selected?{_id:{$in:selected.map(id=>new Types.ObjectId(id))}}:{}),...(excluded?.length?{_id:{$nin:excluded.map(id=>new Types.ObjectId(id))}}:{})}},{$lookup:{from:Patient.collection.name,localField:'patientId',foreignField:'_id',as:'patient'}},{$unwind:'$patient'},{$match:{'patient.status':'active',...(filters.name?{'patient.fullName':{$regex:escaped(filters.name),$options:'i'}}:{})}}];
}
export async function listOspCampRecipients(raw:CampFilters,page=1){
 const filters=campFiltersSchema.parse(raw),result=await LabBill.aggregate([...source(filters),{$facet:{data:[{$sort:{createdAt:-1,_id:-1}},{$skip:(page-1)*50},{$limit:50},{$project:{_id:0,billId:{$toString:'$_id'},billNo:'$billNumber',date:'$createdAt',patientId:{$toString:'$patient._id'},patientName:'$patient.fullName',mobile:{$ifNull:['$patient.mobile','']}}}],count:[{$count:'total'}]}}]).exec();
 const rows=result[0]?.data??[],total=result[0]?.count?.[0]?.total??0,consents=await CommunicationConsent.find({patientId:{$in:rows.map((row:{patientId:string})=>row.patientId)}}).select('patientId mobileHash marketingOptIn optInAt optOutAt').lean().exec();
 return {data:rows.map((row:{patientId:string;mobile:string})=>{let eligible=false;try{const consent=consents.find(c=>String(c.patientId)===row.patientId);eligible=consentAllowed(consent??null,phoneHash(row.mobile),'camp')&&new Date(consent!.optInAt!).getTime()<=Date.now();}catch{}return {...row,eligible,eligibilityReason:eligible?'':!row.mobile?.trim()?'No mobile number':'Verified marketing consent required'};}),page,total,totalPages:Math.max(1,Math.ceil(total/50))};
}
export async function selectedOspAudience(raw:CampSelection,cutoff?:Date){
 const selection=campSelectionSchema.parse(raw),rows=await LabBill.aggregate([...source(selection.all?selection.filters:{},selection.all?undefined:[...new Set(selection.billIds)],selection.all?selection.excludedBillIds:undefined,cutoff),{$group:{_id:'$patientId'}}]).exec();
 return campAudience(cutoff,rows.map(row=>row._id as Types.ObjectId));
}
