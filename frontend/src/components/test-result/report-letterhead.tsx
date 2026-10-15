"use client";
import Image from "next/image";
import { cn } from "@/lib/utils";

const REPORT_WORDMARK = "ANJALI";
const REPORT_WORDMARK_SUB = "DIAGNOSTICS";
const REPORT_REGD_NO = "Regd. No. 414/DM & HO/RR/2008";

/** Shared existing centre stationery; no clinical signature or approval is added. */
export function ReportLetterhead({includeHeader=false,letterhead=false}:{includeHeader?:boolean;letterhead?:boolean}) {
  return ((includeHeader || letterhead) ? <div className={cn("lis-clinical-letterhead leading-none", letterhead && "invisible")} aria-label={letterhead ? "Reserved letterhead space" : undefined} aria-hidden={letterhead || undefined}>
            <Image src="/Main logo.png" alt="Anjali Diagnostics logo" width={1254} height={1254} unoptimized loading="eager" className="lis-clinical-logo" />
            <div>
            <p className="text-[26pt] font-bold uppercase leading-[26pt] tracking-[0.14em] text-[#005430]">
              {REPORT_WORDMARK}
            </p>
            <p className="mt-[1mm] text-[11pt] font-bold uppercase tracking-[0.22em] text-[#d8180c]">
              {REPORT_WORDMARK_SUB}
            </p>
            <p className="mt-[1.5mm] text-[7.5pt] font-bold">{REPORT_REGD_NO}</p>
            </div>
          </div> : null);
}
