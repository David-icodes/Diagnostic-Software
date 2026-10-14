import { model, Schema } from "mongoose";
const schema=new Schema({clientId:{type:Schema.Types.ObjectId,ref:"LabClient",required:true},submittedBy:{type:Schema.Types.ObjectId,ref:"User",required:true},billNumber:{type:String},requestKey:{type:String,required:true},fingerprint:{type:String,required:true},patientId:{type:Schema.Types.ObjectId,ref:"Patient"},billId:{type:Schema.Types.ObjectId,ref:"LabBill"},state:{type:String,enum:["pending","completed","review_required"],default:"pending"}},{timestamps:true});
schema.index({clientId:1,requestKey:1},{unique:true});
export const VendorSubmission=model("VendorSubmission",schema);
