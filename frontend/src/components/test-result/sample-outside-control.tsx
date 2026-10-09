"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createPortal } from "react-dom";
import { fetchOutsideLabs } from "@/services/reports";
import { updateSampleOutside } from "@/services/test-results";
import type { LabSampleRow } from "@/types/test-result";
import type { BillItem } from "@/types/billing";
import { queryKeys } from "@/lib/query-keys";

export function SampleOutsideControl({ sample, item }: { sample: LabSampleRow; item: BillItem }) {
  const cache = useQueryClient();
  const initialId = sample.outsideLabId === undefined ? item.outsideLabId ?? "" : sample.outsideLabId ?? "";
  const [out, setOut] = useState(Boolean(initialId));
  const [centreId, setCentreId] = useState(initialId);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const centres = useQuery({ queryKey: ["outside-labs", "sample-outside"], queryFn: fetchOutsideLabs });
  const save = useMutation({
    mutationFn: () => updateSampleOutside(sample.id, { out, outsideLabId: out ? centreId : null }),
    onSuccess: (updated) => {
      cache.setQueriesData<{ data: LabSampleRow[] }>({ queryKey: queryKeys.labSamples }, (current) =>
        current?.data ? { ...current, data: current.data.map((row) => row.id === updated.id ? updated : row) } : current);
      void cache.invalidateQueries({ queryKey: queryKeys.labSamples });
      void cache.invalidateQueries({ queryKey: queryKeys.labBills });
      setError(null);
      setOpen(false);
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "Unable to update outside assignment"),
  });
  const dirty = out !== Boolean(initialId) || (out ? centreId : "") !== initialId;
  return <><td className="lis-result-out-cell" onClick={(event) => event.stopPropagation()}>
      <input type="checkbox" aria-label={`OUT for ${item.testName}`} checked={out} disabled={save.isPending}
        onChange={(event) => { setOut(event.target.checked); setCentreId(""); setError(null); if (event.target.checked) setOpen(true); }} />
    {open && out && createPortal(<Dialog open centered size="lg" title="Lab Center Details" className="lis-sample-centre-dialog" onOpenChange={setOpen}>
      <div className="lis-sample-centre-fields"><label htmlFor={`outside-${sample.id}`}>Select Lab Center</label>
      <select id={`outside-${sample.id}`} aria-label={`Outside lab for ${item.testName}`} value={centreId} disabled={save.isPending || centres.isPending}
      onChange={(event) => { setCentreId(event.target.value); setError(null); }}>
      <option value="">Select outside lab</option>
      {initialId && !centres.data?.some((centre) => centre.id === initialId) && <option value={initialId}>{sample.outsideLabName || item.outsideLabName || "Current outside lab"}</option>}
      {(centres.data ?? []).map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
    </select></div>
    {out && !centreId && <p role="alert">Select an outside lab.</p>}
    {centres.isError && <p role="alert">Unable to load outside labs.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="flex justify-end gap-2 mt-3"><Button type="button" disabled={!dirty || save.isPending || !centreId} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Apply"}</Button><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>Close</Button></div>
    </Dialog>, document.body)}
    </td><td className="lis-result-centre-cell" onClick={(event) => event.stopPropagation()}>
    {out && <button type="button" className="lis-sample-centre-button" onClick={() => setOpen(true)} aria-label={`Lab Center for ${item.testName}`}>{centres.data?.find((centre) => centre.id === centreId)?.name || sample.outsideLabName || "Lab Center"}</button>}
    {out && !centreId && <span role="alert">Select an outside lab.</span>}
    {centres.isError && out && <span role="alert">Unable to load outside labs.</span>}
    {error && <span role="alert">{error}</span>}
    {dirty && !open && <Button type="button" size="sm" variant="outline" disabled={save.isPending || (out && !centreId)} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Apply"}</Button>}
  </td></>;
}
