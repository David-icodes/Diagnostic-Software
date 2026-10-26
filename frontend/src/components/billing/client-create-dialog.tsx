"use client";
import { useState } from "react";
import { useMutation,useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/services/billing";
import type { LabClient } from "@/types/billing";
export function ClientCreateDialog({onCreated}:{onCreated:(client:LabClient)=>void}){
 const [open,setOpen]=useState(false),[name,setName]=useState(""),[city,setCity]=useState("");const cache=useQueryClient();
 const save=useMutation({mutationFn:()=>createClient({name:name.trim(),city:city.trim(),active:true}),onSuccess:client=>{void cache.invalidateQueries({queryKey:["lab-clients"]});void cache.invalidateQueries({queryKey:["vendor-management-clients"]});onCreated(client);setOpen(false);setName("");setCity("");}});
 return <><Button type="button" size="sm" variant="outline" onClick={()=>{save.reset();setOpen(true);}}>Add Client</Button><Dialog open={open} onOpenChange={value=>{if(!save.isPending)setOpen(value);}} title="Create Client" size="md"><form className="space-y-3" onSubmit={event=>{event.preventDefault();save.mutate();}}><label className="block">Client Name<Input aria-label="Client Name" value={name} onChange={event=>setName(event.target.value)} minLength={2} maxLength={120} required disabled={save.isPending}/></label><label className="block">City<Input aria-label="Client City" value={city} onChange={event=>setCity(event.target.value)} maxLength={100} disabled={save.isPending}/></label>{save.error&&<p role="alert">{save.error.message}</p>}<Button type="submit" disabled={save.isPending}>{save.isPending?"Saving…":"Save Client"}</Button></form></Dialog></>;
}
