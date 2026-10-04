"use client";

import { useRef } from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ReferringDoctorField } from "@/components/billing/referring-doctor-field";
import {
  GENDER_OPTIONS,
  PATIENT_TITLES,
  resolveGenderForTitleChange,
  type DisplayGender,
  type PatientTitle,
} from "@/lib/patient-title";
import { cn } from "@/lib/utils";
import type { Doctor } from "@/types/billing";

export type { PatientTitle };

export interface PatientDetails {
  title: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  ageYears: string;
  ageMonths: string;
  ageDays: string;
  mobile: string;
  email: string;
  address: string;
}

export function emptyPatientDetails(): PatientDetails {
  return {
    title: "--Select--",
    name: "",
    dateOfBirth: "",
    gender: "",
    ageYears: "",
    ageMonths: "",
    ageDays: "",
    mobile: "",
    email: "",
    address: "",
  };
}

export interface BirthAge {
  years: number;
  months: number;
  days: number;
}

export function birthAgeFromDob(value: string | Date): BirthAge {
  const dob = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(dob.getTime())) return { years: 0, months: 0, days: 0 };
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) {
    years = 0;
    months = 0;
    days = 0;
  }
  return { years, months, days };
}

const labelClass =
  "w-[150px] shrink-0 truncate text-xs font-medium text-slate-600";

const inputHeight = "h-8";

interface FieldErrorProps {
  message?: string;
}

function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <span className="w-full text-xs font-normal text-destructive" role="alert">
      {message}
    </span>
  );
}

function sanitizeAgeInput(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(0, 3);
}

interface CellProps {
  label: string;
  align?: "center" | "top";
  className?: string;
  error?: string;
  children: React.ReactNode;
}

function Cell({ label, align = "center", className, error, children }: CellProps) {
  return (
    <div
      className={cn(
        "flex min-h-[40px] items-center gap-2 border-b border-border/60 px-3 py-1",
        align === "top" && "items-start",
        className,
      )}
    >
      <span className={labelClass}>{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {children}
        {error && <FieldError message={error} />}
      </div>
    </div>
  );
}

interface RowProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

function Row({ left, right }: RowProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2">
      {left}
      {right}
    </div>
  );
}

