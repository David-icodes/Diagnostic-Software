"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Power, Stethoscope } from "lucide-react";
import { ConfirmDialog } from "@/components/database/confirm-dialog";
import { DataTable } from "@/components/database/data-table";
import { FormActions } from "@/components/database/form-actions";
import { FormField } from "@/components/database/form-field";
import { FormSection } from "@/components/database/form-section";
import { PageHeader } from "@/components/database/page-header";
import { SearchInput } from "@/components/database/search-input";
import { StatusBadge } from "@/components/database/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createDoctor,
  fetchDatabaseDepartments,
  fetchDesignations,
  fetchDoctorsPaginated,
  fetchSpecialisations,
  getDatabaseOptions,
  setDoctorActive,
  updateDoctor,
} from "@/services/database";
import type { Doctor } from "@/types/database";

const PAGE_LIMIT = 20;

interface DoctorFormState {
  doctorType: string;
  employeeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  shortName: string;
  gender: string;
  email: string;
  phone: string;
  mobile: string;
  city: string;
  specialisationId: string;
  designationId: string;
  departmentId: string;
  onlineAppDisplay: string;
  address: string;
  roomNumber: string;
  opConsultationFee: string;
  ipConsultationFee: string;
  hospitalFee: string;
  erConsultationFee: string;
  maxFreeVisits: string;
  maxFreeDaysVisits: string;
  qualification: string;
}

const EMPTY_FORM: DoctorFormState = {
  doctorType: "",
  employeeId: "",
  firstName: "",
  middleName: "",
  lastName: "",
  shortName: "",
  gender: "",
  email: "",
  phone: "",
  mobile: "",
  city: "",
  specialisationId: "",
  designationId: "",
  departmentId: "",
  onlineAppDisplay: "Y",
  address: "",
  roomNumber: "",
  opConsultationFee: "",
  ipConsultationFee: "",
  hospitalFee: "",
  erConsultationFee: "",
  maxFreeVisits: "",
  maxFreeDaysVisits: "",
  qualification: "",
};

const toNumber = (value: string): number | undefined => {
  const parsed = Number(value);
  return value.trim() === "" || Number.isNaN(parsed) ? undefined : parsed;
};

