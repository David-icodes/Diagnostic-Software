"use client";
import {useEffect,useState} from 'react';
import {Dialog} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {useAuth} from '@/hooks/use-auth';
import {communicationRequest} from '@/services/communications';
const pending=new Set<string>();
export function trackDocumentJob(id:string){pending.add("/jobs/"+encodeURIComponent(id));}
export function trackCampJob(id:string){pending.add("/camp/jobs/"+encodeURIComponent(id));}
export function CommunicationJobNotifications(){
 const {user}=useAuth(),[error,setError]=useState('');
 useEffect(()=>{if(user?.role!=='admin')return;let stopped=false,busy=false;const timer=setInterval(async()=>{if(busy||!pending.size)return;busy=true;try{for(const id of [...pending].slice(0,10)){try{const job=await communicationRequest<{state:string;reason?:string}>(id);if(stopped)return;if(['accepted','blocked','failed','uncertain'].includes(job.state)){pending.delete(id);if(job.state!=='accepted')setError(job.reason||'The message could not be sent.');}}catch{/* Keep the durable job; a later poll can recover a temporary connection failure. */}}}finally{busy=false;}},3000);return()=>{stopped=true;clearInterval(timer);};},[user?.id,user?.role]);
 return <Dialog open={Boolean(error)} centered title="WhatsApp message" onOpenChange={open=>{if(!open)setError('');}}><p role="alert">{error}</p><div className="mt-4 flex justify-end"><Button onClick={()=>setError('')}>OK</Button></div></Dialog>;
}
