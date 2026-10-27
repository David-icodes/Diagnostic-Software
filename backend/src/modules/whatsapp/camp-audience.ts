import type {Types} from 'mongoose';
import {CommunicationConsent} from '../../models/communication.model';import {Patient} from '../../models/patient.model';import {consentAllowed,phoneHash} from './communication-guards';
export async function campAudience(cutoff?:Date,patientIds?:Types.ObjectId[]){
 const consents=await CommunicationConsent.find({...(patientIds?{patientId:{$in:patientIds}}:{}),marketingOptIn:true,optOutAt:{$exists:false},optInAt:{$lte:cutoff??new Date()},...(cutoff?{createdAt:{$lte:cutoff},updatedAt:{$lte:cutoff}}:{})}).select('patientId mobileHash marketingOptIn optInAt optOutAt').lean().exec();
 const patients=await Patient.find({_id:{$in:consents.map(c=>c.patientId)},status:'active'}).select('_id mobile').lean().exec(),seen=new Set<string>(),rows:{patientId:Types.ObjectId;hash:string}[]=[];
 const byPatient=new Map(consents.map(c=>[String(c.patientId),c]));
 for(const patient of patients){try{const mobileHash=phoneHash(patient.mobile);if(!seen.has(mobileHash)&&consentAllowed(byPatient.get(String(patient._id))??null,mobileHash,'camp')){seen.add(mobileHash);rows.push({patientId:patient._id,hash:mobileHash});}}catch{/* Missing/invalid numbers are never recipients. */}}
 return rows;
}
