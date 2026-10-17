import {selectedColumns} from "@/lib/catalogue-selection";
import {formatMoney} from "@/lib/utils";
import type {PackageMember} from "@/lib/package-billing";
/** Bill/invoice presentation only. Never used by the selected-tests composer. */
export function PackageInvoiceDetails({members,total}:{members:PackageMember[];total:number}){
 return <div className="lis-package-invoice-details">
  <p className="lis-package-allocation-label">Included tests · billed allocation</p>
  <div className="lis-package-member-grid" data-columns={members.length>5?2:1}>
   {selectedColumns(members).map((column,index)=><ol key={index} start={index*5+1}>{column.map((member,offset)=><li key={member.testId}><span>{index*5+offset+1}. {member.testName}</span><span className="lis-package-member-amount">{member.billedAmount===undefined?"—":`₹${formatMoney(member.billedAmount)}`}</span></li>)}</ol>)}
  </div>
  <div className="lis-package-fixed-total"><span>Fixed package total</span><strong>₹{formatMoney(total)}</strong></div>
 </div>;
}
