import { describe, expect, it, vi } from 'vitest';
import { saveMedicalHistory } from './saveMedicalHistory';
describe('medical history writes',()=>{
 it('recovers an overlapping first insert by updating the existing patient row',async()=>{
  const eq=vi.fn(async()=>({error:null}));const update=vi.fn(()=>({eq}));const insert=vi.fn(async()=>({error:{code:'23505'}}));
  const client={from:()=>({insert,update})};
  expect(await saveMedicalHistory(client,'patient',{allergies:'new'},false)).toEqual({error:null});
  expect(update).toHaveBeenCalledWith({allergies:'new'});
  expect(eq).toHaveBeenCalledWith('patient_id','patient');
  expect(insert).toHaveBeenCalledWith({patient_id:'patient',past_surgeries:'',allergies:'new'});
 });
 it('preserves non-conflict errors without overwriting data',async()=>{
  const error={code:'42501'};const update=vi.fn();const client={from:()=>({insert:async()=>({error}),update})};
  expect((await saveMedicalHistory(client,'patient',{},false)).error).toBe(error);expect(update).not.toHaveBeenCalled();
 });
});
