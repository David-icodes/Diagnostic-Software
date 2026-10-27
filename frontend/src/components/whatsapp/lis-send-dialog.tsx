"use client";
import {useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Dialog} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Select} from '@/components/ui/select';
import {communicationRequest} from '@/services/communications';
import type {LisWhatsAppInput} from '@/services/whatsapp-lis';
import {trackDocumentJob} from './communication-job-notifications';
export function LisSendDialog({input,onClose}:{input:Omit<LisWhatsAppInput,'templateName'>;onClose:()=>void;onLegacyReportReady?:()=>void}){
 const templateName=input.workflow==='lab-reprint'?'lab_invoice_ready':'lab_report_ready';
 const [includeHeader,setIncludeHeader]=useState(true),[queued,setQueued]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[requestId,setRequestId]=useState(()=>crypto.randomUUID());const submitting=useRef(false);
 const message={...input,templateName,includeHeader},check=useQuery({queryKey:['whatsapp-check',message],queryFn:()=>communicationRequest<{patientName:string;patientCode:string;billNumber:string;ready:boolean}>('/documents/check','POST',message),retry:false,gcTime:0,refetchOnWindowFocus:false});
 return <Dialog open centered title={queued?'Message queued':'Send WhatsApp'} onOpenChange={open=>{if(!open&&!submitting.current)onClose();}}>
 {queued?<div className="flex justify-end"><Button onClick={onClose}>Close</Button></div>:<div className="space-y-4"><p className="font-medium">{templateName==='lab_invoice_ready'?'Bill / Invoice':'Reports'}</p>
 {templateName==='lab_report_ready'&&<label className="block text-sm">Report header<Select className="mt-1" aria-label="Report header" value={includeHeader?'header':'none'} disabled={busy} onChange={e=>{setIncludeHeader(e.target.value==='header');setRequestId(crypto.randomUUID());setError('');}}><option value="header">With Header</option><option value="none">Without Header</option></Select></label>}
 {check.data&&<div className="rounded-md border bg-slate-50 p-3 text-sm"><p className="font-medium">{check.data.patientName}</p><p>{check.data.patientCode} · {check.data.billNumber}</p></div>}
 {(error||check.isError)&&<p role="alert" className="text-sm text-red-700">{error||check.error?.message}</p>}
 <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy||check.isFetching||!check.data?.ready||check.isError} onClick={async()=>{if(submitting.current||!check.data?.ready)return;submitting.current=true;setBusy(true);setError('');try{const result=await communicationRequest<{jobId:string}>('/documents/queue','POST',{requestId,message});trackDocumentJob(result.jobId);setQueued(true);}catch(e){setError(e instanceof Error?e.message:'Message could not be queued.');}finally{submitting.current=false;setBusy(false);}}}>Send</Button></div>
 </div>}
 </Dialog>;
}
