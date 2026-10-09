"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/database/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createParameterMapping,
  deleteParameterMapping,
  fetchParameterMappings,
  updateParameterMapping,
} from "@/services/lab-masters";
import {
  GENDER_RANGE_GENDERS,
  GENDER_RANGE_LABELS,
  PARAMETER_MAPPING_TYPES,
  PARAMETER_REFERENCE_SCOPE_LABELS,
  REFERENCE_MAPPING_LABELS,
  type GenderRangeGender,
  type ParameterMappingType,
  type ParameterRow,
  type ReferenceAgeUnit,
  type ReferenceMapping,
  type ReferenceMappingPayload,
  type ReferenceMappingSex,
  type ReferenceMappingType,
  type ReferenceValueType,
} from "@/types/lab-masters";

/** Short labels for the table's Ref Type column, e.g. "Sex" rather than "Sex Wise". */
export const MAPPING_SHORT_LABELS: Record<ReferenceMappingType, string> = {
  GENERIC: "Generic",
  AGE_WISE: "Age",
  SEX_WISE: "Sex",
  AGE_SEX_WISE: "Age & Sex",
};

/** Select options. These mirror the backend enums; no other values exist. */
const VALUE_TYPE_OPTIONS: Array<{ value: ReferenceValueType; label: string }> = [
  { value: "NUMERIC", label: "Numeric" },
  { value: "NARRATIVE", label: "Text" },
];

const SEX_OPTIONS: Array<{ value: ReferenceMappingSex; label: string }> = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "BOTH", label: "Both" },
];

/** Listed Year-first because that is the unit the reference screens default to. */
const AGE_UNIT_OPTIONS: Array<{ value: ReferenceAgeUnit; label: string }> = [
  { value: "YEAR", label: "Year" },
  { value: "MONTH", label: "Month" },
  { value: "DAY", label: "Day" },
];

const VALUE_TYPE_TABLE_LABELS: Record<ReferenceValueType, string> = {
  NUMERIC: "Numeric",
  NARRATIVE: "Text",
};

const SEX_TABLE_LABELS: Record<ReferenceMappingSex, string> = {
  MALE: "Male",
  FEMALE: "Female",
  BOTH: "Both",
};

const AGE_UNIT_TABLE_LABELS: Record<ReferenceAgeUnit, string> = {
  YEAR: "Year",
  MONTH: "Month",
  DAY: "Day",
};

/** Plural forms used in prose, e.g. the delete confirmation. */
const SEX_LABELS: Record<ReferenceMappingSex, string> = {
  MALE: "Male",
  FEMALE: "Female",
  BOTH: "Both",
};

const AGE_UNIT_LABELS: Record<ReferenceAgeUnit, string> = {
  DAY: "Days",
  MONTH: "Months",
  YEAR: "Years",
};

/** Column headers of the mapping table, in the order the reference screen shows. */
const TABLE_COLUMNS = [
  "S.No",
  "Ref Type",
  "Ref Sex",
  "Value Type",
  "Age type",
  "Age From",
  "Age To",
  "Value From",
  "Value To",
  "Status",
  "Edit",
  "Delete",
] as const;

interface MappingFormState {
  valueType: ReferenceValueType;
  sex: ReferenceMappingSex;
  ageUnit: ReferenceAgeUnit;
  ageFrom: string;
  ageTo: string;
  valueFrom: string;
  valueTo: string;
  displayValue: string;
  /** Legacy Status, kept as the Y/N pair the reference screen shows. */
  active: "Y" | "N";
}

const EMPTY_MAPPING_FORM: MappingFormState = {
  valueType: "NUMERIC",
  sex: "BOTH",
  ageUnit: "YEAR",
  ageFrom: "",
  ageTo: "",
  valueFrom: "",
  valueTo: "",
  displayValue: "",
  active: "Y",
};

