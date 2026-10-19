"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, ChevronUp, ChevronDown, Search, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {OspPatientDetails,emptyPatientDetails} from "@/components/billing/osp-patient-details";
import {parseOspDob} from "@/lib/osp-dob";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { genderToStoredValue } from "@/lib/patient-title";
import type {LabBill} from "@/types/billing";
import {formatPatientDisplayName} from "@/lib/patient-title";
import {VendorBillEditor} from "./vendor-bill-editor";
import {VendorTestSelector} from "./vendor-test-selector";
import { validateOspAge } from "@/lib/patient-age";

export function VendorSubmissionForm() {
  const requestKey = useRef<string | null>(null);
  const formRef=useRef<HTMLFormElement>(null);
  const [patient,setPatient]=useState(emptyPatientDetails);
  const [doctorId,setDoctorId]=useState("");
  const [patientExpanded,setPatientExpanded]=useState(true);
  const [billSearch,setBillSearch]=useState("");
  const [editingId,setEditingId]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);
  const matches=useQuery({queryKey:["vendor-form-search",billSearch],enabled:searchOpen&&billSearch.trim().length>=2,queryFn:({signal})=>api.get<{data:LabBill[]}>(`/vendor-portal/bills?${new URLSearchParams({search:billSearch.trim(),page:"1",limit:"20"})}`,{signal})});
  const existing=useQuery({queryKey:["vendor-bill",editingId],enabled:Boolean(editingId),queryFn:()=>api.get<{bill:LabBill}>(`/vendor-portal/bills/${encodeURIComponent(editingId)}`)});


  const client=useQuery({queryKey:["vendor-own-client"],queryFn:()=>api.get<{name:string;clientCode:string}>("/vendor-portal/client")});
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");


  const [selectedTests,setSelectedTests]=useState<string[]>([]);

  const catalogue = useQuery({
    queryKey: ["vendor-catalogue"],
    queryFn: () =>
      api.get<{ id: string; testName: string; testCode: string; departmentId: string; price: number }[]>(
        "/vendor-portal/catalogue",
      ),
  });
  const departments = useQuery({
    queryKey: ["vendor-departments"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/vendor-portal/departments"),
  });
  const doctors = useQuery({
    queryKey: ["vendor-doctors"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/vendor-portal/doctors"),
  });

  return (
    <div data-vendor="true" className="lis-bill-form space-y-3 rounded-md border border-border/80 bg-white px-4 py-3 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-2">
          <h1 className="font-heading text-[18px] font-medium leading-tight text-slate-800">Generate Vendor-Client Investigations Bill</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="Search vendor bills" placeholder="Search patient name or bill ID" className="h-8 w-64" value={billSearch} onChange={event=>{setBillSearch(event.target.value);setSearchOpen(true);}} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();setSearchOpen(true);}}}/>
            <Button type="button" variant="outline" size="sm" onClick={()=>{setSearchOpen(true);void matches.refetch();}}><Search className="size-4"/>Search</Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>{setEditingId("");setSearchOpen(false);setBillSearch("");formRef.current?.reset();setPatient(emptyPatientDetails());setDoctorId("");setSelectedTests([]);setFeedback("");setPatientExpanded(true);}}><Plus className="size-4"/>Add</Button>
            <Button type="button" variant="outline" size="icon" aria-label="Toggle patient details" onClick={()=>setPatientExpanded(value=>!value)}>{patientExpanded?<ChevronUp/>:<ChevronDown/>}</Button>
            <Button type="button" variant="outline" size="sm" asChild><Link href="/vendor-portal/reports">Reports</Link></Button>
            <Button type="button" variant="outline" size="sm" asChild><Link href="/vendor-portal">Home</Link></Button>
          </div>
        </header>
        {searchOpen&&billSearch.trim().length>=2&&<section aria-label="Matching vendor bills" className="border border-border p-2">
          {matches.isPending?<p>Searching…</p>:matches.isError?<p role="alert">Unable to search your bills. Please retry.</p>:!matches.data?.data.length?<p>No matching bills found.</p>:matches.data.data.map(bill=>{const person=typeof bill.patientId==="object"?bill.patientId:null;return <button type="button" className="block w-full border-b p-2 text-left hover:bg-slate-50" key={bill.id} onClick={()=>{setEditingId(bill.id);setSearchOpen(false);}}>{bill.billNumber} · {person?formatPatientDisplayName({title:person.title,fullName:person.fullName,displayName:person.displayName}):"Patient"}</button>;})}
        </section>}
        {editingId?<section aria-label="Existing vendor bill">{existing.isPending?<p>Loading patient and test details…</p>:existing.isError?<p role="alert">Unable to load this bill. <Button onClick={()=>void existing.refetch()}>Retry</Button></p>:existing.data&&<><h2 className="text-lg font-medium">{existing.data.bill.billNumber}</h2><VendorBillEditor key={editingId} defaultOpen bill={existing.data.bill} onSaved={()=>{void existing.refetch();void matches.refetch();}}/></>}</section>:
        <form ref={formRef}
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const form = event.currentTarget;
            const ageText = patient.ageYears;
            const parsedDob=parseOspDob(patient.dateOfBirth);
            const dateOfBirth=parsedDob.date??"";
            const ageError = validateOspAge({
              dateOfBirth,
              ageYears: ageText,
              ageMonths: patient.ageMonths,
              ageDays: patient.ageDays,
            });
            if (!patient.name.trim() || !patient.gender || !patient.mobile.trim() || parsedDob.error || ageError) {
              setFeedbackTone("error");
              setFeedback(parsedDob.error || ageError || "Name, gender and mobile number are required.");
              return;
            }
            requestKey.current ??= crypto.randomUUID();
            setBusy(true);
            setFeedback("");
            try {
              const result = await api.post<{ billId: string; billNumber?: string }>(
                "/vendor-portal/submissions",
                {
                  requestKey: requestKey.current,
                  patient: {
                    title: patient.title==="--Select--"?undefined:patient.title,
                    firstName:patient.name,
                    lastName:patient.surname,
                    age: ageText ? Number(ageText) : undefined,
                    dateOfBirth: dateOfBirth || undefined,
                    gender:genderToStoredValue(patient.gender),
                    mobile:patient.mobile,
                    address:patient.address,
                    email:patient.email,
                  },
                  order: {
                    items: selectedTests.map((testId) => ({ testId, quantity: 1 })),
                    referringDoctorId:doctorId || undefined,
                  },
                },
              );
              setFeedbackTone("success");
              setFeedback(`Submission saved. Reference ${result.billNumber ?? result.billId}.`);
              requestKey.current = null;
              form.reset();setPatient(emptyPatientDetails());setDoctorId("");
              setSelectedTests([]);


              await cache.invalidateQueries({ queryKey: ["vendor-bills"] });
            } catch (error) {
              setFeedbackTone("error");
              setFeedback(error instanceof Error ? error.message : "Submission failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {(catalogue.isError || departments.isError || client.isError) && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive"><span>{client.isError?"Assigned billing client could not be loaded. ":""}{catalogue.isError?"Assigned tests could not be loaded. ":""}{departments.isError?"Departments could not be loaded.":""}</span><Button type="button" size="sm" variant="outline" onClick={()=>{void catalogue.refetch();void departments.refetch();void client.refetch();}}>Retry loading</Button></div>}
          {patientExpanded&&<section aria-label="Patient details"><OspPatientDetails value={patient} onChange={setPatient} doctor={null} onDoctorSelect={()=>{}} doctorField={<div className="flex items-center gap-2"><Select aria-label="Referring doctor" value={doctorId} onChange={event=>setDoctorId(event.target.value)}><option value="">Doctor..</option>{doctors.data?.map(doctor=><option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</Select><Button type="button" variant="outline" size="icon" disabled title="Doctor configuration is managed by the administrator"><Plus/></Button></div>}/>{doctors.isError&&<p className="px-3 text-xs text-muted-foreground">Doctor list unavailable. Self/referral not specified remains available. <button type="button" onClick={()=>void doctors.refetch()}>Retry doctors</button></p>}</section>}
          <section className="lis-vendor-client" aria-label="Billing client"><div className="flex max-w-[760px] flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold uppercase tracking-wide">Billing Client *</h2><p className="text-sm text-muted-foreground">Billing client assigned to your login</p></div><span className="rounded border border-border px-3 py-2 text-sm">{client.data?`${client.data.name} (${client.data.clientCode})`:"Loading your client…"}</span></div></section>
          <section aria-label="Test selection">
          <VendorTestSelector tests={catalogue.data??[]} departments={departments.data??[]} selected={selectedTests} onChange={setSelectedTests} disabled={busy}/>
          </section>

          {feedback && (
            <p
              role={feedbackTone === "error" ? "alert" : "status"}
              className={
                feedbackTone === "error"
                  ? "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              }
            >
              {feedback}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/80 pt-3">
            <Button
              type="reset"
              variant="outline"
              disabled={busy}
              onClick={() => {


                setSelectedTests([]);
                setFeedback("");setPatient(emptyPatientDetails());setDoctorId("");
              }}
            >
              Clear
            </Button>
            <Button type="submit" disabled={busy || catalogue.isPending || client.isPending || catalogue.isError || departments.isError || client.isError || selectedTests.length===0}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {busy ? "Submitting..." : "Save Vendor Bill"}
            </Button>
          </div>
        </form>}
    </div>
  );
}