export function OspPatientDetails({
  value,
  onChange,
  doctor,
  onDoctorSelect,
  nameError,
  genderError,
  mobileError,
  emailError,
  dobError,
}: OspPatientDetailsProps) {
  const dobRef = useRef<HTMLInputElement>(null);
  /**
   * The gender currently shown because a title implied it. Anything the
   * operator typed by hand is left alone when the title stops implying one, but
   * an implied value is always refreshed so a stale value can never survive a
   * title change.
   */
  const impliedGenderRef = useRef<Exclude<DisplayGender, ""> | null>(null);

  const set = (patch: Partial<PatientDetails>) =>
    onChange({ ...value, ...patch });

  const handleTitleChange = (title: string) => {
    const resolved = resolveGenderForTitleChange({
      title,
      currentGender: value.gender,
      impliedGender: impliedGenderRef.current,
    });
    impliedGenderRef.current = resolved.impliedGender;
    onChange({ ...value, title, gender: resolved.gender });
  };

  const handleGenderChange = (gender: string) => {
    // A manual choice wins over the title until the title changes again.
    impliedGenderRef.current = null;
    onChange({ ...value, gender });
  };

  const handleDobChange = (dateOfBirth: string) => {
    let next: PatientDetails = { ...value, dateOfBirth };
    if (dateOfBirth) {
      const { years, months, days } = birthAgeFromDob(dateOfBirth);
      next = {
        ...next,
        ageYears: String(years),
        ageMonths: String(months),
        ageDays: String(days),
      };
    } else {
      next = { ...next, ageYears: "", ageMonths: "", ageDays: "" };
    }
    onChange(next);
  };

  const openDobPicker = () => {
    const input = dobRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  const leftColumnClass = "lg:border-r lg:border-border/60";
  const lastRowClass = "border-b-0";

  return (
    <div className="rounded-md border border-border/80 bg-white">
      <Row
        left={
          <Cell label="Name" error={nameError} className={leftColumnClass}>
            <Select
              aria-label="Title"
              value={value.title}
              onChange={(event) => handleTitleChange(event.target.value)}
              className={cn(inputHeight, "w-[135px]")}
            >
              {PATIENT_TITLES.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Patient name"
              placeholder="Patient name"
              value={value.name}
              onChange={(event) => set({ name: event.target.value })}
              maxLength={60}
              aria-invalid={Boolean(nameError)}
              className={cn(inputHeight, "min-w-0 flex-1")}
            />
          </Cell>
        }
        right={
          <Cell label="DOB" error={dobError} align="top">
            <Input
              ref={dobRef}
              aria-label="Date of birth"
              type="date"
              placeholder="dd-mm-yyyy"
              value={value.dateOfBirth}
              onChange={(event) => handleDobChange(event.target.value)}
              aria-invalid={Boolean(dobError)}
              className={cn(inputHeight, "min-w-0 flex-1")}
            />
            <button
              type="button"
              onClick={openDobPicker}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-slate-500 transition-colors hover:bg-muted"
              title="Open calendar"
              aria-label="Open calendar"
            >
              <Calendar className="size-3.5" />
            </button>
          </Cell>
        }
      />
      <Row
        left={
          <Cell label="Gender" error={genderError} className={leftColumnClass}>
            <Select
              aria-label="Gender"
              value={value.gender}
              onChange={(event) => handleGenderChange(event.target.value)}
              aria-invalid={Boolean(genderError)}
              className={cn(inputHeight, "min-w-0 flex-1")}
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option || "unset"} value={option}>
                  {option === "" ? "--Select--" : option}
                </option>
              ))}
            </Select>
          </Cell>
        }
        right={
          <Cell label="Age">
            <Input
              aria-label="Age years"
              type="number"
              inputMode="numeric"
              min={0}
              max={150}
              placeholder="0"
              value={value.ageYears}
              onChange={(event) =>
                set({ ageYears: sanitizeAgeInput(event.target.value) })
              }
              className={cn(inputHeight, "w-24")}
            />
            <span className="text-xs font-medium text-slate-600">Y</span>
            <Input
              aria-label="Age months"
              type="number"
              inputMode="numeric"
              min={0}
              max={11}
              placeholder="0"
              value={value.ageMonths}
              onChange={(event) =>
                set({ ageMonths: sanitizeAgeInput(event.target.value) })
              }
              className={cn(inputHeight, "w-24")}
            />
            <span className="text-xs font-medium text-slate-600">M</span>
            <Input
              aria-label="Age days"
              type="number"
              inputMode="numeric"
              min={0}
              max={30}
              placeholder="0"
              value={value.ageDays}
              onChange={(event) =>
                set({ ageDays: sanitizeAgeInput(event.target.value) })
              }
              className={cn(inputHeight, "w-24")}
            />
            <span className="text-xs font-medium text-slate-600">D</span>
          </Cell>
        }
      />
      <Row
        left={
          <Cell label="MobileNo" error={mobileError} className={leftColumnClass}>
            <Input
              aria-label="Mobile number"
              inputMode="numeric"
              placeholder="10-digit mobile"
              value={value.mobile}
              onChange={(event) =>
                set({ mobile: event.target.value.replace(/[^0-9]/g, "").slice(0, 12) })
              }
              aria-invalid={Boolean(mobileError)}
              className={cn(inputHeight, "min-w-0 flex-1")}
            />
          </Cell>
        }
        right={
          <Cell label="Email-Id" error={emailError}>
            <Input
              aria-label="Email id"
              type="email"
              placeholder="Email address"
              value={value.email}
              onChange={(event) => set({ email: event.target.value })}
              aria-invalid={Boolean(emailError)}
              className={cn(inputHeight, "min-w-0 flex-1")}
            />
          </Cell>
        }
      />
      <Row
        left={
          <Cell
            label="Refer by"
            className={cn(leftColumnClass, lastRowClass)}
          >
            <div className="min-w-0 flex-1">
              <ReferringDoctorField doctor={doctor} onSelect={onDoctorSelect} />
            </div>
          </Cell>
        }
        right={
          <Cell label="Address" align="top" className={lastRowClass}>
            <Textarea
              aria-label="Address"
              rows={2}
              maxLength={45}
              placeholder="Address"
              value={value.address}
              onChange={(event) => set({ address: event.target.value })}
              className="h-[60px] min-w-0 flex-1 resize-none"
            />
            <span className="shrink-0 self-start pt-1 text-xs text-muted-foreground">
              (Max:45)
            </span>
          </Cell>
        }
      />
    </div>
  );
}

interface OspPatientDetailsProps {
  value: PatientDetails;
  onChange: (next: PatientDetails) => void;
  doctor: Doctor | null;
  onDoctorSelect: (doctor: Doctor | null) => void;
  nameError?: string;
  genderError?: string;
  mobileError?: string;
  emailError?: string;
  dobError?: string;
}