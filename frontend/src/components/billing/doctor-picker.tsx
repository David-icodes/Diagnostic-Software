"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Search, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/common/empty-state";
import { createDoctor, fetchDoctors } from "@/services/billing";
import type { Doctor } from "@/types/billing";

interface DoctorPickerProps {
  selected: Doctor | null;
  onSelect: (doctor: Doctor | null) => void;
}

export function DoctorPicker({ selected, onSelect }: DoctorPickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "new">("search");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [qualification, setQualification] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormError(null);
    setOpen(true);
  };

  const searchQuery = useQuery({
    queryKey: ["doctors", "billing-search", search],
    queryFn: () => fetchDoctors({ search }),
    enabled: open && mode === "search",
    placeholderData: (previous) => previous,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createDoctor({
        name: name.trim(),
        qualification: qualification.trim() || undefined,
        specialization: specialization.trim() || undefined,
      }),
    onSuccess: (doctor) => {
      onSelect(doctor);
      resetNewForm();
      setOpen(false);
    },
  });

  const resetNewForm = () => {
    setName("");
    setQualification("");
    setSpecialization("");
  };

  const rows = searchQuery.data ?? [];

  const handleCreate = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Doctor name is required");
      return;
    }
    try {
      await createMutation.mutateAsync();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to add doctor",
      );
    }
  };

  return (
    <>
      <Card className="border-border shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Stethoscope className="size-3.5" />
                Referring Doctor
              </p>
              {selected ? (
                <>
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {selected.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      selected.qualification,
                      selected.specialization,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No additional details"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Optional — select a referring doctor
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5">
              {selected && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelect(null)}
                >
                  Clear
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpen}
              >
                {selected ? "Change" : "Select Doctor"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Referring Doctor"
        description="Search the doctor list or add a new doctor"
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
              Search Doctors
            </Button>
            <Button
              type="button"
              variant={mode === "new" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("new")}
            >
              <Plus />
              Add New Doctor
            </Button>
          </div>

          {mode === "search" ? (
            <div className="space-y-3">
              <Input
                type="search"
                placeholder="Search by name or specialization..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="h-8"
                autoFocus
                aria-label="Search doctors"
              />
              {searchQuery.isLoading ? (
                <div className="flex flex-col gap-1.5" aria-busy>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-8 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <EmptyState
                  message={
                    search ? "No doctors match your search" : "No doctors yet"
                  }
                />
              ) : (
                <ul className="divide-y divide-border/70 rounded-lg border border-border">
                  {rows.map((doctor) => (
                    <li key={doctor.id}>
                      <button
                        type="button"
                          className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
                          onClick={() => {
                            onSelect(doctor);
                            setOpen(false);
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-slate-800">
                              {doctor.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {[doctor.qualification, doctor.specialization]
                                .filter(Boolean)
                                .join(" · ") || "—"}
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
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="doctorName">
                  Doctor Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="doctorName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}

                  className="h-8"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="qualification">Qualification</Label>
                  <Input
                    id="qualification"
                    value={qualification}
                    onChange={(event) => setQualification(event.target.value)}

                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input
                    id="specialization"
                    value={specialization}
                    onChange={(event) => setSpecialization(event.target.value)}

                    className="h-8"
                  />
                </div>
              </div>
              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <Button
                type="button"
                onClick={() => void handleCreate()}
                disabled={createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Add Doctor & Select
              </Button>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
