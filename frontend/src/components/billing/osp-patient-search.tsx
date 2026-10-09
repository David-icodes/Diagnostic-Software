"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { PatientForm } from "@/components/patients/patient-form";
import { createPatient, fetchPatients } from "@/services/patients";
import { formatAgeYearsMonthsDays, formatGender } from "@/lib/utils";
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
  const blurTimer = useRef<number | null>(null);
  const searchTimer = useRef<number | null>(null);

  const searchQuery = useQuery({
    queryKey: ["patients", "osp-search", search],
    queryFn: () => fetchPatients({ search: search || undefined, limit: 12 }),
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

  const runSearch = (raw: string) => {
    setOpen(true);
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current);
    }
    searchTimer.current = window.setTimeout(() => {
      setSearch(raw.trim());
    }, 350);
  };

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
              runSearch(event.target.value);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                if (blurTimer.current !== null) {
                  window.clearTimeout(blurTimer.current);
                }
                setSearch(query.trim());
              }
            }}
            className="h-8 min-w-0 flex-1 md:w-[266px] md:flex-none"
            aria-label="Search patient by name, patient ID or mobile"
          />
          <Button
            type="button"
            onClick={() => {
              if (blurTimer.current !== null) {
                window.clearTimeout(blurTimer.current);
              }
              setSearch(query.trim());
              setOpen(true);
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

        {open && (
          <>
            <div
              className="fixed inset-0 z-20"
              onMouseDown={() => {
                blurTimer.current = window.setTimeout(() => setOpen(false), 120);
              }}
            />
            <div role="dialog" aria-label="Select existing patient" className="absolute left-0 top-[calc(100%+4px)] z-30 w-[440px] max-w-[calc(100vw-100px)] overflow-hidden rounded-lg border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <Users className="size-3.5" />
                  Patient List
                </p>
                {selected && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-slate-700">
                      {selected.fullName.toUpperCase()}
                    </span>{" "}
                    ({selected.patientId})
                  </span>
                )}
              </div>
              <div className="max-h-[min(240px,44vh)] overflow-y-auto">
                {search && (searchQuery.isFetching || search !== query.trim()) ? (
                  <div className="flex flex-col gap-1.5 p-2" aria-busy>
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-8 animate-pulse rounded bg-muted"
                      />
                    ))}
                  </div>
                ) : !search || rows.length === 0 ? (
                  <EmptyState
                    message={
                      search
                        ? "No patients match your search"
                        : "Type to search the registry"
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border/70">
                    {rows.map((patient) => (
                      <li key={patient.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left transition-colors hover:bg-muted"
                          aria-pressed={selected?.id === patient.id}
                          disabled={searchQuery.isFetching}
                          onClick={() => {
                            if (blurTimer.current !== null) {
                              window.clearTimeout(blurTimer.current);
                            }
                            onSelect(patient);
                            if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
                            setOpen(false);
                            setQuery("");
                            setSearch("");
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-slate-800">
                              {patient.fullName.toUpperCase()}
                              <Badge variant="outline" className="ml-2">
                                {patient.patientId}
                              </Badge>
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {formatGender(patient.gender)}
                              {patient.age !== undefined
                                ? ` · ${patient.age} yrs`
                                : patient.dateOfBirth
                                  ? ` · ${formatAgeYearsMonthsDays(patient.dateOfBirth)}`
                                  : ""}
                              {` · ${patient.mobile}`}
                            </span>
                          </span>
                          <span className="text-[11px] font-medium text-primary">
                            Select
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
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
