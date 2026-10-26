/** The caller supplies the existing approved classification; no new thresholds. */
export function resultPresentation(abnormal:boolean,manuallyChanged=false,context:'entry'|'report'='entry'):string {
 return abnormal?`lis-abnormal-result font-black ${context==='report'?'text-black':'text-red-700'}`:manuallyChanged && context==='entry'?'lis-manually-edited font-bold text-black':'font-normal text-black';
}
