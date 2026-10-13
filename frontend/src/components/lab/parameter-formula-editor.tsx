"use client";
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Dialog} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select} from '@/components/ui/select';
import {api} from '@/lib/api';
import {CALCULATION_FORMULAS} from '@/lib/configured-calculations';
import {fetchLabParameters} from '@/services/lab-masters';
import type {ParameterRow} from '@/types/lab-masters';
import {formulaSourceOptions,validFormulaSources,loadFormulaSources} from '@/lib/formula-source-options';

export function ParameterFormulaEditor({parameter,onClose,onChanged}:{parameter:ParameterRow;onClose:()=>void;onChanged:()=>void}){
 const existing=parameter.calculation;
 const [formulaId,setFormulaId]=useState(existing?.formulaId??'');
 const [expression,setExpression]=useState(existing?.expression??'');
 const [sources,setSources]=useState<string[]>(existing?.dependencyIds??[]);
 const [active,setActive]=useState(existing?.enabled!==false);
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const query=useQuery({queryKey:['lab-test-parameters','formula-editor-sources',parameter.testId],queryFn:()=>loadFormulaSources(parameter.testId,page=>fetchLabParameters({testId:parameter.testId,limit:100,page})),staleTime:0});
 const formula=CALCULATION_FORMULAS.find(f=>f.id===formulaId);
 const eligible=formulaSourceOptions(query.data??[],parameter);
 const isTargetValid=(parameter.itemType??'PARAMETER')==='PARAMETER';
 const canSave=!!formula&&isTargetValid&&!query.isPending&&!query.isError&&validFormulaSources(sources,formula.sources.length,query.data??[],parameter);
 async function save(){
  setBusy(true);
  try{
   await api.post(`/lab-test-parameters/${parameter.id}/calculation`,{
    unit:parameter.unit??'',
    calculation:{enabled:active,formulaId,expression:expression||undefined,dependencyIds:sources,precision:formula?.precision??2,overwrite:'CONFIRM'}
   });
   setMessage('Formula configuration saved.');
   onChanged();
  }catch(e){
   setMessage(e instanceof Error?e.message:'Save failed');
  }finally{
   setBusy(false);
  }
 }
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}} title={`Formula configuration: ${parameter.parameterName}`}><div className="space-y-3">
 <label className="block">Status
  <Select value={active?'active':'inactive'} onChange={e=>setActive(e.target.value==='active')}>
   <option value="active">Active</option>
   <option value="inactive">Inactive</option>
  </Select>
 </label>
 <label className="block">Formula
  <Select value={formulaId} onChange={e=>{setFormulaId(e.target.value);setExpression(CALCULATION_FORMULAS.find(f=>f.id===e.target.value)?.expression??'');setSources([]);}}>
   <option value="">Select formula</option>
   {CALCULATION_FORMULAS.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
  </Select>
 </label>
 {!isTargetValid&&<p role="status">This item is a {parameter.itemType==='SUBTITLE'?'subtitle':'text area'}. Only result parameters can be calculation targets.</p>}
 {formula?.sources.map((name,index)=><label className="block" key={index}>Source {index+1}: {name}
  <Select disabled={query.isPending||query.isError||eligible.length===0} value={sources[index]??''} onChange={e=>setSources(current=>{const next=[...current];next[index]=e.target.value;return next;})}>
   <option value="">Select exact parameter</option>
   {sources[index]&&!eligible.some(p=>p.id===sources[index])&&<option value={sources[index]} disabled>Saved source {sources[index]} — unavailable</option>}
   {eligible.map(p=><option key={p.id} value={p.id}>{p.parameterName} · {p.id}</option>)}
  </Select>
 </label>)}
 {formula&&!query.isPending&&!query.isError&&eligible.length===0&&<p role="status">No active source parameters are available for this test. Subtitles and text areas cannot be used as sources.</p>}
 {query.isPending&&<p role="status">Loading source parameters…</p>}
 <label className="block">Expression
  <Input value={expression} onChange={e=>setExpression(e.target.value)} disabled={!formula?.expression}/>
 </label>
 <p className="text-sm">Display unit: {parameter.unit||'blank'} · Rounding: HALF_UP</p>
 {message&&<p role="status">{message}</p>}{query.error&&<p role="alert">Unable to load source parameters.</p>}
 <Button type="button" disabled={busy||!canSave} onClick={save}>Save</Button>
 <Button type="button" variant="outline" onClick={onClose}>Close</Button>
 </div></Dialog>;
}
