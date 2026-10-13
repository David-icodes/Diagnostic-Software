"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {api} from "@/lib/api";
import {Button} from "@/components/ui/button";
export function CBPDevelopmentPreparation({testId}:{testId:string|null|undefined}) {
 const router=useRouter();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 if(process.env.NODE_ENV!=="development"||testId!=="6acd328b871437b91c0ad9b2")return null;
 async function enable(){setBusy(true);try{await api.post("/lab-test-parameters/development/cbp/enable-synthetic",{});setMessage("Development-only calculations enabled for registered synthetic bills. No clinical approval granted.");}catch(e){setMessage(e instanceof Error?e.message:"Activation failed");}finally{setBusy(false);}}
 async function synthetic(){setBusy(true);try{const r=await api.post<{billId:string;testId:string;billNumber:string}>("/lab-test-parameters/development/cbp/synthetic-run",{});router.push(`/laboratory/test-result/parameter-based-test-results?billId=${encodeURIComponent(r.billId)}&testId=${encodeURIComponent(r.testId)}&billNumber=${encodeURIComponent(r.billNumber)}`);}catch(e){setMessage(e instanceof Error?e.message:"Synthetic run creation failed");}finally{setBusy(false);}}
 return <div className="flex flex-wrap items-center gap-2 text-sm"><Button type="button" variant="outline" disabled={busy} onClick={enable}>Enable synthetic CBP calculations</Button><Button type="button" variant="outline" disabled={busy} onClick={synthetic}>Create synthetic CBP verification bill</Button>{message&&<p role="status">{message}</p>}</div>;
}
