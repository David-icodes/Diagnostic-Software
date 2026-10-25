import {formatMoney} from "@/lib/utils";
import type {PackageMember} from "@/lib/package-billing";
/** Bill/invoice presentation only. Never used by the selected-tests composer. */
export function PackageInvoiceDetails({members,total}:{members:PackageMember[];total:number}){
 return <div className="lis-package-invoice-details">
  <ol className="lis-package-member-list">{members.map(member=><li key={member.testId} className="flex justify-between gap-3"><span>{member.testName}</span><span className="lis-package-member-amount">{member.billedAmount===undefined?"—":`₹${formatMoney(member.billedAmount)}`}</span></li>)}</ol>
  <div className="lis-package-fixed-total"><span>Total</span><strong>₹{formatMoney(total)}</strong></div>
 </div>;
}
