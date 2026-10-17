"use client";
import Image from "next/image";
import {cn} from "@/lib/utils";
/** One immutable stationery image, shared with uploaded-PDF composition. */
export function ReportLetterhead({includeHeader=false,letterhead=false}:{includeHeader?:boolean;letterhead?:boolean}) {
 return includeHeader||letterhead ? <div className={cn("lis-clinical-letterhead",letterhead&&"invisible")} aria-label={letterhead?"Reserved letterhead space":undefined} aria-hidden={letterhead||undefined}>
  <Image src="/report-header.png" alt="Anjali Diagnostics letterhead" width={1600} height={170} unoptimized loading="eager" style={{width:"100%",height:"100%",objectFit:"contain",objectPosition:"center"}} />
 </div> : null;
}
