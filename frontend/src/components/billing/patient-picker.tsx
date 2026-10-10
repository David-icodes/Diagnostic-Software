"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

interface PatientPickerProps {
  selected: Patient | null;
  onSelect: (patient: Patient) => void;
}

export function PatientPicker({ selected, onSelect }: PatientPickerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "register">("search");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      if (searchInput.trim()) setMode("search");
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const handleOpen = () => {
    setMode("search");
    setSearchInput("");
    setSearch("");
    setOpen(true);
  };

  const searchQuery = useQuery({
    queryKey: ["patients", "billing-search", search],
    queryFn: () => fetchPatients({ search, limit: 12 }),
    enabled: open && mode === "search",
    placeholderData: (previous) => previous,
  });

  const createMutation = useMutation({
    mutationFn: (values: PatientFormValues) => createPatient(values),
    onSuccess: (patient) => {
      // The new record must appear in the registry, in any open search and on the
      // dashboard's recent-patients panel.
      void invalidateRoots(queryClient, queryKeys.patients, queryKeys.dashboard);
      onSelect(patient);
      setOpen(false);
    },
  });

  const rows = searchQuery.data?.data ?? [];

  return (
    <>
      <Card className="border-border shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <UserRound className="size-3.5" />
                Patient
                {!selected && <span className="text-destructive">*</span>}
              </p>
              {selected ? (
                <>
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {selected.fullName}
                    <Badge variant="secondary" className="ml-2">
                      {selected.patientId}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatGender(selected.gender)}
                    {selected.age !== undefined
                      ? ` · ${selected.age} yrs`
                      : selected.dateOfBirth
                        ? ` · ${formatAgeYearsMonthsDays(selected.dateOfBirth)}`
                        : ""}
                    {` · ${selected.mobile}`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No patient selected for this bill
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpen}
            >
              {selected ? "Change" : "Select Patient"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Select Patient"
        description="Search the registry or register a new patient"
        size="lg"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={mode === "search" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("search")}
            >
              <Search />
              Search Registry
            </Button>
            <Button
              type="button"
              variant={mode === "register" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("register")}
            >
              <UserPlus />
              Register New Patient
            </Button>
          </div>

          {mode === "search" ? (
            <div className="space-y-3">
              <Input
                type="search"
                placeholder="Search by name, mobile or patient ID..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="h-8"
                autoFocus
                aria-label="Search patients"
              />
              {searchQuery.isLoading ? (
                <div className="flex flex-col gap-1.5" aria-busy>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-8 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <EmptyState
                  message={
                    search
                      ? "No patients match your search"
                      : "Type to search the registry"
                  }
                />
              ) : (
                <ul className="divide-y divide-border/70 rounded-lg border border-border">
                  {rows.map((patient) => (
                    <li key={patient.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
                        onClick={() => {
                          onSelect(patient);
                          setOpen(false);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-slate-800">
                            {patient.fullName}
                            <Badge variant="outline" className="ml-2">
                              {patient.patientId}
                            </Badge>
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {formatGender(patient.gender)}
                            {patient.age !== undefined
                              ? ` · ${patient.age} yrs`
                              : ""}
                            {` · ${patient.mobile}`}
                            {patient.city ? ` · ${patient.city}` : ""}
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
          ) : (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5" />
                New patients automatically receive their Patient ID.
              </p>
              <PatientForm
                mode="create"
                submitting={createMutation.isPending}
                onSubmit={async (values) => {
                  await createMutation.mutateAsync(values);
                }}
              />
            </div>
          )}

          {createMutation.isPending && (
            <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </Dialog>
    </>
  );
}