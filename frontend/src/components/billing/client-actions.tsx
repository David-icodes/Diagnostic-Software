"use client";
import {useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {Pencil, Trash2} from "lucide-react";
import {useAuth} from "@/hooks/use-auth";
import {api} from "@/lib/api";
import {Button} from "@/components/ui/button";
import {Dialog} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import type {LabClient} from "@/types/billing";

export function ClientActions({client,onChanged,onDeleted,deletionDisabled=false}:{client:LabClient;deletionDisabled?:boolean;onChanged?:(client:LabClient)=>void;onDeleted?:()=>void}) {
 const {user}=useAuth();const cache=useQueryClient();
 const [mode,setMode]=useState<"edit"|"delete"|null>(null),[name,setName]=useState(client.name),[city,setCity]=useState(client.city??"");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 if(user?.role!=="admin")return null;
 const open=(next:"edit"|"delete")=>{setName(client.name);setCity(client.city??"");setError("");setMode(next);};
 async function save(){if(busy)return;setBusy(true);setError("");try{
  if(mode==="delete") {await api.delete(`/auth/vendor-users/clients/${encodeURIComponent(client.id)}`);onDeleted?.();}
  else {const result=await api.patch<{client:LabClient}>(`/auth/vendor-users/clients/${encodeURIComponent(client.id)}`,{name:name.trim(),city:city.trim()});onChanged?.(result.client);}
  await Promise.all([cache.invalidateQueries({queryKey:["lab-clients"]}),cache.invalidateQueries({queryKey:["vendor-management-clients"]}),cache.invalidateQueries({queryKey:["vendor-users"]})]);setMode(null);
 }catch(failure){setError(failure instanceof Error?failure.message:"Unable to save client");}finally{setBusy(false);}}
 return <><span className="inline-flex shrink-0 items-center gap-3 px-2"><Button type="button" size="sm" variant="ghost" aria-label={`Edit ${client.name}`} title="Edit client" onClick={()=>open("edit")}><Pencil className="size-4"/></Button><Button type="button" size="sm" variant="ghost" aria-label={`Delete ${client.name}`} title={deletionDisabled?"Select another billing client before deleting this client":"Delete client"} disabled={deletionDisabled} onClick={()=>open("delete")}><Trash2 className="size-4 text-destructive"/></Button></span>
 <Dialog open={mode!==null} centered title={mode==="delete"?"Delete client?":"Edit client"} onOpenChange={value=>{if(!value&&!busy)setMode(null);}}>
 <form className="space-y-3" onSubmit={event=>{event.preventDefault();void save();}}>
 {mode==="delete"?<p>Remove {client.name} from active clients and disable its vendor login? Existing bills, tariffs and history will be retained.</p>:<><label className="block">Client name<Input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={120} disabled={busy}/></label><label className="block">City<Input value={city} onChange={e=>setCity(e.target.value)} maxLength={100} disabled={busy}/></label></>}
 {error&&<p role="alert">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setMode(null)}>Cancel</Button><Button disabled={busy}>{busy?"Saving…":mode==="delete"?"Delete client":"Save client"}</Button></div>
 </form></Dialog></>;
}
