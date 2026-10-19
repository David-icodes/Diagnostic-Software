"use client";
import {useState} from "react";
import {Button} from "@/components/ui/button";
import {openAuthorizedReportPdf,validatedReportPdf} from "@/lib/browser-report";
export function VendorReportActions({billId,testIds,disabled=false,combined=false,label,includeHeader=true}:{billId:string;testIds?:string[];disabled?:boolean;combined?:boolean;label?:string;includeHeader?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function run(download:boolean){if(busy)return;setBusy(true);setError("");try{
  const query=new URLSearchParams({includeHeader:String(includeHeader),letterhead:String(!includeHeader),printMode:"department",download:String(download)});if(testIds)query.set("testIds",testIds.join(","));
  const url=`${process.env.NEXT_PUBLIC_API_URL??"http://localhost:5000/api/v1"}/vendor-portal/bills/${encodeURIComponent(billId)}/report.pdf?${query}`;
  if(!download){await openAuthorizedReportPdf(url);return;}
  const blob=await validatedReportPdf(await fetch(url,{credentials:"include"}));const objectUrl=URL.createObjectURL(blob);const link=document.createElement("a");link.href=objectUrl;link.download="laboratory-report.pdf";link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),10000);
 }catch(failure){setError(failure instanceof Error?failure.message:"Report unavailable. Refresh its status and retry.");}finally{setBusy(false);}}
 return <div className="space-y-1"><div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={disabled||busy} onClick={()=>void run(false)}>{busy?"Preparing…":label??(combined?"Print / Download":"Print")}</Button>{!combined&&<Button size="sm" variant="outline" disabled={disabled||busy} onClick={()=>void run(true)}>Download</Button>}</div>{error&&<p role="alert" className="text-xs text-destructive">{error}</p>}</div>;
}
