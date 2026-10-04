"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Power } from "lucide-react";
import { ConfirmDialog } from "@/components/database/confirm-dialog";
import { DataTable } from "@/components/database/data-table";
import { FormActions } from "@/components/database/form-actions";
import { FormField } from "@/components/database/form-field";
import { FormSection } from "@/components/database/form-section";
import { PageHeader } from "@/components/database/page-header";
import { StatusBadge } from "@/components/database/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createLocation,
  fetchLocations,
  setLocationActive,
  updateLocation,
} from "@/services/database";
import {
  LOCATION_LEVEL_LABELS,
  LOCATION_LEVEL_ORDER,
  type Location,
  type LocationLevel,
} from "@/types/database";

interface LocationSelection {
  selectId: string;
  newName: string;
}

interface AddressRow {
  key: string;
  country: Location | null;
  state: Location | null;
  district: Location | null;
  city: Location | null;
}

function emptySelection(): Record<LocationLevel, LocationSelection> {
  return {
    country: { selectId: "", newName: "" },
    state: { selectId: "", newName: "" },
    district: { selectId: "", newName: "" },
    city: { selectId: "", newName: "" },
  };
}

export function LocationContent() {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<Record<LocationLevel, LocationSelection>>(
    emptySelection,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLevel, setEditingLevel] = useState<LocationLevel | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Location | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const locationsQuery = useQuery({
    queryKey: ["locations", "all"],
    queryFn: async () => {
      const [countries, states, districts, cities] = await Promise.all([
        fetchLocations({ type: "country" }),
        fetchLocations({ type: "state" }),
        fetchLocations({ type: "district" }),
        fetchLocations({ type: "city" }),
      ]);
      return { countries, states, districts, cities };
    },
    placeholderData: (previous) => previous,
  });

  const byType = useMemo(() => {
    const data = locationsQuery.data;
    return {
      country: data?.countries ?? [],
      state: data?.states ?? [],
      district: data?.districts ?? [],
      city: data?.cities ?? [],
    };
  }, [locationsQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["locations"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let previousId: string | null = null;
      if (editingId && editingLevel) {
        const name = selection[editingLevel].newName.trim();
        if (!name) throw new Error("Enter the new name to save");
        await updateLocation(editingId, name);
        return;
      }
      let didCreate = false;
      for (const level of LOCATION_LEVEL_ORDER) {
        const entry = selection[level];
        const newName = entry.newName.trim();
        const selectedId = entry.selectId;
        if (newName) {
          const parentId = previousId ?? undefined;
          const created = await createLocation({
            type: level,
            name: newName,
            ...(parentId ? { parentId } : {}),
          });
          previousId = created.location.id;
          didCreate = true;
        } else if (selectedId) {
          previousId = selectedId;
        }
      }
      if (!didCreate) {
        throw new Error("Select or enter a location value to save");
      }
    },
    onSuccess: () => {
      invalidate();
      setSelection(emptySelection());
      setEditingId(null);
      setEditingLevel(null);
      setFeedback(
        editingId
          ? "Location updated successfully"
          : "Location saved successfully",
      );
      window.setTimeout(() => setFeedback(null), 2500);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setLocationActive(id, active),
    onSuccess: () => {
      invalidate();
      setConfirmTarget(null);
    },
  });

  const handleSelect = (level: LocationLevel, selectId: string) => {
    if (editingId && (level !== editingLevel || selectId !== "__new__")) {
      setEditingId(null);
      setEditingLevel(null);
    }
    setSelection((current) => {
      const next = { ...current };
      for (const lvl of LOCATION_LEVEL_ORDER) {
        next[lvl] = { ...next[lvl] };
      }
      next[level].selectId = selectId;
      next[level].newName = "";
      if (selectId !== "__new__") {
        const idx = LOCATION_LEVEL_ORDER.indexOf(level);
        for (let i = idx + 1; i < LOCATION_LEVEL_ORDER.length; i += 1) {
          next[LOCATION_LEVEL_ORDER[i]] = { selectId: "", newName: "" };
        }
      }
      return next;
    });
  };

  const handleNewName = (level: LocationLevel, newName: string) => {
    setSelection((current) => ({
      ...current,
      [level]: { ...current[level], newName },
    }));
  };

  const handleSave = () => {
    void saveMutation.mutateAsync();
  };

  const handleClear = () => {
    setSelection(emptySelection());
    setEditingId(null);
    setEditingLevel(null);
    setFeedback(null);
  };

  const handleEdit = (row: AddressRow) => {
    const chain: { level: LocationLevel; location: Location }[] = [];
    (Object.keys(LOCATION_LEVEL_LABELS) as LocationLevel[]).forEach((level) => {
      const location = row[level];
      if (location) chain.push({ level, location });
    });
    const leaf = chain[chain.length - 1];
    if (!leaf) return;

    const prefilled = emptySelection();
    prefilled.country.selectId = row.country?.id ?? "";
    prefilled.state.selectId = row.state?.id ?? "";
    prefilled.district.selectId = row.district?.id ?? "";
    prefilled.city.selectId = row.city?.id ?? "";
    prefilled[leaf.level].selectId = "__new__";
    prefilled[leaf.level].newName = leaf.location.name;
    setSelection(prefilled);
    setEditingId(leaf.location.id);
    setEditingLevel(leaf.level);
    setFeedback(null);
  };

  const rows = useMemo(() => {
    const statesOf = (parentId: string) =>
      byType.state.filter((location) => location.parentId === parentId);
    const districtsOf = (parentId: string) =>
      byType.district.filter((location) => location.parentId === parentId);
    const citiesOf = (parentId: string) =>
      byType.city.filter((location) => location.parentId === parentId);

    const out: AddressRow[] = [];
    for (const country of byType.country) {
      const states = statesOf(country.id);
      if (states.length === 0) {
        out.push({ key: country.id, country, state: null, district: null, city: null });
        continue;
      }
      for (const state of states) {
        const districts = districtsOf(state.id);
        if (districts.length === 0) {
          out.push({ key: `${country.id}-${state.id}`, country, state, district: null, city: null });
          continue;
        }
        for (const district of districts) {
          const cities = citiesOf(district.id);
          if (cities.length === 0) {
            out.push({ key: `${country.id}-${state.id}-${district.id}`, country, state, district, city: null });
            continue;
          }
          for (const city of cities) {
            out.push({ key: `${country.id}-${state.id}-${district.id}-${city.id}`, country, state, district, city });
          }
        }
      }
    }
    return out;
  }, [byType]);

  const renderCell = (location: Location | null) => {
    if (!location) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="flex items-center justify-between gap-2">
        <span>{location.name}</span>
        <div className="flex items-center gap-1">
          <StatusBadge active={location.active} />
        </div>
      </div>
    );
  };

  const columns = [
    { key: "sno", header: "S.No", align: "center" as const, className: "w-16", render: (_row: AddressRow, index: number) => index + 1 },
    { key: "country", header: "Country", render: (row: AddressRow) => renderCell(row.country) },
    { key: "state", header: "State", render: (row: AddressRow) => renderCell(row.state) },
    { key: "district", header: "District", render: (row: AddressRow) => renderCell(row.district) },
    { key: "city", header: "City", render: (row: AddressRow) => renderCell(row.city) },
    {
      key: "actions",
      header: "Action",
      align: "center" as const,
      render: (row: AddressRow) => {
        const leaf = [row.city, row.district, row.state, row.country].find(
          (location): location is Location => location !== null,
        );
        if (!leaf) return null;
        return (
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${leaf.name}`}
              onClick={() => handleEdit(row)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={leaf.active ? `Deactivate ${leaf.name}` : `Activate ${leaf.name}`}
              onClick={() => setConfirmTarget(leaf)}
            >
              <Power className="size-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const renderLevelField = (level: LocationLevel) => {
    const label = LOCATION_LEVEL_LABELS[level];
    const entry = selection[level];
    const parentLevelIdx = LOCATION_LEVEL_ORDER.indexOf(level) - 1;
    const parentLevel =
      parentLevelIdx >= 0 ? LOCATION_LEVEL_ORDER[parentLevelIdx] : null;
    const parentId = parentLevel ? selection[parentLevel].selectId : null;
    const candidates = parentId
      ? byType[level].filter((location) => location.parentId === parentId)
      : byType[level];

    const isNewMode = entry.selectId === "__new__";
    const disabled =
      saveMutation.isPending ||
      (parentLevel !== null && !parentId);

    return (
      <div key={level} className="space-y-1.5">
        <FormField id={`loc-${level}`} label={label} required>
          <div className="flex flex-col gap-1.5">
            <Select
              id={`loc-${level}`}
              value={entry.selectId}
              disabled={disabled}
              onChange={(event) => handleSelect(level, event.target.value)}
            >
              <option value="">Select--</option>
              {candidates.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
              <option value="__new__">+ Add new {label}</option>
            </Select>
            {isNewMode && (
              <Input
                id={`loc-${level}-name`}
                value={entry.newName}
                placeholder={`Enter new ${label} name`}
                autoFocus
                onChange={(event) => handleNewName(level, event.target.value)}
              />
            )}
          </div>
        </FormField>
        {parentLevel !== null && !parentId && (
          <p className="text-[11px] text-muted-foreground">
            Select a {LOCATION_LEVEL_LABELS[parentLevel]} first
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <PageHeader
        icon={MapPin}
        title="New Address"
        subtitle="Add and manage country, state, district and city locations"
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <FormSection
          title={editingId ? "Edit Location" : "Add New Location"}
          description={
            editingId
              ? "Edit the location name and save"
              : "Select or enter the location details and save"
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
                  : "Failed to save"}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {LOCATION_LEVEL_ORDER.map(renderLevelField)}
            </div>
            <FormActions
              onSubmit={handleSave}
              onReset={handleClear}
              submitting={saveMutation.isPending}
              submitLabel={editingId ? "Update" : "Save"}
            />
          </div>
        </FormSection>

        <FormSection title="Address List" description="All configured locations">
          <DataTable
            data={rows}
            rowKey={(row) => row.key}
            loading={locationsQuery.isLoading}
            emptyMessage="No locations found"
            columns={columns}
          />
        </FormSection>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title={confirmTarget?.active ? "Deactivate location?" : "Activate location?"}
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