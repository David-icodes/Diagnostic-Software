"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createPortal } from "react-dom";
import { EmptyState } from "@/components/common/empty-state";
import { PatientForm } from "@/components/patients/patient-form";
import { createPatient, fetchPatients } from "@/services/patients";
import { formatAgeYearsMonthsDays, formatGender, formatDate } from "@/lib/utils";
import { invalidateRoots, queryKeys } from "@/lib/query-keys";
import type { Patient } from "@/types/patient";
import type { PatientFormValues } from "@/validations/patient";

interface OspPatientSearchProps {
  selected: Patient | null;
  onSelect: (patient: Patient) => void;
}

export function OspPatientSearch({ selected, onSelect }: OspPatientSearchProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [page, setPage] = useState(1);

  const searchQuery = useQuery({
    queryKey: ["patients", "osp-search", search, page],
    queryFn: () => fetchPatients({ search: search || undefined, limit: 20, page }),
    enabled: open && Boolean(search),
  });

  const createMutation = useMutation({
    mutationFn: (values: PatientFormValues) => createPatient(values),
    onSuccess: (patient) => {
      // The new record must appear in the registry, in any open search and on the
      // dashboard's recent-patients panel.
      void invalidateRoots(queryClient, queryKeys.patients, queryKeys.dashboard);
      onSelect(patient);
      setAddOpen(false);
      setQuery("");
      setSearch("");
      setOpen(false);
    },
  });

  const runSearch = (raw: string) => { setSearch(raw.trim()); setPage(1); setOpen(true); };

  const rows = searchQuery.data?.data ?? [];

  return (
    <>
      <div className="relative lis-patient-search">
        <div className="flex items-center gap-2">
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);

            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                runSearch(query);
              }
            }}
            className="h-8 min-w-0 flex-1 md:w-[266px] md:flex-none"
            aria-label="Search patient by name, patient ID or mobile"
          />
          <Button
            type="button"
            onClick={() => {
              runSearch(query);
            }}
            disabled={searchQuery.isFetching}
            className="h-8 px-2.5"
          >
            {searchQuery.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search />
            )}
            Search
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              setAddOpen(true);
            }}
            className="h-8 px-2.5"
          >
            <UserPlus />
            Add
          </Button>
        </div>

        {open && typeof document !== "undefined" && document.getElementById("osp-patient-results") && createPortal(
          <section aria-label="Patient search results" className="border border-border bg-card">
            <div className="flex items-center justify-between px-2 py-1 text-xs">
              <span>{searchQuery.isFetching ? "Searching…" : `Patient List (${searchQuery.data?.pagination.total ?? 0})`}</span>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            </div>
            <div className="max-h-[260px] overflow-auto">
              <table className="w-full min-w-[800px] table-fixed text-xs lis-patient-table">
                <colgroup>{[6,6,14,22,11,9,13,19].map((width,index)=><col key={index} style={{width:width+"%"}} />)}</colgroup>
                <thead className="sticky top-0 bg-slate-100"><tr>{["Select","S.No","Pat Id","Patient Name","Age","Gender","Mobile No","Reg Date"].map(label=><th key={label} className="px-2 py-1 text-left whitespace-nowrap">{label}</th>)}</tr></thead>
                <tbody>
                  {searchQuery.isError ? <tr><td colSpan={8} role="alert" className="p-3 text-destructive">{searchQuery.error.message}</td></tr> : !rows.length ? <tr><td colSpan={8}><EmptyState message={search ? "No patients match your search" : "Type a name, patient ID or mobile and search"} /></td></tr> : rows.map((patient,index)=><tr key={patient.id} aria-selected={selected?.id===patient.id} className="border-t border-border hover:bg-muted">
                    <td className="px-2 py-1"><button type="button" className="text-primary underline" aria-label={`Select ${patient.patientId}`} onClick={()=>{onSelect(patient);setOpen(false);}}>Select</button></td>
                    <td className="px-2 py-1">{(page-1)*20+index+1}</td><td className="px-2 py-1 whitespace-nowrap">{patient.patientId}</td>
                    <td className="px-2 py-1 break-words">{patient.fullName}</td><td className="px-2 py-1">{patient.age!==undefined ? patient.age+" years" : formatAgeYearsMonthsDays(patient.dateOfBirth)}</td>
                    <td className="px-2 py-1">{formatGender(patient.gender)}</td><td className="px-2 py-1 whitespace-nowrap">{patient.mobile}</td><td className="px-2 py-1 whitespace-nowrap">{formatDate(patient.createdAt)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            {(searchQuery.data?.pagination.totalPages??1)>1 && <div className="flex items-center justify-end gap-2 p-1"><Button type="button" variant="outline" disabled={page<=1||searchQuery.isFetching} onClick={()=>setPage(page-1)}>Previous</Button><span className="text-xs">{page} / {searchQuery.data?.pagination.totalPages}</span><Button type="button" variant="outline" disabled={page>=(searchQuery.data?.pagination.totalPages??1)||searchQuery.isFetching} onClick={()=>setPage(page+1)}>Next</Button></div>}
          </section>, document.getElementById("osp-patient-results")!
        )}
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Register New Patient"
        description="New patients automatically receive their Patient ID"
        size="lg"
      >
        <PatientForm
          mode="create"
          submitting={createMutation.isPending}
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
        />
        {createMutation.isPending && (
          <Loader2 className="mx-auto mt-2 size-4 animate-spin text-muted-foreground" />
        )}
      </Dialog>
    </>
  );
}