function toNum(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function mappingToForm(mapping: ReferenceMapping): MappingFormState {
  return {
    valueType: mapping.valueType,
    sex: mapping.sex ?? "BOTH",
    ageUnit: mapping.ageUnit ?? "YEAR",
    ageFrom: mapping.ageFrom !== undefined ? String(mapping.ageFrom) : "",
    ageTo: mapping.ageTo !== undefined ? String(mapping.ageTo) : "",
    valueFrom: mapping.valueFrom !== undefined ? String(mapping.valueFrom) : "",
    valueTo: mapping.valueTo !== undefined ? String(mapping.valueTo) : "",
    displayValue: mapping.displayValue ?? "",
    active: mapping.active === false ? "N" : "Y",
  };
}

/**
 * Only the fields the chosen system owns are sent.
 *
 * Sending `sex` on an age-wise mapping (or the reverse) would be rejected by the
 * API, so each system narrows the payload rather than relying on the server to
 * discard what does not apply.
 */
function formToPayload(
  form: MappingFormState,
  mappingType: ParameterMappingType,
): ReferenceMappingPayload {
  const needsSex = mappingType === "SEX_WISE" || mappingType === "AGE_SEX_WISE";
  const needsAge = mappingType === "AGE_WISE" || mappingType === "AGE_SEX_WISE";
  return {
    mappingType,
    valueType: form.valueType,
    ...(needsSex ? { sex: form.sex } : {}),
    ...(needsAge
      ? {
          ageUnit: form.ageUnit,
          ageFrom: toNum(form.ageFrom),
          ageTo: toNum(form.ageTo),
        }
      : {}),
    ...(form.valueType === "NUMERIC"
      ? { valueFrom: toNum(form.valueFrom), valueTo: toNum(form.valueTo) }
      : {}),
    // Display Value is stored verbatim apart from surrounding whitespace: it is
    // clinical text and must never be rewritten or parsed into a range.
    displayValue: form.displayValue.trim() || undefined,
    // Active Status only appears on the sex-wise and age-and-sex-wise screens.
    ...(needsSex ? { active: form.active === "Y" } : {}),
  };
}

/** Mirrors the API's cross-field rules so an invalid row is caught before the round trip. */
function validateForm(
  form: MappingFormState,
  mappingType: ParameterMappingType,
): string | null {
  const needsAge = mappingType === "AGE_WISE" || mappingType === "AGE_SEX_WISE";
  if (needsAge && toNum(form.ageFrom) === undefined && toNum(form.ageTo) === undefined) {
    return "Enter at least one age bound.";
  }
  const from = toNum(form.ageFrom);
  const to = toNum(form.ageTo);
  if (from !== undefined && to !== undefined && from > to) {
    return "Age To cannot be smaller than Age From.";
  }
  if (form.valueType === "NUMERIC") {
    const valueFrom = toNum(form.valueFrom);
    const valueTo = toNum(form.valueTo);
    if (valueFrom === undefined && valueTo === undefined) {
      return "Enter a lower or upper value bound, or switch Reference Value Type to Text.";
    }
    if (valueFrom !== undefined && valueTo !== undefined && valueFrom > valueTo) {
      return "Reference Value To cannot be smaller than Reference Value From.";
    }
  }
  if (!form.displayValue.trim()) {
    return "Enter the Display Value shown for this range.";
  }
  return null;
}

/** Human summary of one mapping row, used in confirmations. */
export function describeMapping(mapping: ReferenceMapping): {
  applies: string;
  reference: string;
} {
  const parts: string[] = [];
  if (mapping.mappingType === "SEX_WISE" || mapping.mappingType === "AGE_SEX_WISE") {
    parts.push(mapping.sex ? SEX_LABELS[mapping.sex] : "Any sex");
  }
  if (mapping.mappingType === "AGE_WISE" || mapping.mappingType === "AGE_SEX_WISE") {
    const unit = mapping.ageUnit ? AGE_UNIT_LABELS[mapping.ageUnit] : "Years";
    const from = mapping.ageFrom;
    const to = mapping.ageTo;
    const window =
      from !== undefined && to !== undefined
        ? `${from}-${to} ${unit.toLowerCase()}`
        : from !== undefined
          ? `From ${from} ${unit.toLowerCase()}`
          : to !== undefined
            ? `Up to ${to} ${unit.toLowerCase()}`
            : "All ages";
    parts.push(window);
  }
  const reference =
    mapping.displayValue?.trim() ||
    (mapping.valueFrom !== undefined && mapping.valueTo !== undefined
      ? `${mapping.valueFrom} - ${mapping.valueTo}`
      : mapping.valueFrom !== undefined
        ? `From ${mapping.valueFrom}`
        : mapping.valueTo !== undefined
          ? `Up to ${mapping.valueTo}`
          : "—");
  return { applies: parts.join(" · ") || "All patients", reference };
}

interface ReferenceMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The one parameter every mapping in this modal belongs to. */
  parameterId: string | null;
  parameterName: string;
  /** Unit the parameter reports in, shown alongside numeric references. */
  unit?: string;
  /** Lab test and department the parameter sits under; kept as modal context. */
  labTestId?: string;
  departmentId?: string;
  labTestName?: string;
  departmentName?: string;
  /** The parameter itself, so View can show its configured reference range. */
  parameter?: ParameterRow | null;
  /** Called after any change so the master list and its counts refresh. */
  onChanged?: () => void;
}

