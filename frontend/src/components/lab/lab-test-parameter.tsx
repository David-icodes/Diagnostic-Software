"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Maximize2,
  Minimize2,
  Pencil,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { AddableDatalist } from "@/components/common/addable-datalist";
import { ConfirmDialog } from "@/components/database/confirm-dialog";
import { DataTable } from "@/components/database/data-table";
import { PageHeader } from "@/components/database/page-header";
import { SearchInput } from "@/components/database/search-input";
import {
  MAPPING_SHORT_LABELS,
  ReferenceMappingDialog,
} from "@/components/lab/reference-mapping-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchDepartments } from "@/services/billing";
import { getDatabaseOptions } from "@/services/database";
import {
  createLabParameter,
  deleteLabParameter,
  fetchLabMasterTests,
  fetchLabParameterSubtitles,
  fetchLabParameters,
  updateLabParameter,
} from "@/services/lab-masters";
import {
  GENDER_RANGE_GENDERS,
  GENDER_RANGE_LABELS,
  PARAMETER_MAPPING_TYPES,
  PARAMETER_REFERENCE_SCOPE_LABELS,
  type GenderRangeGender,
  type ParameterReferenceScope,
  type ParameterRow,
} from "@/types/lab-masters";
import { cn } from "@/lib/utils";

const PAGE_LIMIT = 20;

const REVIEW_REASON_LABELS: Record<string, string> = {
  "missing-range": "no reference range in the source",
  "conditional-range": "range depends on age or clinical state",
  "ambiguous-gender-range": "sex-specific range is incomplete",
  "qualitative-range": "range is qualitative or banded, not numeric",
};

const MODES = [
  { value: "parameter", label: "Parameters" },
  { value: "template", label: "Parameters For Templates" },
];

/**
 * The spec's "Parameter Type" describes how the result is entered, which is the
 * existing `resultType` field. The `Text` / `TextArea` / `Selection` trio is the
 * documented subset; Number, Boolean and Range are kept because the result-entry
 * screen and 513 existing parameters already depend on them, and dropping them
 * would break rows that are in production today.
 */
const RESULT_TYPE_LABELS: Record<string, string> = {
  TEXT: "Text",
  TEXTAREA: "TextArea",
  NUMBER: "Number",
  BOOLEAN: "Boolean",
  SELECT: "Selection",
  RANGE: "Range",
};

const DEFAULT_RESULT_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "RANGE",
];

const DEFAULT_REFERENCE_SCOPES: ParameterReferenceScope[] = [
  "GENERIC",
  "AGE",
  "SEX",
  "AGE_AND_SEX",
];

interface RangeCell {
  from: string;
  to: string;
  text: string;
}

type GenderRangeCells = Record<GenderRangeGender, RangeCell>;

interface ParameterFormState {
  parameterName: string;
  subtitle: string;
  displayOrder: string;
  resultType: string;
  /**
   * The `Normal` / `Derived` / `Calculated` category. It has no slot in the
   * required layout, so it is carried through untouched on save instead of
   * being dropped: an edit must never clear data it does not display.
   */
  parameterType: string;
  unit: string;
  defaultValue: string;
  method: string;
  options: string;
  referenceType: string;
  referenceScope: ParameterReferenceScope;
  onlyReferenceRange: boolean;
  rangeFrom: string;
  rangeTo: string;
  rangeText: string;
  genderRanges: GenderRangeCells;
  active: boolean;
  /** True when structured mappings exist; their generic text is then read-only. */
  legacyLocked: boolean;
}

function emptyRangeCell(): RangeCell {
  return { from: "", to: "", text: "" };
}

function emptyGenderRanges(): GenderRangeCells {
  return { M: emptyRangeCell(), F: emptyRangeCell(), C: emptyRangeCell() };
}

const EMPTY_FORM: ParameterFormState = {
  parameterName: "",
  subtitle: "",
  displayOrder: "0",
  resultType: "TEXT",
  parameterType: "",
  unit: "",
  defaultValue: "",
  method: "",
  options: "",
  referenceType: "GENERAL",
  referenceScope: "GENERIC",
  onlyReferenceRange: false,
  rangeFrom: "",
  rangeTo: "",
  rangeText: "",
  genderRanges: emptyGenderRanges(),
  active: true,
  legacyLocked: false,
};

