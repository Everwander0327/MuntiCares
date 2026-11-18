import { describe, expect, it, vi } from 'vitest';
import { createUuid } from './uniqueId';
const pattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
describe('UUID creation',()=>{
 it('uses native randomUUID when available',()=>{const crypto={randomUUID:vi.fn(()=> 'native-id')};expect(createUuid(crypto)).toBe('native-id');});
 it('generates valid v4 UUIDs when randomUUID is unavailable',()=>{
  const crypto={getRandomValues:bytes=>{for(let i=0;i<bytes.length;i++)bytes[i]=i;return bytes;}};
  expect(createUuid(crypto)).toMatch(pattern);
  expect(createUuid(crypto)).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
 });
 it('fails clearly when secure randomness is unavailable',()=>{expect(()=>createUuid({})).toThrow(/secure/i);});
});
