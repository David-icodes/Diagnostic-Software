"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, UserPlus } from "lucide-react";
import { PatientForm } from "@/components/patients/patient-form";
import { ConfirmDialog } from "@/components/database/confirm-dialog";
import { ApiError } from "@/lib/api";
import { createPatient } from "@/services/patients";
import { invalidateRoots, queryKeys } from "@/lib/query-keys";
import type { PatientFormValues } from "@/validations/patient";

interface ExistingPatient {
  id: string;
  patientId: string;
  fullName: string;
}

function existingPatientFrom(error: unknown): ExistingPatient | null {
  if (
    !(error instanceof ApiError) ||
    error.status !== 409 ||
    !error.details ||
    typeof error.details !== "object" ||
    !("existingPatient" in error.details)
  ) {
    return null;
  }
  return (
    (error.details as { existingPatient?: ExistingPatient }).existingPatient ?? null
  );
}

export function NewPatientContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [duplicatePatient, setDuplicatePatient] = useState<ExistingPatient | null>(
    null,
  );
  const [pendingValues, setPendingValues] = useState<PatientFormValues | null>(
    null,
  );
  const [separateError, setSeparateError] = useState<string | null>(null);

  const afterCreate = (patient: { patientId: string }) => {
    // The registry and the dashboard's recent-patients panel must both pick up
    // the new registration.
    void invalidateRoots(queryClient, queryKeys.patients, queryKeys.dashboard);
    router.push(`/patients/${patient.patientId}`);
  };

  const createMutation = useMutation({
    mutationFn: ({
      values,
      allowDuplicateMobile = false,
    }: {
      values: PatientFormValues;
      allowDuplicateMobile?: boolean;
    }) => createPatient(values, { allowDuplicateMobile }),
    onSuccess: afterCreate,
  });

  const handleSubmit = async (values: PatientFormValues) => {
    setSeparateError(null);
    try {
      await createMutation.mutateAsync({ values });
    } catch (error) {
      const existing = existingPatientFrom(error);
      if (existing) {
        setDuplicatePatient(existing);
        setPendingValues(values);
      }
      // PatientForm renders the message; the dialog carries the choice.
      throw error;
    }
  };

  // The registration already exists, so open that record instead of storing the
  // same person twice.
  const useExistingPatient = () => {
    if (!duplicatePatient) return;
    const { patientId } = duplicatePatient;
    setDuplicatePatient(null);
    setPendingValues(null);
    router.push(`/patients/${patientId}`);
  };

  // The operator confirmed this is a different person who shares the number.
  const createSeparatePatient = async () => {
    if (!pendingValues) return;
    const values = pendingValues;
    setDuplicatePatient(null);
    setPendingValues(null);
    setSeparateError(null);
    try {
      await createMutation.mutateAsync({ values, allowDuplicateMobile: true });
    } catch (error) {
      setSeparateError(
        error instanceof Error
          ? error.message
          : "Failed to register the patient. Please try again.",
      );
    }
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

      {separateError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{separateError}</span>
        </div>
      )}

      <PatientForm
        mode="create"
        submitting={createMutation.isPending}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/patients")}
      />

      <ConfirmDialog
        open={duplicatePatient !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDuplicatePatient(null);
            setPendingValues(null);
          }
        }}
        title="Patient already registered"
        description={
          duplicatePatient
            ? `${duplicatePatient.fullName} (${duplicatePatient.patientId}) is already registered with this mobile number. Open that record so the patient keeps one identity across bills, or register this as a separate person.`
            : undefined
        }
        confirmLabel="Open Existing Patient"
        secondaryLabel="Create Separate Patient"
        onSecondary={() => void createSeparatePatient()}
        cancelLabel="Cancel"
        loading={createMutation.isPending}
        onConfirm={useExistingPatient}
      />
    </div>
  );
}