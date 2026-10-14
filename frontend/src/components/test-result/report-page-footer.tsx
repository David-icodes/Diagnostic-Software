import Image from "next/image";
/** Report ending follows the results; never repeated as fixed page stationery. */
export function ReportPageFooter({ signatureNote, technicianName, signatureAsset = "/technician-signature.svg" }: {signatureNote?: string; technicianName?: string; signatureAsset?: "/technician-signature.svg" | null}) {
  return <div className="lis-report-page-footer">
    <p className="text-center font-bold">***** END OF REPORT *****</p>
    <div className="lis-report-signatories"><strong>Lab Technician</strong><div className="text-right">
      <div className="lis-technician-signature" aria-label="Lab technician signature">{signatureAsset && <Image unoptimized loading="eager" width={390} height={330} src={signatureAsset} alt="Lab technician signature" />}</div>
      {technicianName && <p>{technicianName}</p>}<strong>Lab Technician</strong>{signatureNote && <p>{signatureNote}</p>}
    </div></div>
    <div className="lis-report-footer-contact"><p>Plot No. 347, HMT Hills, Opp. Community Hall, Beside Park, Opp. JNTU, Kukatpally, Hyderabad - 500 085.</p><p>Contact : 9989 2209 38, 9440 6268 92, 040-40147350</p></div>
  </div>;
}
