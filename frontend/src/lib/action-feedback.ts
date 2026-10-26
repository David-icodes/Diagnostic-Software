export const ACTION_SUCCESS_EVENT = 'lis:action-success';

/** Fixed UI text only; never include response bodies, patient details or identifiers. */
export function actionSuccessMessage(method:string,path:string):string|undefined {
 if(method==='GET')return;
 const route=path.split('?')[0];
 // Bill creation already opens the centered save-and-print prompt.
 if(method==='POST'&&route==='/lab-bills')return;
 // The send flow already has its own centered delivery-result dialog.
 if(route==='/api/whatsapp/lis/send')return;
 if(/\/[^/]*(?:preview|resolve|search|eligibility|validate|review|document-data|delivery|render-data)[^/]*(?:\/|$)/.test(route))return;
 if(route==='/auth/change-password')return 'Password updated successfully.';
 if(/\/whatsapp\/(?:lis\/send|test-message)$/.test(route))return 'Message sent successfully.';
 if(!/^\/(?:patients|lab-bills|lab-samples|lab-test-results|lab-test-parameters|lab-tests|lab-tariffs|client-tariffs|commission-mappings|departments|doctors|database|vendor-portal|vendor-clients|lab-technicians|reports\/outside-labs)(?:\/|$)/.test(route))return;
 if(method==='DELETE')return 'Deleted successfully.';
 if(/\/results\/submit$/.test(route))return 'Test results submitted successfully.';
 if(/\/report-uploads$/.test(route))return 'Report uploaded successfully.';
 if(/\/collect-due$/.test(route))return 'Payment saved successfully.';
 if(/\/cancel$/.test(route))return 'Bill cancelled successfully.';
 return method==='POST'?'Saved successfully.':'Updated successfully.';
}

export function announceActionSuccess(method:string,path:string){
 const message=actionSuccessMessage(method,path);
 if(message&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent(ACTION_SUCCESS_EVENT,{detail:{message}}));
}
