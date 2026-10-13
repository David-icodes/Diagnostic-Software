import type {ParameterRow} from '@/types/lab-masters';

export function formulaSourceOptions(parameters: ParameterRow[], target: Pick<ParameterRow,'id'|'testId'>) {
  return parameters.filter(p => p.testId === target.testId && p.id !== target.id && p.active !== false &&
    (p.itemType ?? 'PARAMETER') === 'PARAMETER' && p.itemType !== 'SUBTITLE' && p.itemType !== 'TEXT_AREA');
}

export function validFormulaSources(ids: string[], required: number, parameters: ParameterRow[], target: Pick<ParameterRow,'id'|'testId'>) {
  const eligible = new Set(formulaSourceOptions(parameters,target).map(p=>p.id));
  return ids.length === required && new Set(ids).size === required && ids.every(id=>eligible.has(id));
}

export async function loadFormulaSources(testId:string, fetchPage:(page:number)=>Promise<{data:ParameterRow[];pagination:{totalPages:number}}>) {
  const rows:ParameterRow[]=[];
  for(let page=1;;page++){
    const response=await fetchPage(page);
    if(!Number.isInteger(response.pagination.totalPages)||response.pagination.totalPages<1)throw new Error('Invalid parameter pagination.');
    for(const parameter of response.data){
     if(parameter.testId!==testId)throw new Error('Source response contains a different parent test.');
     if(rows.some(p=>p.id===parameter.id))throw new Error('Source response contains duplicate parameter IDs.');
     rows.push(parameter);
    }
    if(page>=response.pagination.totalPages)return rows;
  }
}
