import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formulaSourceOptions,validFormulaSources,loadFormulaSources} from './formula-source-options.ts';
import type {ParameterRow} from '@/types/lab-masters';

test('formula sources use exact same-test active PARAMETER IDs and preserve an invalid saved ID for review',()=>{
 const target={id:'target',testId:'test'};
 const parameters=[
  {id:'hb',testId:'test',active:true,resultType:'TEXT'},
  {id:'rbc',testId:'test',active:true,resultType:'TEXT'},
  {id:'number',testId:'test',active:true,resultType:'NUMBER'},
  {id:'other-test',testId:'other',active:true,resultType:'NUMBER'},
  {id:'inactive',testId:'test',active:false,resultType:'NUMBER'},
  {id:'heading',testId:'test',active:true,resultType:'NUMBER',itemType:'SUBTITLE'},
  {id:'narrative',testId:'test',active:true,resultType:'TEXTAREA',itemType:'TEXT_AREA'},
  {id:'target',testId:'test',active:true,resultType:'TEXT'},
 ] as ParameterRow[];
 assert.deepEqual(formulaSourceOptions(parameters,target).map(p=>p.id),['hb','rbc','number']);
 assert.equal(validFormulaSources(['hb','rbc'],2,parameters,target),true);
 for(const ids of [['hb','hb'],['hb','other-test'],['hb','missing'],['hb','heading'],['hb','narrative'],['hb']])assert.equal(validFormulaSources(ids,2,parameters,target),false);
 assert.equal(validFormulaSources(['hb'],1,[],target),false);
});

test('source loading follows server pagination instead of assuming limit 1000 is supported',async()=>{
 const calls:number[]=[];
 const rows=await loadFormulaSources('test',async page=>{calls.push(page);return {data:[{id:`p${page}`,testId:'test',active:true,resultType:'NUMBER'} as ParameterRow],pagination:{totalPages:2}};});
 assert.deepEqual(calls,[1,2]);assert.deepEqual(rows.map(p=>p.id),['p1','p2']);
 await assert.rejects(loadFormulaSources('test',async()=>({data:[{id:'other',testId:'other'} as ParameterRow],pagination:{totalPages:1}})),/different parent/);
 await assert.rejects(loadFormulaSources('test',async()=>({data:[{id:'same',testId:'test'} as ParameterRow],pagination:{totalPages:2}})),/duplicate/);
});
