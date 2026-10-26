"use client";
import {useEffect,useState} from "react";
import {reportDownloadFilename,validatedReportPdf} from "@/lib/browser-report";

/** The token stays in the URL fragment, outside server access logs and referrers. */
export function SharedReport(){
 const [url,setUrl]=useState(""),[filename,setFilename]=useState("report.pdf"),[error,setError]=useState("");
 useEffect(()=>{
  const token=window.location.hash.slice(1),controller=new AbortController();let objectUrl:string|undefined;
  if(!/^[A-Za-z0-9_-]{43}$/.test(token)){queueMicrotask(()=>{if(!controller.signal.aborted)setError("This report link is unavailable.");});return()=>controller.abort();}
  const base=(process.env.NEXT_PUBLIC_API_URL??"/api/v1").replace(/\/$/,"");
  void (async()=>{try{
   const response=await fetch(`${base}/report-shares/view`,{method:"POST",credentials:"omit",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({token}),signal:controller.signal});
   const blob=await validatedReportPdf(response);if(controller.signal.aborted)return;
   objectUrl=URL.createObjectURL(blob);setFilename(reportDownloadFilename(response.headers.get("content-disposition")));setUrl(objectUrl);
  }catch{if(!controller.signal.aborted)setError("This report link has expired or the report has changed. Please request a new report from the laboratory.");}})();
  return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[]);
 if(error)return <main className="p-5"><h1 className="text-xl">Report unavailable</h1><p role="alert">{error}</p></main>;
 if(!url)return <main className="p-5" role="status">Opening your report…</main>;
 return <main className="min-h-screen bg-white"><div className="flex justify-end p-2"><a className="rounded border px-4 py-2" href={url} download={filename}>Download report</a></div><iframe src={url} title="Complete laboratory report" className="h-[90vh] w-full border-0"/><p className="p-2 text-sm">If the report preview is unavailable on your phone, use Download report.</p></main>;
}
