"use client";
import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {api} from "@/lib/api";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Select} from "@/components/ui/select";
import {PATIENT_TITLES} from "@/lib/patient-title";
import type {LabBill} from "@/types/billing";
import {VendorTestSelector,type VendorTest} from "./vendor-test-selector";
type PatientEdit={title?:string;firstName:string;lastName?:string;gender:string;age?:number;dateOfBirth?:string;mobile:string;email?:string;address?:string;updatedAt:string};
export function VendorBillEditor({bill,onSaved,defaultOpen=false}:{bill:LabBill;onSaved:()=>void;defaultOpen?:boolean}){
 const cache=useQueryClient();const [open,setOpen]=useState(defaultOpen),[selected,setSelected]=useState(bill.items.map(item=>item.testId)),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const catalogue=useQuery({queryKey:["vendor-catalogue"],enabled:open,queryFn:()=>api.get<VendorTest[]>("/vendor-portal/catalogue")});
 const departments=useQuery({queryKey:["vendor-departments"],enabled:open,queryFn:()=>api.get<{id:string;name:string}[]>("/vendor-portal/departments")});
 const patient=useQuery({queryKey:["vendor-patient-edit",bill.id],enabled:open,queryFn:()=>api.get<PatientEdit>(`/vendor-portal/bills/${bill.id}/patient`)});
 async function refreshed(){await Promise.all([cache.invalidateQueries({queryKey:["vendor-bills"]}),cache.invalidateQueries({queryKey:["vendor-bill",bill.id]}),cache.invalidateQueries({queryKey:["vendor-workflow",bill.id]})]);onSaved();}
 if(bill.status!=="generated")return <p role="status">This bill cannot be modified in its current status.</p>;
 if(!open)return <Button size="sm" variant="outline" onClick={()=>{setSelected(bill.items.map(item=>item.testId));setMessage("");setOpen(true);}}>Modify Bill</Button>;
 return <section className="space-y-3 rounded border border-border p-3"><h3 className="font-semibold">Modify Vendor-Client Bill</h3><p className="text-xs text-muted-foreground">Assigned tariffs only. Samples, results, payments and amendment history are preserved. Shared patient and demographic changes after results require staff review.</p>
 {(catalogue.isError||departments.isError||patient.isError)&&<p role="alert">Unable to load editable information. Refresh and retry.</p>}
 {patient.data&&<form key={patient.data.updatedAt} className="grid gap-3 sm:grid-cols-2" onSubmit={async event=>{event.preventDefault();setBusy(true);setMessage("");const values=new FormData(event.currentTarget);try{await api.patch(`/vendor-portal/bills/${bill.id}/patient`,{title:values.get("title"),firstName:values.get("firstName"),lastName:values.get("lastName"),gender:values.get("gender"),...(String(values.get("age")??"").trim()?{age:Number(values.get("age"))}:{}),...(values.get("dateOfBirth")?{dateOfBirth:values.get("dateOfBirth")} : {}),mobile:values.get("mobile"),email:values.get("email"),address:values.get("address"),expectedUpdatedAt:patient.data!.updatedAt});await patient.refetch();await refreshed();setMessage("Patient information saved.");}catch(error){setMessage(error instanceof Error?error.message:"Update failed");}finally{setBusy(false);}}}>
 <label>Title<Select name="title" defaultValue={patient.data.title??""}><option value="">--Select--</option>{PATIENT_TITLES.filter(t=>t!=="--Select--").map(t=><option key={t}>{t}</option>)}</Select></label>
 <label>First name<Input name="firstName" required minLength={2} maxLength={60} defaultValue={patient.data.firstName}/></label>
 <label>Last name<Input name="lastName" maxLength={60} defaultValue={patient.data.lastName??""}/></label>
 <label>Gender<Select name="gender" defaultValue={patient.data.gender}>{["male","female","other"].map(g=><option key={g}>{g}</option>)}</Select></label>
 <label>Age (years)<Input type="number" name="age" required={!patient.data.dateOfBirth} min={0} max={150} defaultValue={patient.data.age??""}/></label>
 <label>Date of birth<Input type="date" name="dateOfBirth" defaultValue={patient.data.dateOfBirth?.slice(0,10)??""}/></label>
 <label>Mobile<Input name="mobile" required defaultValue={patient.data.mobile}/></label><label>Email<Input name="email" type="email" defaultValue={patient.data.email??""}/></label>
 <label className="sm:col-span-2">Address<Input name="address" maxLength={500} defaultValue={patient.data.address??""}/></label><Button disabled={busy}>Save patient details</Button></form>}
 <VendorTestSelector quantities={Object.fromEntries(bill.items.map(item=>[item.testId,item.quantity]))} tests={[...(catalogue.data??[]).map(test=>({...test,price:bill.items.find(item=>item.testId===test.id)?.unitPrice??test.price})),...bill.items.filter(item=>!catalogue.data?.some(test=>test.id===item.testId)).map(item=>({id:item.testId,testName:item.testName,testCode:item.testCode,departmentId:"__historical",price:item.unitPrice}))]} departments={departments.data??[]} selected={selected} onChange={setSelected} disabled={busy}/>
 <Button disabled={busy||!selected.length||catalogue.isPending} onClick={async()=>{setBusy(true);setMessage("");try{await api.patch(`/vendor-portal/bills/${bill.id}`,{items:selected.map(testId=>({testId,quantity:bill.items.find(item=>item.testId===testId)?.quantity??1}))});await refreshed();setMessage("Tests updated. Existing clinical history and payments were preserved.");}catch(error){setMessage(error instanceof Error?error.message:"Update failed");}finally{setBusy(false);}}}>Save bill changes</Button>
 {message&&<p data-action-success={/^(?:Patient details updated|Tests updated)/.test(message)||undefined} role="status">{message}</p>}<Button variant="outline" disabled={busy} onClick={()=>{setSelected(bill.items.map(item=>item.testId));setMessage("");setOpen(false);}}>Cancel</Button></section>;
}
