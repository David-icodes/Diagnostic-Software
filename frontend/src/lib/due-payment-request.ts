/** Only an opaque retry UUID is stored; no names, amounts, credentials or report data. */
export function duePaymentRequest(storage:Pick<Storage,'getItem'|'setItem'>,billId:string,uuid:()=>string=()=>crypto.randomUUID()):string {
 const key=`lis-due-request:${billId}`,previous=storage.getItem(key);
 if(previous&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(previous))return previous;
 const request=uuid();storage.setItem(key,request);return request;
}
