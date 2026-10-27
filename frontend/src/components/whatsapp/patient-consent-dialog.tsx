"use client";
import {useQuery,useQueryClient} from '@tanstack/react-query';import {Dialog} from '@/components/ui/dialog';import {ConsentEditor,type CampaignPatient} from './bulk-whatsapp-panel';import {communicationRequest,type CommunicationConsent} from '@/services/communications';
export function PatientConsentDialog({patient,onClose}:{patient:CampaignPatient;onClose:()=>void}){
 const cache=useQueryClient(),query=useQuery({queryKey:['patient-whatsapp-consent',patient.id],queryFn:()=>communicationRequest<{data:CommunicationConsent[]}>('/consents/read','POST',{patientIds:[patient.id]}),retry:false,gcTime:0});
 if(!query.data)return <Dialog open centered title="WhatsApp consent" onOpenChange={open=>{if(!open)onClose();}}><p role={query.isError?'alert':'status'}>{query.isError?'Consent could not be loaded.':'Checking consent…'}</p></Dialog>;
 return <ConsentEditor patient={patient} current={query.data.data.find(c=>c.patientId===patient.id)} onClose={onClose} onSaved={async()=>{await cache.invalidateQueries({queryKey:['camp-audience']});onClose();}}/>;
}
