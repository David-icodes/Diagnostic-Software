import {Schema,model} from "mongoose";
import type {SharedReport} from "../modules/test-results/report-share-store";
const schema=new Schema<SharedReport>({
 tokenHash:{type:String,required:true,unique:true},owner:{type:String,required:true},version:{type:String,required:true},
 input:{type:Schema.Types.Mixed,required:true},filename:{type:String,required:true},pdf:{type:Buffer,required:true,select:false},
 sha256:{type:String,required:true},expiresAt:{type:Date,required:true},revokedAt:Date,
},{timestamps:true});
schema.index({expiresAt:1},{expireAfterSeconds:0});
export const ReportShare=model<SharedReport>("ReportShare",schema);
