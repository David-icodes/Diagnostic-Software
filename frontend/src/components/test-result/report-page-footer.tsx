import Image from "next/image";
/** Report ending follows the results; never repeated as fixed page stationery. */
export function ReportPageFooter({ signatureNote, technicianName, signatureAsset = "/technician-signature.svg",reportQrDataUrl }: {signatureNote?: string; technicianName?: string; reportQrDataUrl?:string;signatureAsset?: "/technician-signature.svg" | null}) {
  return <div className="lis-report-page-footer">
    <p className="text-center font-bold">***** END OF REPORT *****</p>
    <div className="lis-report-signatories" data-has-qr={Boolean(reportQrDataUrl)}><strong>Lab Technician</strong>{reportQrDataUrl&&<div className="lis-report-qr" aria-label="Report QR"><Image src={reportQrDataUrl} alt="Scan to view this report" width={86} height={86} unoptimized loading="eager"/></div>}<div className="text-right">
      <div className="lis-technician-signature" aria-label="Lab technician signature">{signatureAsset && <Image unoptimized loading="eager" width={390} height={330} src={signatureAsset} alt="Lab technician signature" />}</div>
      {technicianName && <p>{technicianName}</p>}<strong>Lab Technician</strong>{signatureNote && <p>{signatureNote}</p>}
    </div></div>
  </div>;
}
