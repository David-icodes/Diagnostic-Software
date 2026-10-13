export function parameterParentOptions<T extends {id:string;testName:string}>(
  activeOptions:T[],
  editingParent:{testId:string;testName?:string;departmentId?:string}|null,
  departmentId:string,
):Array<T|{id:string;testName:string}>{
  if(!editingParent||!editingParent.testName||activeOptions.some(t=>t.id===editingParent.testId)||
    (departmentId&&editingParent.departmentId!==departmentId))return activeOptions;
  return [...activeOptions,{id:editingParent.testId,testName:editingParent.testName}];
}
