"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  FlaskConical,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PatientForm } from "@/components/patients/patient-form";
import { fetchPatient, updatePatient } from "@/services/patients";
import {
  formatGender,
  formatDate,
  getInitials,
  toDateInputValue,
} from "@/lib/utils";
import type { Patient } from "@/types/patient";
import type { PatientFormValues } from "@/validations/patient";

interface PatientProfileProps {
  patientId: string;
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-slate-700">
        {value || "—"}
      </span>
    </div>
  );
}

function toProfileFormValues(patient: Patient): PatientFormValues {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName ?? "",
    gender: patient.gender,
    dateOfBirth: toDateInputValue(patient.dateOfBirth),
    age: patient.age,
    mobile: patient.mobile,
    email: patient.email ?? "",
    address: patient.address ?? "",
    city: patient.city ?? "",
    state: patient.state ?? "",
    pincode: patient.pincode ?? "",
    emergencyContact: patient.emergencyContact ?? "",
    bloodGroup: patient.bloodGroup ?? "",
    status: patient.status,
  };
}

const FUTURE_SECTIONS = [
  { label: "Visits", icon: Activity },
  { label: "Bills", icon: FlaskConical },
  { label: "Tests", icon: FlaskConical },
  { label: "Samples", icon: FlaskConical },
  { label: "Results", icon: FlaskConical },
  { label: "Reports", icon: FlaskConical },
];

export function PatientProfile({ patientId }: PatientProfileProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const patientQuery = useQuery({
    queryKey: ["patients", "detail", patientId],
    queryFn: () => fetchPatient(patientId),
  });

  const updateMutation = useMutation({
    mutationFn: (values: PatientFormValues) =>
      updatePatient(patientId, values),
    onSuccess: (patient) => {
      queryClient.setQueryData(
        ["patients", "detail", patientId],
        patient,
      );
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      // A name/age/gender edit changes what the dashboard's recent-patients
      // panel shows, so that cache is invalidated too.
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(false);
    },
  });

  if (patientQuery.isLoading) {
    return <LoadingState label="Loading patient..." />;
  }

  if (patientQuery.error) {
    const message = patientQuery.error.message;
    const notFound = message.toLowerCase().includes("not found");
    if (notFound) {
      return (
        <div className="space-y-3 py-5">
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>Patient not found.</span>
          </div>
          <Button variant="outline" asChild>
            <Link href="/patients">Back to Patients</Link>
          </Button>
        </div>
      );
    }
    return (
      <ErrorState
        message={message || "Failed to load patient. Please try again."}
        onRetry={() => void patientQuery.refetch()}
      />
    );
  }

  const patient = patientQuery.data;
  if (!patient) {
    return null;
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-heading text-base font-medium text-slate-800">
              Edit {patient.fullName}
            </h1>
            <p className="text-xs text-muted-foreground">
              Patient ID {patient.patientId} cannot be changed
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
            Close
          </Button>
        </header>

        <PatientForm
          mode="edit"
          defaultValues={toProfileFormValues(patient)}
          submitting={updateMutation.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await updateMutation.mutateAsync(values);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/patients"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to Patients
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
        >
          Edit Profile
        </Button>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {getInitials(patient.fullName)}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-lg font-medium text-slate-900">
              {patient.fullName}
            </h1>
            <Badge variant="secondary">{patient.patientId}</Badge>
            <Badge variant={patient.status === "active" ? "outline" : "destructive"}>
              {patient.status === "active" ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatGender(patient.gender)}
            {patient.age !== undefined && ` · ${patient.age} yrs`}
            {patient.bloodGroup && ` · Blood group ${patient.bloodGroup}`}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border shadow-sm">
          <CardHeader className="flex-row items-center gap-2 border-b border-border py-2">
            <UserRound className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-slate-800">
              Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 divide-y divide-border/60">
            <DetailRow label="Gender" value={formatGender(patient.gender)} />
            <DetailRow
              label="Date of Birth"
              value={
                patient.dateOfBirth ? formatDate(patient.dateOfBirth) : undefined
              }
            />
            <DetailRow
              label="Age"
              value={patient.age !== undefined ? `${patient.age} years` : undefined}
            />
            <DetailRow label="Blood Group" value={patient.bloodGroup} />
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex-row items-center gap-2 border-b border-border py-2">
            <Activity className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-slate-800">
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 divide-y divide-border/60">
            <DetailRow label="Mobile" value={patient.mobile} />
            <DetailRow label="Email" value={patient.email} />
            <DetailRow
              label="Emergency Contact"
              value={patient.emergencyContact}
            />
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex-row items-center gap-2 border-b border-border py-2">
            <UserRound className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-slate-800">
              Address
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 divide-y divide-border/60">
            <DetailRow label="Address" value={patient.address} />
            <DetailRow label="City" value={patient.city} />
            <DetailRow label="State" value={patient.state} />
            <DetailRow label="Pincode" value={patient.pincode} />
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm md:col-span-2 xl:col-span-3">
          <CardHeader className="flex-row items-center gap-2 border-b border-border py-2">
            <FlaskConical className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-slate-800">
              Registration
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-0 divide-y divide-border/60 p-3 sm:grid-cols-3 sm:gap-x-4 sm:divide-y-0">
            <DetailRow label="Patient ID" value={patient.patientId} />
            <DetailRow
              label="Registered On"
              value={patient.createdAt ? formatDate(patient.createdAt) : undefined}
            />
            <DetailRow
              label="Last Updated"
              value={patient.updatedAt ? formatDate(patient.updatedAt) : undefined}
            />
          </CardContent>
        </Card>
      </section>

      <section aria-label="Coming soon">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Coming Soon
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {FUTURE_SECTIONS.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/30 py-3 text-center"
            >
              <Icon className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-xs font-medium text-muted-foreground">
                {label}
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}