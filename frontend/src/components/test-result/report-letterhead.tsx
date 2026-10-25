"use client";
import Image from "next/image";
import {cn} from "@/lib/utils";
/** One immutable stationery image, shared with uploaded-PDF composition. */
export function ReportLetterhead({includeHeader=false,letterhead=false}:{includeHeader?:boolean;letterhead?:boolean}) {
 if(!includeHeader||letterhead)return <div className="lis-clinical-letterhead" style={{minHeight:"22mm"}} aria-label="Reserved letterhead space"/>;
 return <div className={cn("lis-clinical-letterhead")} style={{position:"relative"}}>
  <Image src="/report-header.png" alt="Anjali Diagnostics letterhead" width={1600} height={170} unoptimized loading="eager" style={{width:"100%",height:"100%",objectFit:"contain",objectPosition:"center"}} />
  <Image src="/Main%20logo.png" alt="" aria-hidden="true" width={1254} height={1254} unoptimized loading="eager" style={{position:"absolute",left:0,top:0,width:"21.5mm",height:"22mm",objectFit:"contain",background:"white"}} />
 </div>;
}
