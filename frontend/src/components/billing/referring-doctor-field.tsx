"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Stethoscope, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/common/empty-state";
import { createDoctor, fetchDoctors } from "@/services/billing";
import type { Doctor } from "@/types/billing";

interface ReferringDoctorFieldProps {
  doctor: Doctor | null;
  onSelect: (doctor: Doctor | null) => void;
}

export function ReferringDoctorField({
  doctor,
  onSelect,
}: ReferringDoctorFieldProps) {
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [qualification, setQualification] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const blurTimer = useRef<number | null>(null);
  const searchTimer = useRef<number | null>(null);

  const searchQuery = useQuery({
    queryKey: ["doctors", "referring-field", search],
    queryFn: () => fetchDoctors({ search: search || undefined }),
    enabled: open || editing,
    placeholderData: (previous) => previous,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createDoctor({
        name: name.trim(),
        qualification: qualification.trim() || undefined,
        specialization: specialization.trim() || undefined,
      }),
    onSuccess: (created) => {
      onSelect(created);
      setTyped(created.name);
      setEditing(false);
      setAddOpen(false);
      setName("");
      setQualification("");
      setSpecialization("");
      setFormError(null);
    },
  });

  const handleQueryChange = (raw: string) => {
    setEditing(true);
    setOpen(true);
    setTyped(raw);
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current);
    }
    searchTimer.current = window.setTimeout(() => {
      setSearch(raw.trim());
    }, 300);
  };

  const handleAdd = async () => {
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

  const rows = searchQuery.data ?? [];

  const showAdd = () => {
    setOpen(false);
    setAddOpen(true);
  };

  return (
    <>
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              aria-label="Referring doctor"
              placeholder="Doctor.."
              value={editing || !doctor ? typed : doctor.name}
              onFocus={() => {
                setEditing(true);
                if (searchTimer.current !== null) {
                  window.clearTimeout(searchTimer.current);
                }
                setOpen(true);
              }}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  if (blurTimer.current !== null) {
                    window.clearTimeout(blurTimer.current);
                  }
                  if (!search.trim()) {
                    setSearch(typed.trim());
                    return;
                  }
                }
              }}
              className="h-8 w-full"
            />
            {doctor && !editing && (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  setTyped("");
                  setEditing(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-slate-700"
                title="Clear doctor"
                aria-label="Clear referring doctor"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={showAdd}
            className="h-8 w-9 shrink-0 px-0"
            title="Add new doctor"
            aria-label="Add new doctor"
          >
            <Plus />
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
            <div className="absolute left-0 top-[calc(100%+4px)] z-30 w-[320px] overflow-hidden rounded-lg border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <Stethoscope className="size-3.5" />
                  Doctor List
                </p>
                {doctor && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      onSelect(null);
                      setOpen(false);
                      setTyped("");
                      setEditing(false);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {searchQuery.isLoading ? (
                  <div className="flex flex-col gap-1.5 p-2" aria-busy>
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-8 animate-pulse rounded bg-muted"
                      />
                    ))}
                  </div>
                ) : rows.length === 0 ? (
                  <EmptyState
                    message={
                      search ? "No doctors match your search" : "No doctors yet"
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border/70">
                    {rows.map((candidate) => (
                      <li key={candidate.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors hover:bg-muted"
                          onMouseDown={() => {
                            if (blurTimer.current !== null) {
                              window.clearTimeout(blurTimer.current);
                            }
                            onSelect(candidate);
                            setOpen(false);
                            setEditing(false);
                            setTyped(candidate.name);
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-slate-800">
                              {candidate.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {[candidate.qualification, candidate.specialization]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </span>
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
        title="Add New Doctor"
        description="Register a referring doctor for this bill"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="referringDoctorName">
              Doctor Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="referringDoctorName"
              value={name}
              onChange={(event) => setName(event.target.value)}

              className="h-8"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="referringQualification">Qualification</Label>
              <Input
                id="referringQualification"
                value={qualification}
                onChange={(event) => setQualification(event.target.value)}

                className="h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="referringSpecialization">Specialization</Label>
              <Input
                id="referringSpecialization"
                value={specialization}
                onChange={(event) => setSpecialization(event.target.value)}

                className="h-8"
              />
            </div>
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <Button
            type="button"
            onClick={() => void handleAdd()}
            disabled={createMutation.isPending}
            className="w-full"
          >
            {createMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Add Doctor & Select
          </Button>
        </div>
      </Dialog>
    </>
  );
}