export function DoctorCreateContent() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DoctorFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<Doctor | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  }>({});

  const optionsQuery = useQuery({
    queryKey: ["database-options"],
    queryFn: getDatabaseOptions,
  });

  const specialisationsQuery = useQuery({
    queryKey: ["doctor-specialisations", "all"],
    queryFn: () => fetchSpecialisations({ limit: 200 }),
  });

  const designationsQuery = useQuery({
    queryKey: ["doctor-designations", "all"],
    queryFn: () => fetchDesignations({ limit: 200 }),
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments", "database", "all"],
    queryFn: () => fetchDatabaseDepartments(),
  });

  const listQuery = useQuery({
    queryKey: ["doctors", "database", page, search],
    queryFn: () => fetchDoctorsPaginated({ page, limit: PAGE_LIMIT, search: search || undefined }),
    placeholderData: (previous) => previous,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["doctors"] });
    void queryClient.invalidateQueries({ queryKey: ["doctor-specialisations"] });
    void queryClient.invalidateQueries({ queryKey: ["doctor-designations"] });
  };

  const buildPayload = () => {
    const f = form;
    return {
      doctorType: f.doctorType || undefined,
      employeeId: f.employeeId || undefined,
      firstName: f.firstName || undefined,
      middleName: f.middleName || undefined,
      lastName: f.lastName || undefined,
      shortName: f.shortName || undefined,
      gender: f.gender || undefined,
      email: f.email || undefined,
      phone: f.phone || undefined,
      mobile: f.mobile || undefined,
      city: f.city || undefined,
      specialisationId: f.specialisationId || undefined,
      designationId: f.designationId || undefined,
      departmentId: f.departmentId || undefined,
      onlineAppDisplay: (f.onlineAppDisplay || "Y") as "Y" | "N",
      address: f.address || undefined,
      roomNumber: f.roomNumber || undefined,
      opConsultationFee: toNumber(f.opConsultationFee),
      ipConsultationFee: toNumber(f.ipConsultationFee),
      hospitalFee: toNumber(f.hospitalFee),
      erConsultationFee: toNumber(f.erConsultationFee),
      maxFreeVisits: toNumber(f.maxFreeVisits),
      maxFreeDaysVisits: toNumber(f.maxFreeDaysVisits),
      qualification: f.qualification || undefined,
    };
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload();
      return editingId ? updateDoctor(editingId, payload) : createDoctor(payload);
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFieldErrors({});
      setFeedback(
        editingId ? "Doctor updated successfully" : "Doctor saved successfully",
      );
      window.setTimeout(() => setFeedback(null), 2500);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setDoctorActive(id, active),
    onSuccess: () => {
      invalidate();
      setConfirmTarget(null);
    },
  });

  const update = (patch: Partial<DoctorFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleSave = () => {
    const errors: typeof fieldErrors = {};
    if (form.firstName.trim().length < 2) {
      errors.firstName = "First name is required";
    }
    if (form.lastName.trim().length < 2) {
      errors.lastName = "Last name is required";
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    void saveMutation.mutateAsync();
  };

  const handleEdit = (doctor: Doctor) => {
    setEditingId(doctor.id);
    const hasNameParts = Boolean(doctor.firstName || doctor.lastName);
    const parts = hasNameParts ? [] : doctor.name.trim().split(/\s+/);
    setForm({
      doctorType: doctor.doctorType ?? "",
      employeeId: doctor.employeeId ?? "",
      firstName: doctor.firstName ?? (parts.slice(0, -1).join(" ") || doctor.name),
      middleName: doctor.middleName ?? (parts.length > 2 ? parts.slice(1, -1).join(" ") : ""),
      lastName: doctor.lastName ?? parts[parts.length - 1] ?? "",
      shortName: doctor.shortName ?? "",
      gender: doctor.gender ?? "",
      email: doctor.email ?? "",
      phone: doctor.phone ?? "",
      mobile: doctor.mobile ?? "",
      city: doctor.city ?? "",
      specialisationId: doctor.specialisationId ?? "",
      designationId: doctor.designationId ?? "",
      departmentId: doctor.departmentId ?? "",
      onlineAppDisplay: doctor.onlineAppDisplay ?? "Y",
      address: doctor.address ?? "",
      roomNumber: doctor.roomNumber ?? "",
      opConsultationFee: doctor.opConsultationFee !== undefined ? String(doctor.opConsultationFee) : "",
      ipConsultationFee: doctor.ipConsultationFee !== undefined ? String(doctor.ipConsultationFee) : "",
      hospitalFee: doctor.hospitalFee !== undefined ? String(doctor.hospitalFee) : "",
      erConsultationFee: doctor.erConsultationFee !== undefined ? String(doctor.erConsultationFee) : "",
      maxFreeVisits: doctor.maxFreeVisits !== undefined ? String(doctor.maxFreeVisits) : "",
      maxFreeDaysVisits: doctor.maxFreeDaysVisits !== undefined ? String(doctor.maxFreeDaysVisits) : "",
      qualification: doctor.qualification ?? "",
    });
    setFieldErrors({});
    setFeedback(null);
  };

  const specialisations = useMemo(
    () =>
      (specialisationsQuery.data?.data ?? []).filter((record) => record.active),
    [specialisationsQuery.data],
  );
  const designations = useMemo(
    () =>
      (designationsQuery.data?.data ?? []).filter((record) => record.active),
    [designationsQuery.data],
  );
  const departments = useMemo(
    () => (departmentsQuery.data ?? []).filter((record) => record.active),
    [departmentsQuery.data],
  );

  const doctorTypes = optionsQuery.data?.doctorTypes ?? [];
  const genders = optionsQuery.data?.genders ?? [];
  const yesNoOptions = optionsQuery.data?.yesNoOptions ?? [];

  const columns = [
    { key: "sno", header: "S.No", align: "center" as const, className: "w-16", render: (_row: Doctor, index: number) => (page - 1) * PAGE_LIMIT + index + 1 },
    {
      key: "name",
      header: "Doctor",
      render: (row: Doctor) => (
        <div>
          <p className="font-medium text-slate-800">{row.name}</p>
          {row.shortName && (
            <p className="text-xs text-muted-foreground">{row.shortName}</p>
          )}
        </div>
      ),
    },
    {
      key: "employeeId",
      header: "Employee ID",
      render: (row: Doctor) => row.employeeId ?? "—",
    },
    {
      key: "specialisation",
      header: "Specialisation",
      render: (row: Doctor) => row.specialization ?? "—",
    },
    {
      key: "designation",
      header: "Designation",
      render: (row: Doctor) => row.designation ?? "—",
    },
    {
      key: "mobile",
      header: "Mobile",
      render: (row: Doctor) => row.mobile ?? "—",
    },
    {
      key: "status",
      header: "Status",
      align: "center" as const,
      render: (row: Doctor) => <StatusBadge active={row.active} />,
    },
    {
      key: "actions",
      header: "Action",
      align: "center" as const,
      render: (row: Doctor) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${row.name}`}
            onClick={() => handleEdit(row)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={row.active ? `Deactivate ${row.name}` : `Activate ${row.name}`}
            onClick={() => setConfirmTarget(row)}
          >
            <Power className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  const numberInput = (id: string, value: string, setter: (v: string) => void, placeholder: string) => (
    <Input
      id={id}
      type="number"
      min={0}
      value={value}
      placeholder={placeholder}
      onChange={(event) => setter(event.target.value)}
      disabled={saveMutation.isPending}
    />
  );

  return (
    <div className="space-y-3">
      <PageHeader
        icon={Stethoscope}
        title="Create Doctor"
        subtitle="Register a new doctor or edit an existing one"
      />

      <div className="grid gap-3 2xl:grid-cols-[minmax(0,46rem)_1fr]">
        <FormSection
          title={editingId ? "Edit Doctor" : "Add New Doctor"}
          description={
            editingId
              ? "Update the details and save"
              : "Enter the doctor details and save"
          }
        >
          <div className="space-y-3">
            {feedback && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
                {feedback}
              </p>
            )}
            {saveMutation.isError && (
              <p className="rounded-md bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive ring-1 ring-destructive/20">
                {saveMutation.error instanceof Error
                  ? saveMutation.error.message
                  : "Failed to save doctor"}
              </p>
            )}

            <div className="border-b border-border pb-3">
              <h3 className="mb-2.5 font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Basic Details
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="doc-type" label="Doctor Type">
                  <Select
                    id="doc-type"
                    value={form.doctorType}
                    onChange={(event) => update({ doctorType: event.target.value })}
                    disabled={saveMutation.isPending}
                  >
                    <option value="">Select--</option>
                    {doctorTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="doc-employee" label="Employee ID">
                  <Input
                    id="doc-employee"
                    value={form.employeeId}
                    placeholder="e.g. EMP-001"
                    onChange={(event) => update({ employeeId: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
                <FormField id="doc-first" label="First Name" required error={fieldErrors.firstName}>
                  <Input
                    id="doc-first"
                    value={form.firstName}
                    placeholder="First name"
                    onChange={(event) => update({ firstName: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
                <FormField id="doc-middle" label="Middle Name">
                  <Input
                    id="doc-middle"
                    value={form.middleName}
                    placeholder="Middle name"
                    onChange={(event) => update({ middleName: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
                <FormField id="doc-last" label="Last Name" required error={fieldErrors.lastName}>
                  <Input
                    id="doc-last"
                    value={form.lastName}
                    placeholder="Last name"
                    onChange={(event) => update({ lastName: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
                <FormField id="doc-short" label="Short Name">
                  <Input
                    id="doc-short"
                    value={form.shortName}
                    placeholder="e.g. Dr. A"
                    onChange={(event) => update({ shortName: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
                <FormField id="doc-gender" label="Gender">
                  <Select
                    id="doc-gender"
                    value={form.gender}
                    onChange={(event) => update({ gender: event.target.value })}
                    disabled={saveMutation.isPending}
                  >
                    <option value="">Select--</option>
                    {genders.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="doc-qualification" label="Qualification">
                  <Input
                    id="doc-qualification"
                    value={form.qualification}
                    placeholder="e.g. MBBS, DM"
                    onChange={(event) => update({ qualification: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
              </div>
            </div>

            <div className="border-b border-border pb-3">
              <h3 className="mb-2.5 font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Contact Details
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="doc-mobile" label="Mobile">
                  <Input
                    id="doc-mobile"
                    value={form.mobile}
                    placeholder="10-digit mobile"
                    maxLength={10}
                    onChange={(event) => update({ mobile: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
                <FormField id="doc-phone" label="Phone">
                  <Input
                    id="doc-phone"
                    value={form.phone}
                    placeholder="Landline"
                    onChange={(event) => update({ phone: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
                <FormField id="doc-email" label="Email" error={fieldErrors.email}>
                  <Input
                    id="doc-email"
                    type="email"
                    value={form.email}
                    placeholder="doctor@example.com"
                    onChange={(event) => update({ email: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
                <FormField id="doc-city" label="City">
                  <Input
                    id="doc-city"
                    value={form.city}
                    placeholder="City"
                    onChange={(event) => update({ city: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
                <FormField
                  id="doc-address"
                  label="Address"
                  className="sm:col-span-2"
                >
                  <Input
                    id="doc-address"
                    value={form.address}
                    placeholder="Address"
                    onChange={(event) => update({ address: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
              </div>
            </div>

            <div className="border-b border-border pb-3">
              <h3 className="mb-2.5 font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Practice Details
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="doc-spec" label="Specialisation">
                  <Select
                    id="doc-spec"
                    value={form.specialisationId}
                    onChange={(event) => update({ specialisationId: event.target.value })}
                    disabled={saveMutation.isPending}
                  >
                    <option value="">Select--</option>
                    {specialisations.map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="doc-desig" label="Designation">
                  <Select
                    id="doc-desig"
                    value={form.designationId}
                    onChange={(event) => update({ designationId: event.target.value })}
                    disabled={saveMutation.isPending}
                  >
                    <option value="">Select--</option>
                    {designations.map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="doc-dept" label="Doctor Department">
                  <Select
                    id="doc-dept"
                    value={form.departmentId}
                    onChange={(event) => update({ departmentId: event.target.value })}
                    disabled={saveMutation.isPending}
                  >
                    <option value="">Select--</option>
                    {departments.map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="doc-online" label="Online App. Display">
                  <Select
                    id="doc-online"
                    value={form.onlineAppDisplay}
                    onChange={(event) => update({ onlineAppDisplay: event.target.value })}
                    disabled={saveMutation.isPending}
                  >
                    {yesNoOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="doc-room" label="Room Number">
                  <Input
                    id="doc-room"
                    value={form.roomNumber}
                    placeholder="e.g. 204"
                    onChange={(event) => update({ roomNumber: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </FormField>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField id="doc-opfee" label="OP Consultation Fee">
                {numberInput(
                  "doc-opfee",
                  form.opConsultationFee,
                  (value) => update({ opConsultationFee: value }),
                  "0.00",
                )}
              </FormField>
              <FormField id="doc-ipfee" label="IP Consultation Fee">
                {numberInput(
                  "doc-ipfee",
                  form.ipConsultationFee,
                  (value) => update({ ipConsultationFee: value }),
                  "0.00",
                )}
              </FormField>
              <FormField id="doc-hfee" label="Hospital Fee">
                {numberInput(
                  "doc-hfee",
                  form.hospitalFee,
                  (value) => update({ hospitalFee: value }),
                  "0.00",
                )}
              </FormField>
              <FormField id="doc-erfee" label="ER Consultation Fee">
                {numberInput(
                  "doc-erfee",
                  form.erConsultationFee,
                  (value) => update({ erConsultationFee: value }),
                  "0.00",
                )}
              </FormField>
              <FormField id="doc-freevisits" label="Max Free Visits">
                {numberInput(
                  "doc-freevisits",
                  form.maxFreeVisits,
                  (value) => update({ maxFreeVisits: value }),
                  "0",
                )}
              </FormField>
              <FormField id="doc-freedays" label="Max Free Days Visits">
                {numberInput(
                  "doc-freedays",
                  form.maxFreeDaysVisits,
                  (value) => update({ maxFreeDaysVisits: value }),
                  "0",
                )}
              </FormField>
            </div>

            <FormActions
              onSubmit={handleSave}
              onReset={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
                setFieldErrors({});
                setFeedback(null);
              }}
              submitting={saveMutation.isPending}
              submitLabel={editingId ? "Update" : "Save"}
            />
          </div>
        </FormSection>

        <FormSection
          title="Doctor List"
          description="All registered doctors"
          actions={<SearchInput value={search} onChange={setSearch} placeholder="Search doctors..." />}
        >
          <DataTable
            data={listQuery.data?.data ?? []}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            emptyMessage="No doctors found"
            highlightId={editingId ?? undefined}
            pagination={
              listQuery.data
                ? {
                    page: listQuery.data.pagination.page,
                    totalPages: listQuery.data.pagination.totalPages,
                    total: listQuery.data.pagination.total,
                    limit: listQuery.data.pagination.limit,
                  }
                : undefined
            }
            onPageChange={setPage}
            columns={columns}
          />
        </FormSection>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title={confirmTarget?.active ? "Deactivate doctor?" : "Activate doctor?"}
        description={
          confirmTarget
            ? `Do you want to ${confirmTarget.active ? "deactivate" : "activate"} "${confirmTarget.name}"?`
            : undefined
        }
        confirmLabel={confirmTarget?.active ? "Deactivate" : "Activate"}
        loading={toggleMutation.isPending}
        onConfirm={() => {
          if (confirmTarget) {
            void toggleMutation.mutate({
              id: confirmTarget.id,
              active: !confirmTarget.active,
            });
            setConfirmTarget(null);
          }
        }}
      />
    </div>
  );
}