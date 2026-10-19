"use client";
import {useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {api} from "@/lib/api";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useAuth} from "@/hooks/use-auth";
import {formatPatientDisplayName} from "@/lib/patient-title";
import type {LabBill} from "@/types/billing";
import {VendorSubmissionForm} from "./vendor-submission-form";
import {formatMoney} from "@/lib/utils";
import {VendorBillEditor} from "./vendor-bill-editor";
import {InvoicePrintDialog} from "@/components/test-result/invoice-print-dialog";
import {VendorReportActions} from "./vendor-report-actions";

type VendorBill=LabBill & {reportStatus?:"completed"|"processing"|"cancelled";reportAvailable?:boolean};
type Section="OSP Lab Form"|"Vendor Data"|"Details"|"Results & Reports";
function patientName(bill:LabBill){
 const patient=typeof bill.patientId==="object"?bill.patientId:null;
 return patient?formatPatientDisplayName({title:patient.title,displayName:patient.displayName,fullName:patient.fullName}):"—";
}
function Status({cancelled,complete}:{cancelled:boolean;complete:boolean}){
 return <span className={cancelled?"text-slate-500":complete?"text-emerald-700":"text-amber-700"}>{cancelled?"Cancelled":complete?"Completed":"Processing"}</span>;
}
export function VendorPortal({section="Vendor Data",initialSearch="",initialBillId=""}:{section?:Section;initialSearch?:string;initialBillId?:string}){
 const {user}=useAuth();
 const [search,setSearch]=useState(initialSearch),[page,setPage]=useState(1);
 const bills=useQuery({queryKey:["vendor-bills",search,page,user?.id],enabled:user?.role==="vendor"&&section!=="OSP Lab Form"&&!initialBillId,refetchInterval:15000,refetchOnWindowFocus:true,
 queryFn:()=>api.get<{data:VendorBill[];pagination:{total:number;totalPages:number}}>(`/vendor-portal/bills?${new URLSearchParams({search,page:String(page),limit:"20"})}`)});
 if(user?.role!=="vendor")return <p>Vendor account required.</p>;
 if(section==="OSP Lab Form")return <VendorSubmissionForm/>;
 if(initialBillId)return <VendorReportDetail key={initialBillId} billId={initialBillId}/>;
 return <section className="space-y-3">
  <header className="lis-page-header flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-medium">Anjali Diagnostics</h1><Button size="sm" variant="outline" disabled={bills.isFetching} onClick={()=>void bills.refetch()}>Refresh status</Button></header>
  <div className="border border-border bg-white">
   <label className="flex flex-wrap items-center gap-2 border-b p-3 text-sm">Search<Input className="max-w-sm" placeholder="Bill number or patient" value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}}/></label>
   {bills.isError&&<p role="alert" className="p-3 text-destructive">Unable to load reports. Please retry.</p>}
   <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Bill ID</th><th className="p-3">Patient</th><th className="p-3">Report status</th></tr></thead><tbody>
    {bills.isPending?<tr><td colSpan={3} className="p-4">Loading reports…</td></tr>:!bills.data?.data.length?<tr><td colSpan={3} className="p-4">No reports found.</td></tr>:bills.data.data.map(bill=><tr key={bill.id} className="border-t"><td className="p-3"><Link className="text-primary underline" href={`/vendor-portal/details?${new URLSearchParams({billId:bill.id})}`}>{bill.billNumber}</Link></td><td className="p-3">{patientName(bill)}</td><td className="p-3"><Status cancelled={bill.status==="cancelled"} complete={bill.reportStatus==="completed"}/></td></tr>)}
   </tbody></table></div>
   <div className="flex items-center gap-3 border-t p-3"><Button size="sm" variant="outline" disabled={page===1} onClick={()=>setPage(value=>value-1)}>Previous</Button><span className="text-sm">Page {page}</span><Button size="sm" variant="outline" disabled={!bills.data||page>=bills.data.pagination.totalPages} onClick={()=>setPage(value=>value+1)}>Next</Button></div>
  </div>
 </section>;
}
function VendorReportDetail({billId}:{billId:string}){
 const [selected,setSelected]=useState<string[]>([]);
 const [printBill,setPrintBill]=useState(false);
 const [includeHeader,setIncludeHeader]=useState(true);
 const id=encodeURIComponent(billId);
 const detail=useQuery({queryKey:["vendor-bill",billId],refetchInterval:5000,refetchOnWindowFocus:true,queryFn:()=>api.get<{bill:LabBill}>(`/vendor-portal/bills/${id}`)});
 const workflow=useQuery({queryKey:["vendor-workflow",billId],refetchInterval:5000,refetchOnWindowFocus:true,queryFn:()=>api.get<{hasOutstandingDue:boolean;tests:{testId:string;submitted:boolean;uploadedReportId?:string}[]}>(`/vendor-portal/bills/${id}/workflow`)});
 const bill=detail.data?.bill;
 const complete=(testId:string)=>Boolean(workflow.data?.tests.some(test=>test.testId===testId&&(test.submitted||test.uploadedReportId)));
 const eligible=bill?.status==="generated"&&workflow.data&&!workflow.data.hasOutstandingDue&&!workflow.isError&&!detail.isError?bill.items.filter(item=>complete(item.testId)).map(item=>item.testId):[];
 const printSelected=eligible.filter(testId=>selected.includes(testId));
 const patient=bill&&typeof bill.patientId==="object"?bill.patientId:null;
 return <section className="space-y-3"><header className="lis-page-header flex items-center justify-between"><h1 className="text-xl font-medium">Anjali Diagnostics</h1><Link className="text-primary underline" href="/vendor-portal">Home</Link></header>
  {(detail.isError||workflow.isError)&&<p role="alert" className="text-destructive">Unable to verify this report. <Button variant="outline" onClick={()=>{void detail.refetch();void workflow.refetch();}}>Retry</Button></p>}
  {detail.isPending?<p>Loading report status…</p>:bill&&<div className="space-y-4 border border-border bg-white p-4"><h2 className="text-lg font-medium">{bill.billNumber}</h2><div><p className="font-medium">{patientName(bill)}</p><p className="text-sm text-muted-foreground">{patient?.patientId} · {patient?.gender} · {patient?.age??"Age unavailable"}</p></div>
   <label className="flex items-center gap-2 text-sm">Report printing<select aria-label="Report header" className="rounded border p-2" value={includeHeader?"header":"blank"} onChange={event=>setIncludeHeader(event.target.value==="header")}><option value="header">With Header</option><option value="blank">Without Header (blank space)</option></select></label>
   <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-2">Investigation</th><th className="p-2">Price (₹)</th><th className="p-2">Amount (₹)</th><th className="p-2">Report status</th><th className="p-2"><label className="flex items-center gap-2"><input type="checkbox" aria-label="Select all printable reports" disabled={!eligible.length} checked={eligible.length>0&&eligible.every(id=>selected.includes(id))} onChange={event=>setSelected(event.target.checked?eligible:[])}/>Print</label></th></tr></thead><tbody>{bill.items.map(item=><tr key={item.testId} className="border-t"><td className="p-2">{item.testName}{item.quantity!==1?` × ${item.quantity}`:""}</td><td className="p-2">{formatMoney(item.unitPrice)}</td><td className="p-2">{formatMoney(item.total)}</td><td className="p-2"><Status cancelled={bill.status==="cancelled"} complete={complete(item.testId)}/></td><td className="p-2"><input type="checkbox" aria-label={`Print ${item.testName}`} disabled={!eligible.includes(item.testId)} checked={eligible.includes(item.testId)&&selected.includes(item.testId)} onChange={event=>setSelected(ids=>event.target.checked?[...ids,item.testId]:ids.filter(id=>id!==item.testId))}/><VendorReportActions combined label="Print" includeHeader={includeHeader} billId={bill.id} testIds={[item.testId]} disabled={!eligible.includes(item.testId)}/></td></tr>)}</tbody><tfoot><tr className="border-t font-semibold"><td className="p-2" colSpan={2}>Total amount</td><td className="p-2" colSpan={3}>₹{formatMoney(bill.totalAmount)}</td></tr></tfoot></table></div>
   <div className="flex flex-wrap gap-2"><VendorReportActions includeHeader={includeHeader} combined label="Print Selected" billId={bill.id} testIds={printSelected} disabled={!printSelected.length}/><VendorReportActions includeHeader={includeHeader} combined label="Print All" billId={bill.id} testIds={eligible} disabled={!eligible.length}/><Button size="sm" variant="outline" disabled={bill.status!=="generated"} onClick={()=>setPrintBill(true)}>Bill Print</Button></div>
   <p className="text-xs text-muted-foreground">Select completed reports to print. Print All includes all currently printable tests.</p>
   <VendorBillEditor bill={bill} onSaved={()=>{setSelected([]);void detail.refetch();void workflow.refetch();}}/>
   {printBill&&<InvoicePrintDialog bill={bill} onClose={()=>setPrintBill(false)}/>}
  </div>}
 </section>;
}
