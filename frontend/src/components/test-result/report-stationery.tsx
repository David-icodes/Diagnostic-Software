import Image from 'next/image';
/** Original supplied artwork. Kept whole: no logo stretching, cropping or rebuilt address. */
export function ReportStationery({includeHeader}:{includeHeader:boolean}){
 return includeHeader?<div className="lis-report-stationery" aria-hidden="true"><Image src="/report-stationery.jpg" alt="" width={2480} height={3507} unoptimized loading="eager"/></div>:null;
}