function toNum(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Mirrors the backend's `composeReferenceRange` so the `>>` button and the
 * read-only preview show exactly what will be stored in `referenceRange`.
 */
function composeCell(cell: RangeCell): string {
  const from = toNum(cell.from);
  const to = toNum(cell.to);
  const text = cell.text.trim();
  if (text && from === undefined && to === undefined) return text;
  if (from !== undefined && to !== undefined) return `${from} - ${to}`;
  if (from !== undefined) return `>= ${from}`;
  if (to !== undefined) return `<= ${to}`;
  return text;
}

function genderRangePreview(cells: GenderRangeCells): string {
  return GENDER_RANGE_GENDERS.map((gender) => {
    const composed = composeCell(cells[gender]);
    return composed ? `${GENDER_RANGE_LABELS[gender]}: ${composed}` : "";
  })
    .filter(Boolean)
    .join("  /  ");
}

function rangeLabel(row: ParameterRow): string {
  if (row.referenceType === "GENDER_WISE") {
    const parts = (row.genderRanges ?? []).map((range) => {
      const part =
        range.text ??
        (range.from !== undefined && range.to !== undefined
          ? `${range.from} - ${range.to}`
          : range.from !== undefined
            ? String(range.from)
            : range.to !== undefined
              ? `Upto ${range.to}`
              : "");
      return part ? `${GENDER_RANGE_LABELS[range.gender]} ${part}` : "";
    });
    const composed = parts.filter(Boolean).join("\n");
    if (composed) return composed;
    return row.referenceRange?.trim() || "—";
  }
  if (row.rangeText) return row.rangeText;
  if (row.rangeFrom !== undefined || row.rangeTo !== undefined) {
    const from = row.rangeFrom !== undefined ? String(row.rangeFrom) : "";
    const to = row.rangeTo !== undefined ? String(row.rangeTo) : "";
    return `${from} - ${to}`;
  }
  // Fall back to the stored source text so an imported range is never shown as
  // blank in the list when it is only held as display text.
  return row.referenceRange?.trim() || "—";
}

/** One label-above-input pair inside a fixed two-column form row. */
function CompactField({
  id,
  label,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("lis-compact-field min-w-0", className)}>
      <label
        htmlFor={id}
        className="mb-0.5 block truncate text-[11px] font-medium text-slate-600"
      >
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export function LabTestParameterContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("parameter");
  const [departmentId, setDepartmentId] = useState("");
  const [testId, setTestId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<ParameterFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<ParameterRow | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ParameterRow | null>(null);
  // VIEW opens the reference-range mapping modal for the row; the row itself is
  // all the modal needs, because it carries the test and department context.
  const [mappingTarget, setMappingTarget] = useState<ParameterRow | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const optionsQuery = useQuery({
    queryKey: ["database-options"],
    queryFn: getDatabaseOptions,
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments", "lab-master"],
    queryFn: () =>
      fetchDepartments({ status: "active" }).then((rows) =>
        rows
          .filter((row) => row.active !== false)
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
  });

  const testsQuery = useQuery({
    queryKey: ["lab-tests", "master", "options", { departmentId }],
    queryFn: () =>
      fetchLabMasterTests({
        status: "active",
        departmentId: departmentId || undefined,
        limit: 100,
      }),
  });

  const listQuery = useQuery({
    queryKey: ["lab-test-parameters", { mode, departmentId, testId, search, page }],
    queryFn: () =>
      fetchLabParameters({
        mode,
        departmentId: departmentId || undefined,
        testId: testId || undefined,
        search: search || undefined,
        page,
        limit: PAGE_LIMIT,
      }),
    placeholderData: (previous) => previous,
  });

  const subtitlesQuery = useQuery({
    queryKey: ["lab-test-parameters", "subtitles", testId],
    queryFn: () => fetchLabParameterSubtitles(testId),
    enabled: testId.trim().length > 0,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["lab-test-parameters"] });
  };

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const genderRanges =
        form.referenceType === "GENDER_WISE"
          ? GENDER_RANGE_GENDERS.map((gender) => {
              const cell = form.genderRanges[gender];
              return {
                gender,
                from: toNum(cell.from),
                to: toNum(cell.to),
                text: cell.text.trim() || undefined,
              };
            })
          : undefined;

      const payload = {
        testId,
        parameterName: form.parameterName.trim(),
        subtitle: form.subtitle.trim() || undefined,
        displayOrder: Number(form.displayOrder) || 0,
        resultType: form.resultType as ParameterRow["resultType"],
        // Preserved rather than dropped: the layout has no field for it, but an
        // edit must not clear a value the user cannot see.
        parameterType: form.parameterType.trim() || undefined,
        defaultValue: form.defaultValue.trim() || undefined,
        unit: form.unit.trim() || undefined,
        method: form.method.trim() || undefined,
        options:
          form.resultType === "SELECT"
            ? form.options
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : undefined,
        referenceType: form.referenceType as ParameterRow["referenceType"],
        referenceScope: form.referenceScope,
        onlyReferenceRange: form.onlyReferenceRange,
        active: form.active,
        // A parameter with structured mappings keeps its stored generic range
        // untouched: the mappings are what result entry uses, and rewriting the
        // text here would only risk the two disagreeing.
        ...(form.legacyLocked
          ? {}
          : form.referenceType === "GENDER_WISE"
            ? { genderRanges }
            : {
                rangeFrom: toNum(form.rangeFrom),
                rangeTo: toNum(form.rangeTo),
                rangeText: form.rangeText.trim() || undefined,
                // Sent as an empty array rather than omitted: switching to a
                // general range must retire the sex rows, or they linger in the
                // document and silently come back if the mode is flipped again.
                genderRanges: [],
              }),
      };
      return editingId
        ? updateLabParameter(editingId, payload)
        : createLabParameter(payload);
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setEditingRow(null);
      setForm(EMPTY_FORM);
      setFeedback(
        editingId
          ? "Parameter updated successfully"
          : "Parameter created successfully",
      );
      window.setTimeout(() => setFeedback(null), 2500);
    },
  });

  // Deleting a parameter is refused by the API when recorded results point at
  // it, so an already-reported parameter can never lose its master record.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLabParameter(id),
    onSuccess: () => {
      invalidate();
      setConfirmTarget(null);
      setFeedback("Parameter deleted successfully");
      window.setTimeout(() => setFeedback(null), 2500);
    },
  });

  // Opens the reference-range mapping modal for one parameter row.
  const openMappingDialog = useCallback((row: ParameterRow) => {
    setMappingTarget(row);
  }, []);

  const departments = departmentsQuery.data ?? [];

  const testOptions = useMemo(() => {
    return (testsQuery.data?.items ?? []).filter((test) =>
      mode === "template"
        ? test.resultMode === "TEMPLATE_BASED"
        : test.resultMode !== "TEMPLATE_BASED",
    );
  }, [testsQuery.data, mode]);

  const parameterResultTypes = useMemo(() => {
    const fromApi = optionsQuery.data?.parameterResultTypes;
    // Merge rather than replace: a parameter already stored as NUMBER must stay
    // selectable, and the select must never drop the value it is showing.
    return Array.from(
      new Set([...(fromApi ?? []), ...DEFAULT_RESULT_TYPES]),
    ) as string[];
  }, [optionsQuery.data]);

  const referenceScopes = useMemo(() => {
    const fromApi = optionsQuery.data?.parameterReferenceScopes as
      | ParameterReferenceScope[]
      | undefined;
    return Array.from(
      new Set([...(fromApi ?? []), ...DEFAULT_REFERENCE_SCOPES]),
    ) as ParameterReferenceScope[];
  }, [optionsQuery.data]);

  const update = (patch: Partial<ParameterFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const updateGenderRange = (gender: GenderRangeGender, patch: Partial<RangeCell>) => {
    setForm((current) => ({
      ...current,
      genderRanges: {
        ...current.genderRanges,
        [gender]: { ...current.genderRanges[gender], ...patch },
      },
    }));
  };

  const clearForm = () => {
    setEditingId(null);
    setEditingRow(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
  };

  const handleSave = () => {
    if (!testId || form.parameterName.trim().length < 1) return;
    saveMutation.mutate();
  };

  /**
   * `>>` composes the entered numbers into the stored display text, so the
   * narrative range and the numeric bounds cannot drift apart.
   */
  const composeReference = () => {
    if (form.referenceType === "GENDER_WISE") {
      setForm((current) => {
        const genderRanges = { ...current.genderRanges };
        for (const gender of GENDER_RANGE_GENDERS) {
          genderRanges[gender] = {
            ...genderRanges[gender],
            text: composeCell(genderRanges[gender]),
          };
        }
        return { ...current, genderRanges };
      });
      return;
    }
    const composed = composeCell({
      from: form.rangeFrom,
      to: form.rangeTo,
      text: form.rangeText,
    });
    update({ rangeText: composed });
  };

  const handleEdit = useCallback((parameter: ParameterRow) => {
    setEditingId(parameter.id);
    setEditingRow(parameter);
    setTestId(parameter.testId);
    if (parameter.departmentId) setDepartmentId(parameter.departmentId);
    const genderRanges = emptyGenderRanges();
    for (const range of parameter.genderRanges ?? []) {
      genderRanges[range.gender] = {
        from: range.from !== undefined ? String(range.from) : "",
        to: range.to !== undefined ? String(range.to) : "",
        text: range.text ?? "",
      };
    }
    setForm({
      parameterName: parameter.parameterName,
      subtitle: parameter.subtitle ?? "",
      displayOrder: String(parameter.displayOrder ?? 0),
      resultType: parameter.resultType,
      parameterType: parameter.parameterType ?? "",
      unit: parameter.unit ?? "",
      defaultValue: parameter.defaultValue ?? "",
      method: parameter.method ?? "",
      options: (parameter.options ?? []).join(", "),
      referenceType: parameter.referenceType,
      referenceScope: parameter.referenceScope ?? "GENERIC",
      onlyReferenceRange: parameter.onlyReferenceRange ?? false,
      rangeFrom: parameter.rangeFrom !== undefined ? String(parameter.rangeFrom) : "",
      rangeTo: parameter.rangeTo !== undefined ? String(parameter.rangeTo) : "",
      // Fall back to the stored source text when a parameter only carries its
      // range as display text, so Edit never opens with a blank reference range.
      rangeText: parameter.rangeText ?? parameter.referenceRange ?? "",
      genderRanges,
      active: parameter.active,
      legacyLocked: (parameter.mappingCount ?? 0) > 0,
    });
    setFeedback(null);
    setCollapsed(false);
  }, []);

  const rows = listQuery.data?.data ?? [];
  const pagination = listQuery.data?.pagination;

  const columns = useMemo(
    () => [
      {
        key: "sno",
        header: "S.No",
        align: "center" as const,
        className: "w-14",
        render: (_row: ParameterRow, index: number) =>
          ((pagination?.page ?? 1) - 1) * PAGE_LIMIT + index + 1,
      },
      {
        key: "departmentName",
        header: "Lab Dept",
        className: "w-28",
        render: (row: ParameterRow) => (
          <span className="block whitespace-normal break-words">
            {row.departmentName ?? "—"}
          </span>
        ),
      },
      {
        key: "testName",
        header: "Lab Test",
        className: "w-40",
        render: (row: ParameterRow) => (
          <span className="block whitespace-normal break-words">
            {row.testName ?? "—"}
          </span>
        ),
      },
      {
        key: "parameterName",
        header: "Parameter Name",
        className: "min-w-0",
        render: (row: ParameterRow) => (
          <span className="block whitespace-normal break-words">
            {row.parameterName}
            {row.subtitle ? (
              <span className="ml-1 text-xs text-muted-foreground">{row.subtitle}</span>
            ) : null}
          </span>
        ),
      },
      {
        key: "unit",
        header: "Units",
        className: "w-24",
        render: (row: ParameterRow) => (
          <span className="block whitespace-normal break-words">{row.unit ?? "—"}</span>
        ),
      },
      {
        key: "referenceRange",
        header: "Reference Range",
        className: "w-60",
        render: (row: ParameterRow) => (
          <span className="block whitespace-pre-line break-words text-xs text-slate-600">
            {rangeLabel(row)}
            {row.unit ? ` ${row.unit}` : ""}
            {row.needsLabReview ? (
              <span
                className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
                title={
                  row.reviewReason
                    ? `Needs Lab Review — ${REVIEW_REASON_LABELS[row.reviewReason] ?? row.reviewReason}. The reference range cannot be applied to a patient result automatically.`
                    : "Needs Lab Review — the reference range cannot be applied to a patient result automatically."
                }
              >
                Needs Lab Review
              </span>
            ) : null}
            <MappingSummaryCell row={row} />
          </span>
        ),
      },
      {
        key: "displayOrder",
        header: "Order No",
        align: "center" as const,
        className: "w-20",
        render: (row: ParameterRow) => row.displayOrder,
      },
      {
        key: "view",
        header: "View",
        align: "center" as const,
        className: "w-14",
        render: (row: ParameterRow) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`View ${row.parameterName}`}
            onClick={() => setMappingTarget(row)}
          >
            <Eye className="size-4" />
          </Button>
        ),
      },
      {
        key: "edit",
        header: "Edit",
        align: "center" as const,
        className: "w-14",
        render: (row: ParameterRow) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${row.parameterName}`}
            onClick={() => handleEdit(row)}
          >
            <Pencil className="size-4" />
          </Button>
        ),
      },
      {
        key: "delete",
        header: "Del",
        align: "center" as const,
        className: "w-14",
        render: (row: ParameterRow) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${row.parameterName}`}
            onClick={() => setConfirmTarget(row)}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        ),
      },
    ],
    [pagination, handleEdit],
  );

  const saveError =
    saveMutation.error instanceof Error ? saveMutation.error.message : null;

  const genderWise = form.referenceType === "GENDER_WISE";
  const readOnlyRange = form.legacyLocked || saveMutation.isPending;
  const genderPreview = genderRangePreview(form.genderRanges);

  return (
    <div className="lis-dm lis-parameter-master space-y-3">
      <PageHeader
        icon={SlidersHorizontal}
        title="Create New Lab Test Parameter"
        subtitle="Configure parameters and reference ranges for lab tests"
        homeHref="/dashboard"
        actions={
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={expanded ? "Collapse form width" : "Expand form width"}
              title={expanded ? "Collapse form width" : "Expand form width"}
              aria-pressed={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? <Minimize2 /> : <Maximize2 />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Refresh"
              title="Refresh"
              onClick={refreshAll}
            >
              <RefreshCw />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={collapsed ? "Expand form" : "Collapse form"}
              title={collapsed ? "Expand form" : "Collapse form"}
              aria-pressed={collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <Maximize2 /> : <Minimize2 />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Close and return to laboratory"
              title="Close and return to laboratory"
              onClick={() => router.push("/dashboard")}
            >
              <X />
            </Button>
          </div>
        }
      />

      {/* ROW 1 — Parameters / Parameters For Templates */}
      <div className="rounded-lg bg-card p-2 ring-1 ring-foreground/10">
        <fieldset className="flex flex-wrap items-center gap-5">
          <legend className="sr-only">Parameter mode</legend>
          {MODES.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-slate-700"
            >
              <input
                type="radio"
                name="parameter-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => {
                  setMode(option.value);
                  setTestId("");
                  setPage(1);
                }}
                className="size-3.5 cursor-pointer accent-primary"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </div>

      <div
        className={cn(
          "lis-parameter-form rounded-lg bg-card p-3 ring-1 ring-foreground/10",
          expanded ? "w-full" : "mx-auto w-full max-w-[1400px]",
        )}
      >
        {!collapsed ? (
          <div className="space-y-3">
            {feedback && (
              <p className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
                {feedback}
              </p>
            )}
            {saveError && (
              <p className="rounded-md bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive ring-1 ring-destructive/20">
                {saveError}
              </p>
            )}

            {/* ROWS 2-6 — identity, type, default, units, status/method */}
            <div className="lis-parameter-fields grid grid-cols-1 gap-x-4 gap-y-2.5 md:grid-cols-2">
              <CompactField id="param-dept" label="Department Name">
                <Select
                  id="param-dept"
                  value={departmentId}
                  onChange={(event) => {
                    setDepartmentId(event.target.value);
                    setTestId("");
                    setPage(1);
                  }}
                  disabled={saveMutation.isPending}
                >
                  <option value="">--Select--</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </CompactField>

              <CompactField id="param-test" label="Test Name" required>
                <Select
                  id="param-test"
                  value={testId}
                  onChange={(event) => {
                    setTestId(event.target.value);
                    setPage(1);
                  }}
                  disabled={saveMutation.isPending}
                >
                  <option value="">--Select--</option>
                  {testOptions.map((test) => (
                    <option key={test.id} value={test.id}>
                      {test.testName}
                    </option>
                  ))}
                </Select>
              </CompactField>

              <CompactField id="param-subtitle" label="Parameter/Subtitle">
                <AddableDatalist
                  id="param-subtitle"
                  value={form.subtitle}
                  onChange={(value) => update({ subtitle: value })}
                  options={subtitlesQuery.data ?? []}

                />
              </CompactField>

              <CompactField id="param-name" label="Parameter Name" required>
                <Input
                  id="param-name"
                  value={form.parameterName}

                  onChange={(event) => update({ parameterName: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </CompactField>

              <CompactField id="param-result-type" label="Parameter Type" required>
                <Select
                  id="param-result-type"
                  value={form.resultType}
                  onChange={(event) => update({ resultType: event.target.value })}
                  disabled={saveMutation.isPending}
                >
                  {parameterResultTypes.map((type) => (
                    <option key={type} value={type}>
                      {RESULT_TYPE_LABELS[type] ?? type}
                    </option>
                  ))}
                </Select>
              </CompactField>

              <CompactField id="param-order" label="OrderNo">
                <Input
                  id="param-order"
                  type="number"
                  min={0}
                  max={9999}
                  value={form.displayOrder}
                  onChange={(event) => update({ displayOrder: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </CompactField>

              <CompactField id="param-default" label="Default Value">
                <Textarea
                  id="param-default"
                  rows={2}
                  value={form.defaultValue}

                  onChange={(event) => update({ defaultValue: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </CompactField>

              <CompactField id="param-unit" label="Units">
                <Input
                  id="param-unit"
                  value={form.unit}

                  onChange={(event) => update({ unit: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </CompactField>

              <CompactField id="param-active" label="Active Status">
                <Select
                  id="param-active"
                  value={form.active ? "Y" : "N"}
                  onChange={(event) => update({ active: event.target.value === "Y" })}
                  disabled={saveMutation.isPending}
                >
                  <option value="Y">Active</option>
                  <option value="N">Inactive</option>
                </Select>
              </CompactField>

              <CompactField id="param-method" label="Method Name">
                <Input
                  id="param-method"
                  value={form.method}

                  onChange={(event) => update({ method: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </CompactField>

              {form.resultType === "SELECT" ? (
                <CompactField
                  id="param-options"
                  label="Options (comma separated)"
                  className="md:col-span-2"
                >
                  <Input
                    id="param-options"
                    value={form.options}

                    onChange={(event) => update({ options: event.target.value })}
                    disabled={saveMutation.isPending}
                  />
                </CompactField>
              ) : null}
            </div>

            {/* SECTION 1 — range mode, reference type, only-range flag */}
            <div className="lis-reference-config rounded-lg border border-border/70 bg-slate-50/70 p-2.5">
              <div className="lis-reference-controls grid grid-cols-1 gap-x-4 gap-y-2.5 md:grid-cols-[auto_auto_1fr] md:items-end">
                <fieldset className="flex flex-wrap items-center gap-4 pb-1.5 md:pb-0">
                  <legend className="sr-only">Reference range mode</legend>
                  {[
                    { value: "GENERAL", label: "General Range" },
                    { value: "GENDER_WISE", label: "Gender Wise Range" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-slate-700"
                    >
                      <input
                        type="radio"
                        name="reference-mode"
                        value={option.value}
                        checked={form.referenceType === option.value}
                        onChange={() => update({ referenceType: option.value })}
                        disabled={saveMutation.isPending}
                        className="size-3.5 cursor-pointer accent-primary"
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>

                <CompactField id="param-ref-scope" label="Reference Type">
                  <Select
                    id="param-ref-scope"
                    value={form.referenceScope}
                    onChange={(event) =>
                      update({ referenceScope: event.target.value as ParameterReferenceScope })
                    }
                    disabled={saveMutation.isPending}
                  >
                    {referenceScopes.map((scope) => (
                      <option key={scope} value={scope}>
                        {PARAMETER_REFERENCE_SCOPE_LABELS[scope] ?? scope}
                      </option>
                    ))}
                  </Select>
                </CompactField>

                <label
                  htmlFor="param-only-range"
                  className="flex h-8 cursor-pointer items-center gap-2 pb-1.5 text-[13px] font-medium text-slate-700 md:pb-0"
                >
                  <Checkbox
                    id="param-only-range"
                    checked={form.onlyReferenceRange}
                    onChange={(event) =>
                      update({ onlyReferenceRange: event.target.checked })
                    }
                    disabled={saveMutation.isPending}
                  />
                  Only Reference Range
                </label>
              </div>

              {form.legacyLocked ? (
                <div className="mt-2.5 rounded-md border border-amber-200 bg-amber-50/70 p-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-[11px] font-semibold text-amber-900">
                        Legacy Reference (Not Used for Automatic Matching)
                      </h4>
                      <p className="mt-0.5 text-[13px] font-medium text-slate-800">
                        {editingRow === null || rangeLabel(editingRow) === "—"
                          ? "Not configured"
                          : `${rangeLabel(editingRow)}${editingRow.unit ? ` ${editingRow.unit}` : ""}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-amber-800">
                        This value is preserved for reference. Result entry uses the configured
                        structured mappings, and this text is never used as a fallback.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        if (editingRow) openMappingDialog(editingRow);
                      }}
                      disabled={!editingRow}
                    >
                      Review &amp; convert to mapping
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start">
                  {/* Left: general row or Male/Female/Child rows */}
                  <div className="space-y-2">
                    {genderWise ? (
                      <div className="space-y-1.5">
                        {GENDER_RANGE_GENDERS.map((gender) => (
                          <div
                            key={gender}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span className="w-16 shrink-0 text-[11px] font-medium text-slate-600">
                              {GENDER_RANGE_LABELS[gender]}
                            </span>
                            <Input
                              aria-label={`${GENDER_RANGE_LABELS[gender]} from`}
                              className="w-24"
                              type="number"
                              step="any"
                              value={form.genderRanges[gender].from}
                              onChange={(event) =>
                                updateGenderRange(gender, { from: event.target.value })
                              }
                              disabled={readOnlyRange}
                            />
                            <Input
                              aria-label={`${GENDER_RANGE_LABELS[gender]} to`}
                              className="w-24"
                              type="number"
                              step="any"
                              value={form.genderRanges[gender].to}
                              onChange={(event) =>
                                updateGenderRange(gender, { to: event.target.value })
                              }
                              disabled={readOnlyRange}
                            />
                            <Input
                              aria-label={`${GENDER_RANGE_LABELS[gender]} range text`}
                              className="min-w-0 flex-1"
                              value={form.genderRanges[gender].text}
                              onChange={(event) =>
                                updateGenderRange(gender, { text: event.target.value })
                              }
                              disabled={readOnlyRange}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-16 shrink-0 text-[11px] font-medium text-slate-600">
                          General
                        </span>
                        <Input
                          aria-label="General from"
                          className="w-24"
                          type="number"
                          step="any"
                          value={form.rangeFrom}
                          onChange={(event) => update({ rangeFrom: event.target.value })}
                          disabled={readOnlyRange}
                        />
                        <Input
                          aria-label="General to"
                          className="w-24"
                          type="number"
                          step="any"
                          value={form.rangeTo}
                          onChange={(event) => update({ rangeTo: event.target.value })}
                          disabled={readOnlyRange}
                        />
                        <Input
                          aria-label="General range text"
                          className="min-w-0 flex-1"
                          value={form.rangeText}
                          onChange={(event) => update({ rangeText: event.target.value })}
                          disabled={readOnlyRange}
                        />
                      </div>
                    )}
                  </div>

                  {/* `>>` — compose display text from the entered numbers */}
                  <div className="flex justify-center py-6 lg:py-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="Compose reference range text"
                      title="Compose reference range text from the entered values"
                      onClick={composeReference}
                      disabled={readOnlyRange}
                    >
                      &gt;&gt;
                    </Button>
                  </div>

                  {/* Right: reference display area */}
                  <div className="min-w-0">
                    <Textarea
                      aria-label="Reference range display"
                      rows={4}
                      // Display-only: the editable text lives in the General range
                      // text input / the gender rows on the left. Marked readOnly
                      // so it is not a controlled field without an onChange.
                      readOnly
                      value={genderWise ? genderPreview : form.rangeText}

                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {form.resultType === "TEXTAREA" ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  TextArea parameters are entered as free text on the result screen and
                  are never flagged high or low automatically.
                </p>
              ) : null}
            </div>

            {/* BUTTONS — SUBMIT / UPDATE / HOME / CLEAR */}
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={editingId !== null || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Saving..." : "Submit"}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={editingId === null || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Saving..." : "Update"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard")}
              >
                Home
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearForm}
                disabled={saveMutation.isPending}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-muted-foreground">
            Form collapsed. Use the expand control in the header to show it again.
          </p>
        )}
      </div>

      {/* FILTER ROW + TABLE */}
      <div className="rounded-lg bg-card p-2 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by department"
            className="w-56"
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              setTestId("");
              setPage(1);
            }}
          >
            <option value="">Department Name</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by test"
            className="w-64"
            value={testId}
            onChange={(event) => {
              setTestId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Test Name</option>
            {testOptions.map((test) => (
              <option key={test.id} value={test.id}>
                {test.testName}
              </option>
            ))}
          </Select>
          <div className="ml-auto">
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Search parameters..."
            />
          </div>
        </div>

        <div className="mt-2 overflow-x-auto">
          <DataTable
            data={rows}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            emptyMessage="No parameters found"
            highlightId={editingId ?? undefined}
            className="rounded-none ring-0"
            pagination={
              pagination
                ? {
                    page: pagination.page,
                    totalPages: pagination.totalPages,
                    total: pagination.total,
                    limit: pagination.limit,
                  }
                : undefined
            }
            onPageChange={(target) => {
              setPage(target);
              window.scrollTo({ top: 0 });
            }}
            columns={columns}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title="Delete parameter?"
        description={
          confirmTarget
            ? `"${confirmTarget.parameterName}" will be permanently deleted from ${confirmTarget.testName ?? "this test"}, along with its reference range mappings. This cannot be undone. A parameter that already has recorded results cannot be deleted.`
            : undefined
        }
        confirmLabel="Delete parameter"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmTarget) deleteMutation.mutate(confirmTarget.id);
        }}
      />

      <ReferenceMappingDialog
        open={mappingTarget !== null}
        onOpenChange={(open) => {
          if (!open) setMappingTarget(null);
        }}
        parameterId={mappingTarget?.id ?? null}
        parameterName={mappingTarget?.parameterName ?? ""}
        unit={mappingTarget?.unit}
        labTestId={mappingTarget?.testId}
        departmentId={mappingTarget?.departmentId}
        labTestName={mappingTarget?.testName}
        departmentName={mappingTarget?.departmentName}
        parameter={mappingTarget}
        onChanged={invalidate}
      />
    </div>
  );
}

/**
 * Compact per-type counts for the Reference Range cell, e.g.
 * "Age: 2 · Sex: 2 · Age & Sex: 4". Only systems the parameter actually has are
 * shown, so the cell stays quiet for the majority that use the generic range.
 */
function MappingSummaryCell({ row }: { row: ParameterRow }) {
  const counts = row.counts ?? {};
  const parts = PARAMETER_MAPPING_TYPES.filter((type) => (counts[type] ?? 0) > 0).map(
    (type) => `${MAPPING_SHORT_LABELS[type]}: ${counts[type]}`,
  );
  if (parts.length === 0) return null;
  return (
    <span className="ml-1 text-[10px] text-muted-foreground">
      {parts.map((part, index) => (
        <span key={part}>
          {index > 0 ? " · " : "("}
          {part}
          {index === parts.length - 1 ? ")" : ""}
        </span>
      ))}
    </span>
  );
}
