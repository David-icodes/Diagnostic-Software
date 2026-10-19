import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseOspDob, compactOspDob, ospBirthAge} from './osp-dob.ts';
const now=new Date('2026-10-13T12:00:00Z');
test('OSP DDMMYYYY converts exactly, validates leap years and refuses impossible/future/partial dates',()=>{
 assert.deepEqual(parseOspDob('07092002',now),{date:'2002-09-07'});
 assert.equal(parseOspDob('29022024',now).date,'2024-02-29');
 for(const value of ['29022023','31042002','0713','14102026','00000000','abcd2002']) assert.ok(parseOspDob(value,now).error,value);
 assert.equal(parseOspDob('20020907',now).date,'0907-02-20'); // DDMMYYYY exclusively, never YYYYMMDD.
 assert.deepEqual(parseOspDob('',now),{date:''});
 assert.equal(compactOspDob('2002-09-07'),'07092002');
});
test('OSP age uses the business calendar across birthdays and year boundaries',()=>{
 assert.deepEqual(ospBirthAge('2002-09-07',now),{years:24,months:1,days:6});
 assert.equal(ospBirthAge('2002-10-14',now).years,23);
 assert.equal(ospBirthAge('2002-10-13',now).years,24);
 assert.equal(ospBirthAge('2002-12-31',new Date('2026-01-01T12:00:00Z')).years,23);
});

test('DOB remains valid after the shared field stores its canonical date',()=>{
 const saved=parseOspDob('07092002',now).date;
 assert.deepEqual(parseOspDob(saved,now),{date:'2002-09-07'});
 for(const value of ['2023-02-29','2002-04-31','2026-10-14']) assert.ok(parseOspDob(value,now).error);
});
