"use client";

import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/database/confirm-dialog";
import { saveOutsideLab, deleteOutsideLab, type OutsideLabInput } from "@/services/reports";
import type { OutsideLabOption } from "@/types/reports";

const EMPTY: OutsideLabInput = { code: "", name: "", address: "", city: "", phone: "" };
export function OutsideLabManager({ labs, onSaved }: { labs: OutsideLabOption[]; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState<OutsideLabOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh() { await Promise.all([onSaved(), cache.invalidateQueries({ queryKey: ["outside-labs"] })]); }
  async function save() {
    if (busy) return; setBusy(true); setError("");
    try { await saveOutsideLab(form, editing); await refresh(); setForm(EMPTY); setEditing(undefined); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save outside lab"); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true); setError("");
    try { await deleteOutsideLab(deleting.id); await refresh(); if (editing === deleting.id) { setEditing(undefined); setForm(EMPTY); } setDeleting(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to delete outside lab"); }
    finally { setBusy(false); }
  }
  if (!user || user.role === "operator") return null;
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => { setError(""); setOpen(true); }}>Create Outside Lab</Button>
    <Dialog open={open} centered size="lg" title="Outside Labs" onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <div className="grid grid-cols-2 gap-3">
        {([ ["code", "Code"], ["name", "Outside Lab Name"], ["address", "Address"], ["city", "City"], ["phone", "Phone"] ] as const).map(([key,label]) =>
          <label key={key} className="text-xs">{label}{(key === "code" || key === "name") && " *"}
            <Input value={form[key] ?? ""} disabled={busy} onChange={(e) => setForm({ ...form, [key]: e.target.value })} maxLength={key === "name" ? 120 : key === "address" ? 200 : key === "city" ? 80 : 30} />
          </label>)}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="my-3 flex gap-2"><Button type="button" disabled={busy || form.code.trim().length < 2 || form.name.trim().length < 2} onClick={save}>{busy ? "Saving…" : editing ? "Update" : "Create Outside Lab"}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditing(undefined); setForm(EMPTY); setError(""); }}>Clear</Button></div>
      <div className="max-h-64 overflow-auto"><table className="w-full text-xs"><thead><tr><th className="text-left">Code</th><th className="text-left">Outside Lab</th><th className="text-left">City</th><th>Actions</th></tr></thead><tbody>
        {labs.map((lab) => <tr key={lab.id} className="border-t"><td>{lab.code}</td><td>{lab.name}</td><td>{lab.city}</td><td className="text-right">
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditing(lab.id); setForm({ code: lab.code, name: lab.name, city: lab.city ?? "", address: lab.address ?? "", phone: lab.phone ?? "" }); setError(""); }}>Edit</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setDeleting(lab); setError(""); }}>Delete</Button>
        </td></tr>)}
      </tbody></table>{!labs.length && <p className="p-2">No outside labs found.</p>}</div>
    </Dialog>
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={(value) => { if (!value && !busy) setDeleting(null); }} title="Delete Outside Lab" description={error || `Delete ${deleting?.name ?? "this lab"}? Labs with existing assignments cannot be deleted.`} confirmLabel="Delete" loading={busy} onConfirm={remove} />
  </>;
}
