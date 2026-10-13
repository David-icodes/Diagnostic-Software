"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { PatientForm } from "@/components/patients/patient-form";
import { createPatient } from "@/services/patients";
import { invalidateRoots, queryKeys } from "@/lib/query-keys";
import type { PatientFormValues } from "@/validations/patient";

export function NewPatientContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [registered, setRegistered] = useState(false);
  const createMutation = useMutation({
    mutationFn: (values: PatientFormValues) => createPatient(values),
    onSuccess: () => {
      void invalidateRoots(queryClient, queryKeys.patients, queryKeys.dashboard);
      setRegistered(true);
    },
  });
  const handleSubmit = async (values: PatientFormValues) => {
    setRegistered(false);
    await createMutation.mutateAsync(values);
  };

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-base font-medium text-slate-800">
            <UserPlus className="size-5 text-primary" />
            Register New Patient
          </h1>
          <p className="text-xs text-muted-foreground">
            The Patient ID is generated automatically when you save
          </p>
        </div>
        <Link
          href="/patients"
          className="text-sm font-medium text-primary hover:underline"
        >
          Back to Patients
        </Link>
      </header>

      {registered && <p role="status" className="text-sm text-emerald-700">Patient registered successfully</p>}

      <PatientForm
        key={createMutation.data?.id ?? "new-registration"}
        mode="create"
        submitting={createMutation.isPending}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/patients")}
      />

    </div>
  );
}
