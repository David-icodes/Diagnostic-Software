import {assertDevelopmentDatabase,DEVELOPMENT_DATABASE} from "./development-database-guard";
/** One-time edits are limited to explicitly synthetic editor fixtures, never copied clinical records. */
export function formulaEditorContextAllowed(context:{environment?:string;uri?:string;database?:string;host?:string;billNumber?:string;patientCode?:string}):boolean {
 try{assertDevelopmentDatabase(context.environment,context.uri,context.database);}catch{return false;}
 return context.database===DEVELOPMENT_DATABASE&&context.host==="127.0.0.1"&&/^DEV-EDITOR-[a-f0-9]{8}$/.test(context.billNumber??"")&&context.patientCode===context.billNumber;
}
