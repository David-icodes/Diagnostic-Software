"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
type Client={id:string;name:string;clientCode:string;active?:boolean};
type VendorAccount={id:string;username:string;name:string;clientId?:{id:string;name:string;clientCode:string}|null};
export function VendorPasswordSettings(){
 const {user}=useAuth();const cache=useQueryClient();
 const accounts=useQuery({queryKey:["vendor-users"],enabled:user?.role==="admin",queryFn:()=>api.get<VendorAccount[]>("/auth/vendor-users")});
 const clients=useQuery({queryKey:["vendor-management-clients"],enabled:user?.role==="admin",queryFn:()=>api.get<Client[]>("/auth/vendor-users/clients")});
 const [selected,setSelected]=useState<(Client & {configured:boolean})|null>(null);
 const [username,setUsername]=useState("");const [password,setPassword]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [success,setSuccess]=useState("");
 if(user?.role!=="admin")return null;
 return <section className="space-y-3">
  <h2 className="text-sm font-semibold">Vendor Password Configuration</h2>
  {(accounts.isPending||clients.isPending)&&<p role="status">Loading vendor accounts…</p>}
  {(accounts.isError||clients.isError)&&<p role="alert">Unable to load vendor accounts.</p>}
  <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Vendor client</th><th>Client code</th><th>Username</th><th>Action</th></tr></thead>
   <tbody>{clients.data?.map(client=>{const account=accounts.data?.find(row=>row.clientId?.id===client.id);return <tr key={client.id}><td>{client.name}{client.active===false?" (Inactive)":""}</td><td>{client.clientCode}</td><td>{account?.username??"Not configured"}</td><td><Button size="sm" variant="outline" disabled={client.active===false || busy || accounts.isPending || accounts.isError} onClick={()=>{setSelected({...client,configured:Boolean(account)});setUsername((account?.username??client.name).slice(0,50));setPassword("");setError("");setSuccess("");}}>{account?"Edit":"Set password"}</Button></td></tr>;})}{clients.data?.length===0&&<tr><td colSpan={4}>No vendor clients added.</td></tr>}</tbody></table></div>
  {selected&&<Card className="max-w-xl border-border shadow-sm"><CardContent className="p-4"><form className="space-y-3" onSubmit={async event=>{
   event.preventDefault();setBusy(true);setError("");setSuccess("");
   try{await api.patch(`/auth/vendor-users/clients/${encodeURIComponent(selected.id)}/credentials`,{username,password});setPassword("");setSelected({...selected,configured:true});await cache.invalidateQueries({queryKey:["vendor-users"]});setSuccess("Vendor credentials updated. Changed credentials invalidate existing vendor sessions.");}
   catch(failure){setError(failure instanceof Error?failure.message:"Unable to update vendor credentials.");}finally{setBusy(false);}
  }}>
   <div className="space-y-1.5"><Label htmlFor="vendor-credential-id">Client ID</Label><Input className="h-8 bg-muted/50" id="vendor-credential-id" readOnly value={selected.clientCode??""}/></div>
   <div className="space-y-1.5"><Label htmlFor="vendor-credential-username">Username</Label><Input className="h-8" id="vendor-credential-username" autoComplete="off" required minLength={3} maxLength={50} value={username} onChange={event=>setUsername(event.target.value)}/></div>
   <div className="space-y-1.5"><Label htmlFor="vendor-credential-password">Password</Label><Input className="h-8" id="vendor-credential-password" aria-describedby="vendor-password-help" type="password" autoComplete="new-password" minLength={6} maxLength={100} required={!selected.configured} value={password} onChange={event=>setPassword(event.target.value)}/></div>
   <p id="vendor-password-help" className="text-xs text-muted-foreground">Username uses the vendor client name (maximum 50 characters). Click Update to apply it. An initial password is required for a new login. Leave Password blank to keep an existing password.</p>
   <div className="flex gap-2"><Button size="sm" disabled={busy}>Update</Button><Button size="sm" type="button" disabled={busy} variant="outline" onClick={()=>{setSelected(null);setPassword("");}}>Cancel</Button></div>
  </form></CardContent></Card>}
  {error&&<p role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
 </section>;
}
