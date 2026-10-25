import test from 'node:test';import assert from 'node:assert/strict';
import {smearReportText,repeatedSmearLabel} from './smear-report-text.ts';
test('smear presentation removes exact duplicate lines and repeated labels without merging distinct observations',()=>{
 assert.equal(smearReportText('Normochromic\nNormochromic'),'Normochromic');
 assert.equal(smearReportText('WITH IN NORMAL LIMITS\nWithin normal limits'),'WITH IN NORMAL LIMITS');
 assert.equal(smearReportText('Normocytic\nNormochromic'),'Normocytic\nNormochromic');
 assert.ok(repeatedSmearLabel('WITH IN NORMAL LIMITS','Within normal limits'));
 assert.equal(repeatedSmearLabel('R B C','Normocytic Normochromic'),false);
});

import {compactSmearParameters,compactSmearValue} from './smear-report-text.ts';
test('compact smear keeps RBC WBC platelets and hides the redundant standalone normal-limits heading',()=>{
 const rows=compactSmearParameters([{parameterName:'PERIPHERAL SMEAR',itemType:'SUBTITLE'},{parameterName:'R B C'},{parameterName:'WITH IN NORMAL LIMITS',itemType:'SUBTITLE'},{parameterName:'W B C'},{parameterName:'PLATELETS'}]);
 assert.deepEqual(rows.map(r=>r.parameterName),['R B C','W B C','PLATELETS']);
 assert.equal(compactSmearValue('R B C','Normocytosis\nNormochromic'),'Normocytosis');
 assert.equal(compactSmearValue('W B C','With in Normal Limits'),'With in Normal Limits');
 assert.equal(compactSmearParameters([{parameterName:'R B C'}])[0].subtitle,undefined);
});
