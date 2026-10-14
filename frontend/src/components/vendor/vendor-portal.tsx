"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import type { LabBill } from "@/types/billing";
import { VendorSubmissionForm } from "./vendor-submission-form";
import { Dialog } from "@/components/ui/dialog";

export function VendorPortal() {
  const { user } = useAuth();
  const [section,setSection]=useState("Vendor Data");
  const [search,setSearch] = useState(""); const [page,setPage] = useState(1);
  const [selected,setSelected] = useState<LabBill|null>(null);
  const bills = useQuery({queryKey:["vendor-bills",search,page,user?.id],enabled:user?.role === "vendor",queryFn:()=>api.get<{data:LabBill[];pagination:{total:number;totalPages:number}}>(`/vendor-portal/bills?${new URLSearchParams({search,page:String(page),limit:"20"})}`)});
  if (user?.role !== "vendor") return <p>Vendor account required.</p>;
  return <section className="p-4 space-y-3"><h1 className="text-xl">Vendor Client Dashboard</h1><nav className="flex flex-wrap gap-2">{["OSP Lab Form","Vendor Data","Details","Results & Reports"].map(label=><Button key={label} variant={section===label?"default":"outline"} onClick={()=>setSection(label)}>{label}</Button>)}</nav>
    {section==="OSP Lab Form"?<VendorSubmissionForm/>:<>
    <label>Search <Input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} /></label>
    {bills.isError && <p role="alert">{bills.error.message}</p>}
    <div className="overflow-auto"><table className="w-full table-fixed text-sm"><thead><tr><th>Reference</th><th>Patient</th><th>Submitted</th><th>Requested tests</th><th>Bill status</th><th>Details</th></tr></thead><tbody>{bills.data?.data.map(bill=><tr key={bill.id} className="border-b [&>td]:break-words [&>td]:p-1"><td>{bill.billNumber}</td><td>{typeof bill.patientId === "object" ? <>{bill.patientId.fullName}<small className="block">{bill.patientId.patientId}</small></> : "—"}</td><td>{bill.createdAt?new Date(bill.createdAt).toLocaleString():"Unavailable"}</td><td>{bill.items.map(item=>item.testName).join(", ")}</td><td>{bill.status}</td><td><Button onClick={()=>setSelected(bill)}>View</Button></td></tr>)}</tbody></table></div>
    <div className="flex gap-3"><Button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</Button><span>{bills.data?.pagination.total ?? 0} bills · Page {page}</span><Button disabled={!bills.data || page>=bills.data.pagination.totalPages} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
    {section!=="Vendor Data"&&!selected&&<p>Select a record in Vendor Data first.</p>}
    {selected && <VendorBillDetail key={selected.id} bill={selected} showReports={section==="Results & Reports"} onClose={()=>setSelected(null)} />}</>}
  </section>;
}
function VendorBillDetail({bill:initialBill,onClose,showReports}:{bill:LabBill;onClose:()=>void;showReports:boolean}) {
  const detail=useQuery({queryKey:["vendor-bill",initialBill.id],queryFn:()=>api.get<{bill:LabBill}>(`/vendor-portal/bills/${initialBill.id}`)});
  const bill=detail.data?.bill??initialBill;
  const [preview,setPreview]=useState<{url:string;name:string}|null>(null);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
  const [testId,setTestId]=useState(bill.items[0]?.testId ?? ""); const [error,setError]=useState("");const [downloading,setDownloading]=useState<string|null>(null);
  const path=`/vendor-portal/bills/${encodeURIComponent(bill.id)}/attachments`;
  const workflow=useQuery({queryKey:["vendor-workflow",bill.id],queryFn:()=>api.get<{hasOutstandingDue:boolean;tests:{testId:string;submitted:boolean}[]}>(`/vendor-portal/bills/${bill.id}/workflow`)});
  const samples=useQuery({queryKey:["vendor-samples",bill.id],queryFn:()=>api.get<{testId:string;sampleStatus:string}[]>(`/vendor-portal/bills/${bill.id}/samples`)});
  const ready=workflow.data?.tests.some(test=>test.testId===testId&&test.submitted)&&!workflow.data?.hasOutstandingDue;
  const attachments=useQuery({queryKey:["vendor-attachments",bill.id,testId],enabled:!!testId&&showReports&&!!ready,queryFn:()=>api.get<{id:string;fileName:string}[]>(`${path}?${new URLSearchParams({testId})}`)});
  const patient=typeof bill.patientId==="object"?bill.patientId:null;
  return <div className="border p-3 space-y-2"><h2>{bill.billNumber}</h2><p>{patient?.fullName} · {patient?.patientId} · {patient?.gender} · {patient?.age??"Age unavailable"}</p><p>Submitted: {bill.createdAt?new Date(bill.createdAt).toLocaleString():"Unavailable"} · Billing status: {bill.status}</p><label>Ordered test<select className="block border p-2 w-full" value={testId} onChange={e=>setTestId(e.target.value)}>{bill.items.map(item=><option key={item.testId} value={item.testId}>{item.departmentName} · {item.testName}</option>)}</select></label>
    {workflow.isError&&<p role="alert">Unable to verify laboratory status.</p>}<p>{ready?"Available under the current report release rules":"Report unavailable: processing or outstanding dues"}</p>
    <p>Result submission: {workflow.data?.tests.find(test=>test.testId===testId)?.submitted?"Submitted":"Not submitted"}</p>
    <p>Sample status: {samples.data?.find(sample=>sample.testId===testId)?.sampleStatus??"Not recorded"}</p>
    {showReports&&<>
    {attachments.isError && <p role="alert">{attachments.error.message}</p>}{error && <p role="alert">{error}</p>}
    {!attachments.isPending && !attachments.isError && !attachments.data?.length && <p>No uploaded PDF report is available for this test.</p>}
    {attachments.data?.map(row=><div key={row.id} className="flex gap-2">{["View","Download"].map(action=><Button key={action} disabled={downloading!==null} onClick={async()=>{if(action==="View"){window.open(`${process.env.NEXT_PUBLIC_API_URL??"http://localhost:5000/api/v1"}${path}/${encodeURIComponent(row.id)}?${new URLSearchParams({testId,view:"true"})}`,"_blank","noopener,noreferrer");return;}setDownloading(row.id);setError("");try{const response=await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1"}${path}/${encodeURIComponent(row.id)}?${new URLSearchParams({testId})}`,{credentials:"include"});if(!response.ok)throw new Error("Report access is unavailable. Check submission and outstanding dues.");const url=URL.createObjectURL(await response.blob());if(action==="View")setPreview({url,name:row.fileName});else{const link=document.createElement("a");link.href=url;link.download=row.fileName;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}catch(e){setError(e instanceof Error?e.message:"Report access failed");}finally{setDownloading(null);}}}>{action} {row.fileName}</Button>)}</div>)}
    {preview&&<Dialog open onOpenChange={open=>{if(!open)setPreview(null);}} title="Report PDF" size="lg"><iframe className="h-[65vh] w-full" title={preview.name} src={preview.url}/><Button variant="outline" onClick={()=>setPreview(null)}>Close report</Button></Dialog>}
    </>}{!showReports&&<VendorContactEditor billId={bill.id}/>}<Button onClick={onClose}>Close</Button>
  </div>;
}
function VendorContactEditor({billId}:{billId:string}) {
  const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [feedback,setFeedback]=useState("");
  const contact=useQuery({queryKey:["vendor-contact",billId],enabled:open,queryFn:()=>api.get<{mobile:string;email?:string;address?:string;updatedAt:string}>(`/vendor-portal/bills/${billId}/contact`)});
  if(!open)return <Button variant="outline" onClick={()=>setOpen(true)}>Edit contact details</Button>;
  return <div className="border p-2 space-y-2"><h3>Contact details</h3><p className="text-sm">Patient identity, clinical demographics and order fields require staff review.</p>
    {contact.isError&&<p role="alert">{contact.error.message}</p>}
    {contact.data&&<form key={contact.data.updatedAt} className="grid gap-2 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();if(busy)return;const data=new FormData(e.currentTarget);setBusy(true);setFeedback("");try{await api.patch(`/vendor-portal/bills/${billId}/contact`,{mobile:data.get("mobile"),email:data.get("email"),address:data.get("address"),expectedUpdatedAt:contact.data!.updatedAt});await contact.refetch();setFeedback("Contact details updated.");}catch(error){setFeedback(error instanceof Error?error.message:"Update failed");}finally{setBusy(false);}}}>
      <label>Mobile<Input required name="mobile" pattern="[0-9]{1,13}" defaultValue={contact.data.mobile}/></label>
      <label>Email<Input name="email" type="email" defaultValue={contact.data.email??""}/></label>
      <label>Address<Input name="address" maxLength={500} defaultValue={contact.data.address??""}/></label>
      <Button disabled={busy}>Save contact details</Button>
    </form>}{feedback&&<p role="status">{feedback}</p>}<Button variant="outline" onClick={()=>setOpen(false)}>Close contact editor</Button>
  </div>;
}
