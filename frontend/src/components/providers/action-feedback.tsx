"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CheckCircle2} from 'lucide-react';
import {ACTION_SUCCESS_EVENT} from '@/lib/action-feedback';
import {Dialog} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';

/** Root-level confirmation survives route changes and coalesces bulk updates. */
export function ActionFeedback(){
 const [messages,setMessages]=useState<string[]>([]),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  document.documentElement.dataset.actionFeedback='active';
  const receive=(event:Event)=>{const message=(event as CustomEvent<{message?:string}>).detail?.message;if(typeof message==='string'&&message.length<=160)setMessages(current=>current.includes(message)?current:[...current,message].slice(-3));};
  window.addEventListener(ACTION_SUCCESS_EVENT,receive);
  return()=>{window.removeEventListener(ACTION_SUCCESS_EVENT,receive);delete document.documentElement.dataset.actionFeedback;};
 },[]);
 const open=messages.length>0;
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;button.current?.focus();
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'||event.key==='Tab'){event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape')setMessages([]);else button.current?.focus();}};
  document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus();};
 },[open]);
 if(!messages.length)return null;
 return createPortal(<div className="lis-action-feedback fixed inset-0 z-[100] print:hidden"><Dialog open centered hideCloseButton title="Success" onOpenChange={open=>{if(!open)setMessages([]);}} className="max-w-sm text-center">
  <CheckCircle2 aria-hidden className="mx-auto mb-3 size-10 text-emerald-600"/>
  <div aria-live="polite" className="space-y-2">{messages.map(message=><p key={message}>{message}</p>)}</div>
  <Button ref={button} className="mt-5 min-w-24" onClick={()=>setMessages([])}>OK</Button>
 </Dialog></div>,document.body);
}
