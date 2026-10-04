"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { GENDERS, BLOOD_GROUPS } from "@/types/patient";
import {
  patientFormSchema,
  toFormValues,
  type PatientFormValues,
} from "@/validations/patient";

interface PatientFormProps {
  mode: "create" | "edit";
  defaultValues?: PatientFormValues | null;
  submitting: boolean;
  submitLabel?: string;
  onSubmit: (values: PatientFormValues) => Promise<void>;
  onCancel?: () => void;
}

interface FieldErrorProps {
  message?: string;
}

function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function FormField({ label, htmlFor, required, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

const baseControlClass = "h-8";

export function PatientForm({
  mode,
  defaultValues,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: PatientFormProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: toFormValues(defaultValues),
  });

  const submitHandler = async (values: PatientFormValues) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Failed to save patient. Please try again.",
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} noValidate className="space-y-3">
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardContent className="p-3 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Personal Information
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                label="First Name"
                htmlFor="firstName"
                required
                error={errors.firstName?.message}
              >
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  placeholder="First name"
                  className={baseControlClass}
                  aria-invalid={Boolean(errors.firstName)}
                  {...register("firstName")}
                />
              </FormField>

              <FormField
                label="Last Name"
                htmlFor="lastName"
                error={errors.lastName?.message}
              >
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  placeholder="Last name"
                  className={baseControlClass}
                  aria-invalid={Boolean(errors.lastName)}
                  {...register("lastName")}
                />
              </FormField>

              <FormField
                label="Gender"
                htmlFor="gender"
                required
                error={errors.gender?.message}
              >
                <Select
                  id="gender"
                  aria-invalid={Boolean(errors.gender)}
                  {...register("gender")}
                >
                  {GENDERS.map((gender) => (
                    <option key={gender} value={gender}>
                      {gender.charAt(0).toUpperCase() + gender.slice(1)}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label="Date of Birth"
                htmlFor="dateOfBirth"
                error={errors.dateOfBirth?.message}
              >
                <Input
                  id="dateOfBirth"
                  type="date"
                  className={baseControlClass}
                  aria-invalid={Boolean(errors.dateOfBirth)}
                  {...register("dateOfBirth")}
                />
              </FormField>

              <FormField
                label="Age"
                htmlFor="age"
                error={errors.age?.message}
              >
                <Input
                  id="age"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={150}
                  placeholder="Years"
                  className={baseControlClass}
                  aria-invalid={Boolean(errors.age)}
                  {...register("age", { valueAsNumber: true })}
                />
              </FormField>

              <FormField
                label="Blood Group"
                htmlFor="bloodGroup"
                error={errors.bloodGroup?.message}
              >
                <Select
                  id="bloodGroup"
                  aria-invalid={Boolean(errors.bloodGroup)}
                  {...register("bloodGroup")}
                >
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.filter((group) => group !== "Unknown").map(
                    (group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ),
                  )}
                </Select>
              </FormField>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Contact Information
              </h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  label="Mobile Number"
                  htmlFor="mobile"
                  required
                  error={errors.mobile?.message}
                >
                  <Input
                    id="mobile"
                    inputMode="numeric"
                    placeholder="10-digit mobile"
                    className={baseControlClass}
                    aria-invalid={Boolean(errors.mobile)}
                    {...register("mobile")}
                  />
                </FormField>

                <FormField
                  label="Email"
                  htmlFor="email"
                  error={errors.email?.message}
                >
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email address"
                    className={baseControlClass}
                    aria-invalid={Boolean(errors.email)}
                    {...register("email")}
                  />
                </FormField>

                <FormField
                  label="Emergency Contact"
                  htmlFor="emergencyContact"
                  error={errors.emergencyContact?.message}
                >
                  <Input
                    id="emergencyContact"
                    inputMode="numeric"
                    placeholder="10-digit mobile"
                    className={baseControlClass}
                    aria-invalid={Boolean(errors.emergencyContact)}
                    {...register("emergencyContact")}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-3 space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">Address</h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  label="Address"
                  htmlFor="address"
                  error={errors.address?.message}
                >
                  <Input
                    id="address"
                    placeholder="Street, house no., area"
                    className={baseControlClass}
                    aria-invalid={Boolean(errors.address)}
                    {...register("address")}
                  />
                </FormField>

                <FormField
                  label="City"
                  htmlFor="city"
                  error={errors.city?.message}
                >
                  <Input
                    id="city"
                    placeholder="City"
                    className={baseControlClass}
                    aria-invalid={Boolean(errors.city)}
                    {...register("city")}
                  />
                </FormField>

                <FormField
                  label="State"
                  htmlFor="state"
                  error={errors.state?.message}
                >
                  <Input
                    id="state"
                    placeholder="State"
                    className={baseControlClass}
                    aria-invalid={Boolean(errors.state)}
                    {...register("state")}
                  />
                </FormField>

                <FormField
                  label="Pincode"
                  htmlFor="pincode"
                  error={errors.pincode?.message}
                >
                  <Input
                    id="pincode"
                    inputMode="numeric"
                    placeholder="6-digit pincode"
                    className={baseControlClass}
                    aria-invalid={Boolean(errors.pincode)}
                    {...register("pincode")}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {mode === "edit" && (
            <Card className="border-border shadow-sm">
              <CardContent className="p-3 space-y-3">
                <h2 className="text-sm font-semibold text-slate-800">Status</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    label="Patient Status"
                    htmlFor="status"
                    error={errors.status?.message}
                  >
                    <Select
                      id="status"
                      aria-invalid={Boolean(errors.status)}
                      {...register("status")}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </Select>
                  </FormField>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitLabel ?? (mode === "create" ? "Create Patient" : "Save Changes")}
        </Button>
      </div>
    </form>
  );
}