export function ReferenceMappingDialog({
  open,
  onOpenChange,
  parameterId,
  parameterName,
  unit,
  labTestId,
  departmentId,
  labTestName,
  departmentName,
  parameter,
  onChanged,
}: ReferenceMappingDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<MappingFormState>(EMPTY_MAPPING_FORM);
  const [mappingType, setMappingType] = useState<ParameterMappingType>("AGE_WISE");
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReferenceMapping | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Adjusting state during render rather than in an effect: the modal resets on
  // every open, so closing discards a half-entered mapping and reopening always
  // begins on Age Wise. Only the `open` edge drives this — watching the selected
  // system here would snap the radio back the moment it is changed.
  const [previousOpen, setPreviousOpen] = useState(open);
  if (previousOpen !== open) {
    setPreviousOpen(open);
    setForm(EMPTY_MAPPING_FORM);
    setMappingType("AGE_WISE");
    setEditingMappingId(null);
    setDeleteTarget(null);
    setError(null);
  }

  const mappingsQuery = useQuery({
    // The lab test and department are part of the key so switching parameter
    // can never show the previous row's mappings under the new row's header.
    queryKey: [
      "lab-test-parameters",
      "mappings",
      parameterId,
      labTestId ?? "",
      departmentId ?? "",
    ],
    queryFn: () => fetchParameterMappings(parameterId as string),
    enabled: open && Boolean(parameterId),
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["lab-test-parameters", "mappings", parameterId],
    });
    onChanged?.();
  }, [queryClient, parameterId, onChanged]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = formToPayload(form, mappingType);
      return editingMappingId
        ? updateParameterMapping(parameterId as string, editingMappingId, payload)
        : createParameterMapping(parameterId as string, payload);
    },
    onSuccess: () => {
      invalidate();
      setError(null);
      // A saved edit stays in edit mode so the highlighted row keeps showing the
      // record that was just changed; a saved create clears the form for the next.
      if (!editingMappingId) setForm(EMPTY_MAPPING_FORM);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Could not save the mapping",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (mapping: ReferenceMapping) =>
      deleteParameterMapping(parameterId as string, mapping.id),
    onSuccess: () => {
      invalidate();
      // The deleted row cannot stay selected: leaving edit mode behind would
      // point Update at a mapping that no longer exists.
      if (deleteTarget && editingMappingId === deleteTarget.id) {
        setEditingMappingId(null);
        setForm(EMPTY_MAPPING_FORM);
      }
      setDeleteTarget(null);
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setDeleteTarget(null);
      setError(
        mutationError instanceof Error ? mutationError.message : "Could not delete the mapping",
      );
    },
  });

  const update = (patch: Partial<MappingFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleEdit = (mapping: ReferenceMapping) => {
    setEditingMappingId(mapping.id);
    setMappingType(mapping.mappingType as ParameterMappingType);
    setForm(mappingToForm(mapping));
    setError(null);
  };

  /** Clear empties the form and leaves edit mode, but keeps the chosen system. */
  const resetForm = () => {
    setEditingMappingId(null);
    setForm(EMPTY_MAPPING_FORM);
    setError(null);
  };

  const handleSave = () => {
    const validationMessage = validateForm(form, mappingType);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    setError(null);
    saveMutation.mutate();
  };

  const mappings = useMemo(
    () => mappingsQuery.data?.data ?? [],
    [mappingsQuery.data],
  );

  const busy = saveMutation.isPending || deleteMutation.isPending;

  const contextLine = [labTestName, departmentName].filter(Boolean).join(" · ");

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      centered
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      className="lis-reference-mapping w-[72vw] min-w-[900px] max-w-[1200px] max-h-[calc(100vh-2rem)] rounded-none border border-slate-300 bg-white shadow-md ring-0"
      // The modal has no visible close cross in the reference layout; the Close
      // button, the overlay and Escape all still dismiss it.
      title={undefined}
    >
      <div className="shrink-0 border-b border-slate-300 px-4 py-3 text-center">
        <h2 className="text-[21px] font-medium leading-tight text-slate-800">
          Reference Range Mapping
        </h2>
        {contextLine ? (
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {parameterName}
            {unit ? ` (${unit})` : ""}
            {` — ${contextLine}`}
          </p>
        ) : null}
      </div>

      {/* Read-only summary of the reference actually stored on this parameter.
          The old LIS shows these values on View; without them the modal would
          look empty for the parameters whose range is generic/gender-wise. */}
      {parameter ? <ConfiguredReferencePanel parameter={parameter} /> : null}

      {/* One horizontal row of three radios: they are not tabs and never stack.
          The four equal columns place the options at a quarter, a half and the
          full width apart, which is how the reference screen spaces them. */}
      <div className="grid shrink-0 grid-cols-4 items-center gap-2 border-b border-slate-300 px-4 py-2">
        {PARAMETER_MAPPING_TYPES.map((type) => (
          <label
            key={type}
            htmlFor={`reference-map-type-${type}`}
            className="flex cursor-pointer items-center gap-2 justify-self-start text-sm text-slate-700"
          >
            <input
              id={`reference-map-type-${type}`}
              type="radio"
              name="reference-range-mapping-type"
              className="size-4 accent-blue-600"
              checked={mappingType === type}
              disabled={busy}
              onChange={() => {
                setMappingType(type);
                setError(null);
              }}
            />
            <span>{REFERENCE_MAPPING_LABELS[type]}</span>
          </label>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[860px]">
          {error ? (
            <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <div className="px-4 pt-1">
            {/* The Age Wise screen has no Active Status field in the reference
                layout, so that system never writes it and a stored value is
                left untouched rather than being reset to Y. */}
            {mappingType === "AGE_WISE" ? (
              <>
                <FormRow>
                  <FormCell label="Reference Value Type" htmlFor="map-value-type">
                    <Select
                      id="map-value-type"
                      className="h-[34px] rounded-md text-sm"
                      value={form.valueType}
                      disabled={busy}
                      onChange={(event) =>
                        update({ valueType: event.target.value as ReferenceValueType })
                      }
                    >
                      {VALUE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormCell>
                  <span />
                </FormRow>

                <FormRow>
                  <FormCell label="Age Type" htmlFor="map-age-unit">
                    <Select
                      id="map-age-unit"
                      className="h-[34px] rounded-md text-sm"
                      value={form.ageUnit}
                      disabled={busy}
                      onChange={(event) =>
                        update({ ageUnit: event.target.value as ReferenceAgeUnit })
                      }
                    >
                      {AGE_UNIT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormCell>
                  <span />
                </FormRow>

                <FormRow>
                  <FormCell label="Age From" htmlFor="map-age-from">
                    <Input
                      id="map-age-from"
                      type="number"
                      min={0}
                      step="any"
                      className="h-[34px] rounded-md text-sm"
                      value={form.ageFrom}
                      disabled={busy}
                      onChange={(event) => update({ ageFrom: event.target.value })}
                    />
                  </FormCell>
                  <FormCell label="Age To" htmlFor="map-age-to">
                    <Input
                      id="map-age-to"
                      type="number"
                      min={0}
                      step="any"
                      className="h-[34px] rounded-md text-sm"
                      value={form.ageTo}
                      disabled={busy}
                      onChange={(event) => update({ ageTo: event.target.value })}
                    />
                  </FormCell>
                </FormRow>

                <ValueBoundsRow form={form} update={update} busy={busy} />

                <FormRow>
                  <FormCell label="Display Value" htmlFor="map-display">
                    <Textarea
                      id="map-display"
                      rows={2}
                      className="rounded-md text-sm"
                      value={form.displayValue}
                      disabled={busy}
                      onChange={(event) => update({ displayValue: event.target.value })}
                    />
                  </FormCell>
                  <span />
                </FormRow>
              </>
            ) : null}

            {mappingType === "SEX_WISE" ? (
              <>
                <FormRow>
                  <FormCell label="Select Gender" htmlFor="map-sex">
                    <Select
                      id="map-sex"
                      className="h-[34px] rounded-md text-sm"
                      value={form.sex}
                      disabled={busy}
                      onChange={(event) =>
                        update({ sex: event.target.value as ReferenceMappingSex })
                      }
                    >
                      {SEX_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormCell>
                  <span />
                </FormRow>

                <FormRow>
                  <FormCell label="Reference Value Type" htmlFor="map-value-type">
                    <Select
                      id="map-value-type"
                      className="h-[34px] rounded-md text-sm"
                      value={form.valueType}
                      disabled={busy}
                      onChange={(event) =>
                        update({ valueType: event.target.value as ReferenceValueType })
                      }
                    >
                      {VALUE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormCell>
                  <span />
                </FormRow>

                <ValueBoundsRow form={form} update={update} busy={busy} />

                <FormRow>
                  <FormCell label="Display Value" htmlFor="map-display">
                    <Textarea
                      id="map-display"
                      rows={2}
                      className="rounded-md text-sm"
                      value={form.displayValue}
                      disabled={busy}
                      onChange={(event) => update({ displayValue: event.target.value })}
                    />
                  </FormCell>
                  <FormCell label="Active Status" htmlFor="map-active">
                    <Select
                      id="map-active"
                      className="h-[34px] rounded-md text-sm"
                      value={form.active}
                      disabled={busy}
                      onChange={(event) => update({ active: event.target.value as "Y" | "N" })}
                    >
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </Select>
                  </FormCell>
                </FormRow>
              </>
            ) : null}

            {mappingType === "AGE_SEX_WISE" ? (
              <>
                <FormRow>
                  <FormCell label="Select Gender" htmlFor="map-sex">
                    <Select
                      id="map-sex"
                      className="h-[34px] rounded-md text-sm"
                      value={form.sex}
                      disabled={busy}
                      onChange={(event) =>
                        update({ sex: event.target.value as ReferenceMappingSex })
                      }
                    >
                      {SEX_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormCell>
                  <span />
                </FormRow>

                <FormRow>
                  <FormCell label="Reference Value Type" htmlFor="map-value-type">
                    <Select
                      id="map-value-type"
                      className="h-[34px] rounded-md text-sm"
                      value={form.valueType}
                      disabled={busy}
                      onChange={(event) =>
                        update({ valueType: event.target.value as ReferenceValueType })
                      }
                    >
                      {VALUE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormCell>
                  <span />
                </FormRow>

                <FormRow>
                  <FormCell label="Age Type" htmlFor="map-age-unit">
                    <Select
                      id="map-age-unit"
                      className="h-[34px] rounded-md text-sm"
                      value={form.ageUnit}
                      disabled={busy}
                      onChange={(event) =>
                        update({ ageUnit: event.target.value as ReferenceAgeUnit })
                      }
                    >
                      {AGE_UNIT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormCell>
                  <span />
                </FormRow>

                <FormRow>
                  <FormCell label="Age From" htmlFor="map-age-from">
                    <Input
                      id="map-age-from"
                      type="number"
                      min={0}
                      step="any"
                      className="h-[34px] rounded-md text-sm"
                      value={form.ageFrom}
                      disabled={busy}
                      onChange={(event) => update({ ageFrom: event.target.value })}
                    />
                  </FormCell>
                  <FormCell label="Age To" htmlFor="map-age-to">
                    <Input
                      id="map-age-to"
                      type="number"
                      min={0}
                      step="any"
                      className="h-[34px] rounded-md text-sm"
                      value={form.ageTo}
                      disabled={busy}
                      onChange={(event) => update({ ageTo: event.target.value })}
                    />
                  </FormCell>
                </FormRow>

                <ValueBoundsRow form={form} update={update} busy={busy} />

                <FormRow>
                  <FormCell label="Display Value" htmlFor="map-display">
                    <Textarea
                      id="map-display"
                      rows={2}
                      className="rounded-md text-sm"
                      value={form.displayValue}
                      disabled={busy}
                      onChange={(event) => update({ displayValue: event.target.value })}
                    />
                  </FormCell>
                  <FormCell label="Active Status" htmlFor="map-active">
                    <Select
                      id="map-active"
                      className="h-[34px] rounded-md text-sm"
                      value={form.active}
                      disabled={busy}
                      onChange={(event) => update({ active: event.target.value as "Y" | "N" })}
                    >
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </Select>
                  </FormCell>
                </FormRow>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-md"
              onClick={handleSave}
              disabled={busy}
            >
              {saveMutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {editingMappingId ? "Update" : "Submit"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-md"
              onClick={resetForm}
              disabled={busy}
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-md"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Close
            </Button>
            {editingMappingId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-md text-red-600"
                onClick={() => {
                  const selected = mappings.find(
                    (mapping) => mapping.id === editingMappingId,
                  );
                  if (selected) setDeleteTarget(selected);
                }}
                disabled={busy}
              >
                <Trash2 />
                Delete
              </Button>
            ) : null}
          </div>

          <MappingTable
            mappings={mappings}
            loading={mappingsQuery.isLoading}
            selectedId={editingMappingId}
            busy={busy}
            onEdit={handleEdit}
            onDelete={(mapping) => setDeleteTarget(mapping)}
          />

          <div className="h-4" />
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title="Delete this mapping?"
        description={
          deleteTarget
            ? `"${describeMapping(deleteTarget).reference}" (${describeMapping(deleteTarget).applies}) will be removed from ${parameterName}. The parameter and its generic reference range are not affected.`
            : undefined
        }
        confirmLabel="Delete mapping"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
      />
    </Dialog>
  );
}

/**
 * Read-only summary of the reference configuration stored on the parameter.
 *
 * View used to show only the structured mapping rows, so for the parameters
 * whose range lives in the generic or gender-wise fields (which is every
 * imported catalogue row) the modal looked empty. This shows the same values
 * the old LIS shows on View: the reference type, the range mode and the values.
 */
function ConfiguredReferencePanel({ parameter }: { parameter: ParameterRow }) {
  const scope = parameter.referenceScope ?? "GENERIC";
  const genderWise = parameter.referenceType === "GENDER_WISE";

  const genderRows: Array<{ gender: GenderRangeGender; value: string }> = [];
  if (genderWise) {
    for (const gender of GENDER_RANGE_GENDERS) {
      const row = (parameter.genderRanges ?? []).find((entry) => entry.gender === gender);
      if (!row) continue;
      const value =
        row.text?.trim() ||
        (row.from !== undefined && row.to !== undefined
          ? `${row.from} - ${row.to}`
          : row.from !== undefined
            ? `>= ${row.from}`
            : row.to !== undefined
              ? `<= ${row.to}`
              : "");
      if (value) genderRows.push({ gender, value });
    }
  }

  const numeric =
    parameter.rangeFrom !== undefined || parameter.rangeTo !== undefined
      ? `${parameter.rangeFrom ?? ""} - ${parameter.rangeTo ?? ""}`
      : "";
  const generalValue = parameter.rangeText?.trim() || parameter.referenceRange?.trim() || "";

  return (
    <div className="shrink-0 border-b border-slate-300 bg-slate-50 px-4 py-2 text-xs text-slate-700">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <span>
          <span className="font-semibold uppercase tracking-wide text-slate-500">
            Reference Type{" "}
          </span>
          {PARAMETER_REFERENCE_SCOPE_LABELS[scope]}
        </span>
        <span>
          <span className="font-semibold uppercase tracking-wide text-slate-500">Range </span>
          {genderWise ? "Gender wise" : "General"}
        </span>
        {parameter.onlyReferenceRange ? (
          <span>
            <span className="font-semibold uppercase tracking-wide text-slate-500">
              Only Reference Range{" "}
            </span>
            Yes
          </span>
        ) : null}
      </div>

      <div className="mt-1 space-y-0.5">
        {genderWise ? (
          genderRows.length > 0 ? (
            genderRows.map((row) => (
              <div key={row.gender}>
                <span className="font-semibold text-slate-500">
                  {GENDER_RANGE_LABELS[row.gender]}{" "}
                </span>
                <span className="whitespace-pre-line">{row.value}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-500">
              No gender-wise values stored for this parameter.
            </div>
          )
        ) : numeric || generalValue ? (
          <div>
            <span className="font-semibold text-slate-500">Value </span>
            <span className="whitespace-pre-line">
              {numeric}
              {numeric && generalValue ? "  " : ""}
              {generalValue}
            </span>
          </div>
        ) : (
          <div className="text-slate-500">No reference range configured for this parameter.</div>
        )}
      </div>
    </div>
  );
}

/** A horizontal band of the form: two independent label-and-control cells. */
function FormRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 border-b border-slate-200">{children}</div>
  );
}

/**
 * One label/control pair. The control always starts at the same horizontal
 * offset inside its half of the form, which is what keeps the two columns of
 * inputs aligned down the whole form.
 */
function FormCell({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(150px,38%)_minmax(0,62%)] items-start gap-x-3 px-1 py-1.5">
      <label htmlFor={htmlFor} className="pt-2 text-sm text-slate-700">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** The paired Reference Value From / To row, shared by all three systems. */
function ValueBoundsRow({
  form,
  update,
  busy,
}: {
  form: MappingFormState;
  update: (patch: Partial<MappingFormState>) => void;
  busy: boolean;
}) {
  const narrative = form.valueType !== "NUMERIC";
  return (
    <FormRow>
      <FormCell label="Reference Value From" htmlFor="map-value-from">
        <Input
          id="map-value-from"
          type={narrative ? "text" : "number"}
          step="any"
          className="h-[34px] rounded-md text-sm"
          value={form.valueFrom}
          disabled={busy || narrative}
          onChange={(event) => update({ valueFrom: event.target.value })}
        />
        {narrative ? (
          <p className="mt-1 text-[13px] leading-snug text-slate-500">
            A text range is written in Display Value.
          </p>
        ) : null}
      </FormCell>
      <FormCell label="Reference Value To" htmlFor="map-value-to">
        <Input
          id="map-value-to"
          type={narrative ? "text" : "number"}
          step="any"
          className="h-[34px] rounded-md text-sm"
          value={form.valueTo}
          disabled={busy || narrative}
          onChange={(event) => update({ valueTo: event.target.value })}
        />
      </FormCell>
    </FormRow>
  );
}

/** The lower half of the modal: every mapping of this parameter, in one table. */
function MappingTable({
  mappings,
  loading,
  selectedId,
  busy,
  onEdit,
  onDelete,
}: {
  mappings: ReferenceMapping[];
  loading: boolean;
  selectedId: string | null;
  busy: boolean;
  onEdit: (mapping: ReferenceMapping) => void;
  onDelete: (mapping: ReferenceMapping) => void;
}) {
  // The columns stay visible even with nothing in them: the header is what
  // tells the user what a mapping row is made of before any row exists.
  const notice = loading
    ? "Loading mappings..."
    : mappings.length === 0
      ? "No reference mappings yet. Result entry will use this parameter's generic reference range."
      : null;

  return (
    <table className="w-full table-fixed border-collapse text-left text-xs text-slate-700">
      <thead>
        <tr className="border-y border-slate-300 text-slate-800">
          {TABLE_COLUMNS.map((column) => (
            <th
              key={column}
              scope="col"
              className={cn(
                "px-2 py-2 font-semibold",
                column === "S.No" && "w-12",
                (column === "Edit" || column === "Delete") && "w-16 text-right",
              )}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {notice ? (
          <tr className="border-b border-slate-200">
            <td colSpan={TABLE_COLUMNS.length} className="px-2 py-3 text-xs text-slate-500">
              {notice}
            </td>
          </tr>
        ) : null}
        {mappings.map((mapping, index) => {
          const ageApplies =
            mapping.mappingType === "AGE_WISE" || mapping.mappingType === "AGE_SEX_WISE";
          const sexApplies =
            mapping.mappingType === "SEX_WISE" || mapping.mappingType === "AGE_SEX_WISE";
          const numeric = mapping.valueType === "NUMERIC";
          const selected = selectedId === mapping.id;
          return (
            <tr
              key={mapping.id}
              className={cn(
                "border-b border-slate-200 align-middle",
                selected && "bg-yellow-100",
              )}
            >
              <td className="px-2 py-1.5">{index + 1}</td>
              <td className="px-2 py-1.5">{MAPPING_SHORT_LABELS[mapping.mappingType]}</td>
              <td className="px-2 py-1.5">
                {sexApplies && mapping.sex ? SEX_TABLE_LABELS[mapping.sex] : ""}
              </td>
              <td className="px-2 py-1.5">
                {VALUE_TYPE_TABLE_LABELS[mapping.valueType]}
              </td>
              <td className="px-2 py-1.5">
                {ageApplies && mapping.ageUnit ? AGE_UNIT_TABLE_LABELS[mapping.ageUnit] : ""}
              </td>
              <td className="px-2 py-1.5">
                {ageApplies && mapping.ageFrom !== undefined ? mapping.ageFrom : ""}
              </td>
              <td className="px-2 py-1.5">
                {ageApplies && mapping.ageTo !== undefined ? mapping.ageTo : ""}
              </td>
              <td className="px-2 py-1.5">
                {numeric && mapping.valueFrom !== undefined ? mapping.valueFrom : ""}
              </td>
              <td className="px-2 py-1.5">
                {numeric && mapping.valueTo !== undefined ? mapping.valueTo : ""}
              </td>
              <td className="px-2 py-1.5">{mapping.active === false ? "N" : "Y"}</td>
              <td className="px-2 py-1.5 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${MAPPING_SHORT_LABELS[mapping.mappingType]} mapping ${index + 1}`}
                  disabled={busy}
                  onClick={() => onEdit(mapping)}
                >
                  <Pencil className="size-4" />
                </Button>
              </td>
              <td className="px-2 py-1.5 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${MAPPING_SHORT_LABELS[mapping.mappingType]} mapping ${index + 1}`}
                  disabled={busy}
                  onClick={() => onDelete(mapping)}
                >
                  <Trash2 className="size-4 text-red-600" />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
