import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
export const REPORT_STAGES=['authentication','authorization_validation','lookup','data_retrieval','eligibility','snapshot_assembly','browser_acquire','context_setup','navigation','readiness','asset_readiness','pdf_creation','stationery','integrity','revalidation','final_data_retrieval','final_eligibility','final_snapshot_assembly','response_delivery','qr_creation','share_publish'] as const;
export type ReportStage=typeof REPORT_STAGES[number];
/** Fixed labels and numeric measurements only: never identifiers, URLs or report content. */
export function reportTimings(now=()=>performance.now()){
 const started=now(),stages:Partial<Record<ReportStage,number>>={};
 const elapsed=()=>Math.round((now()-started)*100)/100;
 return {id:randomUUID(),stages,elapsed,
 start(){return now();},
 mark(stage:ReportStage,since:number){stages[stage]=Math.round(((stages[stage]??0)+now()-since)*100)/100;},
 async measure<T>(stage:ReportStage,work:()=>Promise<T>):Promise<T>{const start=now();try{return await work();}finally{stages[stage]=Math.round(((stages[stage]??0)+now()-start)*100)/100;}},
 header(){return Object.entries(stages).map(([name,ms])=>`${name};dur=${ms}`).join(', ');}};
}
export type ReportTimings=ReturnType<typeof reportTimings>;
