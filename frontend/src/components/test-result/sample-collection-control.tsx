"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/database/confirm-dialog";
import { updateSampleStatus } from "@/services/test-results";
import { invalidateRoots, queryKeys } from "@/lib/query-keys";
import type { LabSampleRow } from "@/types/test-result";

export function SampleCollectionControl({ sample, testName }: { sample: LabSampleRow; testName: string }) {
  const cache = useQueryClient();
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collected, setCollected] = useState(false);
  const save = useMutation({
    mutationFn: () => updateSampleStatus(sample.id, { status: "COLLECTED" }),
    onSuccess: (updated) => {
      setCollected(true); setOpen(false); setError(null);
      cache.setQueriesData<{ data: LabSampleRow[] }>({ queryKey: queryKeys.labSamples }, (current) =>
        current?.data ? { ...current, data: current.data.map((row) => row.id === updated.id ? updated : row) } : current);
      void invalidateRoots(cache, queryKeys.labSamples, queryKeys.labBills, queryKeys.dashboard);
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "Unable to collect this sample."),
    onSettled: () => { pending.current = false; },
  });
  return <span onClick={(event) => event.stopPropagation()}>
    <input type="checkbox" checked={collected} disabled={collected || save.isPending} aria-label={`Collect sample for ${testName}`}
      onChange={() => { setError(null); setOpen(true); }} className="size-3.5 accent-primary" />
    <ConfirmDialog open={open} title="Confirm sample collection?" description={error || `Mark the sample for ${testName} as Collected?`}
      confirmLabel="Collect" loading={save.isPending} onOpenChange={(value) => { if (!pending.current) setOpen(value); }}
      onConfirm={() => { if (pending.current) return; pending.current = true; save.mutate(); }} />
  </span>;
}
