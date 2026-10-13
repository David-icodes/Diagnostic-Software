import {model,Schema,type Types} from "mongoose";
import {LabTestParameter,type ILabTestParameter} from "./lab-test-parameter.model";

/** Separate collection: original catalogue indexes and documents are untouched. */
const schema=LabTestParameter.schema.clone() as unknown as Schema<ILabTestParameter & {versionClinicalHash:string}>;
schema.clearIndexes();
schema.set("autoCreate",false);schema.set("autoIndex",false);
schema.add({versionClinicalHash:{type:String,required:true,immutable:true}});
schema.eachPath((path,definition)=>{if(!["_id","createdAt","updatedAt"].includes(path)){definition.options.immutable=true;definition.immutable(true);}});
schema.index({"lineage.originalId":1,"lineage.version":1},{unique:true});
export const ParameterVersion=model<ILabTestParameter & {versionClinicalHash:string}>("ParameterVersion",schema);
export interface Cutover {testId:Types.ObjectId;manifestReference:string;effectiveFrom:Date;parameterIds:string[];baseline:Record<string,string>;state:"PREPARED"|"ACTIVE"|"SUSPENDED";revision:number;actorId:string;events:Array<{action:string;at:Date;actorId:string}>}
const cutoverSchema=new Schema<Cutover>({testId:{type:Schema.Types.ObjectId,required:true,unique:true},manifestReference:{type:String,required:true},effectiveFrom:{type:Date,required:true},parameterIds:{type:[String],required:true},baseline:{type:Schema.Types.Mixed,required:true},state:{type:String,enum:["PREPARED","ACTIVE","SUSPENDED"],required:true},revision:{type:Number,required:true},actorId:{type:String,required:true},events:{type:[new Schema({action:String,at:Date,actorId:String},{_id:false})],default:[]}},{versionKey:false});
cutoverSchema.set("autoCreate",false);cutoverSchema.set("autoIndex",false);
export const ParameterCutover=model<Cutover>("ParameterCutover",cutoverSchema);
