"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function VendorPasswordSettings() {
  const { user } = useAuth(); const [id,setId]=useState(""); const [password,setPassword]=useState(""); const [confirmation,setConfirmation]=useState(""); const [feedback,setFeedback]=useState(""); const [busy,setBusy]=useState(false);
  const users = useQuery({queryKey:["vendor-users"],enabled:user?.role === "admin",queryFn:()=>api.get<{id:string;username:string;name:string}[]>("/auth/vendor-users")});
  if (user?.role !== "admin") return null;
  return <form className="mt-5 max-w-xl space-y-3 border p-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setFeedback("");try{await api.post(`/auth/vendor-users/${encodeURIComponent(id)}/password`,{newPassword:password,confirmPassword:confirmation});setPassword("");setConfirmation("");setFeedback("Vendor password changed. Existing vendor sessions are invalidated.");}catch(error){setFeedback(error instanceof Error?error.message:"Password change failed");}finally{setBusy(false);}}}>
    <h2>Vendor Client Password Settings</h2>{users.isError && <p role="alert">{users.error.message}</p>}<label>Vendor account<select required className="block w-full border p-2" value={id} onChange={e=>setId(e.target.value)}><option value="">Select vendor account</option>{users.data?.map(row=><option key={row.id} value={row.id}>{row.name} ({row.username})</option>)}</select></label>
    <label>New password<Input type="password" autoComplete="new-password" minLength={6} maxLength={100} required value={password} onChange={e=>setPassword(e.target.value)} /></label><label>Confirm password<Input type="password" autoComplete="new-password" required value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></label><Button disabled={busy || !id || password!==confirmation}>Change vendor password</Button>{feedback && <p role="status">{feedback}</p>}
  </form>;
}
