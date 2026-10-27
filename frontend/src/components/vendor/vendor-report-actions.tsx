"use client";
import {useState} from "react";
import {Dialog} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {openAuthorizedReportPdf} from "@/lib/browser-report";
export function VendorReportActions({billId,testIds,disabled=false,combined=false,label,includeHeader=true,blockedReason}:{billId:string;testIds?:string[];disabled?:boolean;combined?:boolean;label?:string;includeHeader?:boolean;blockedReason?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function run(download:boolean){if(busy)return;if(disabled){setError(blockedReason??"This report is still processing. It will be available after the laboratory successfully completes the results.");return;}setBusy(true);setError("");try{
  const query=new URLSearchParams({includeHeader:String(includeHeader),letterhead:String(!includeHeader),printMode:"department",download:String(download)});if(testIds)query.set("testIds",testIds.join(","));
  const url=`${process.env.NEXT_PUBLIC_API_URL??"http://localhost:5000/api/v1"}/vendor-portal/bills/${encodeURIComponent(billId)}/report.pdf?${query}`;
  await openAuthorizedReportPdf(url, download);
 }catch(failure){setError(failure instanceof Error?failure.message:"Report unavailable. Refresh its status and retry.");}finally{setBusy(false);}}
 return <div className="space-y-1"><div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={busy} onClick={()=>void run(false)}>{busy?"Preparing…":label??(combined?"Print / Download":"Print")}</Button>{!combined&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void run(true)}>Download</Button>}</div><Dialog open={Boolean(error)} centered onOpenChange={open=>{if(!open)setError("");}} title="Report printing"><p role="alert">{error}</p><div className="mt-4 flex justify-end"><Button onClick={()=>setError("")}>OK</Button></div></Dialog></div>;
}
