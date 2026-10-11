import test from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError } from './api.ts';

test('cancellable search requests retain session credentials and propagate AbortError', async () => {
 const original = globalThis.fetch;
 const controller = new AbortController();
 let credentials: RequestCredentials | undefined;
 globalThis.fetch = async (_url, options) => {
  credentials = options?.credentials;
  assert.equal(options?.signal, controller.signal);
  return new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), {once:true}));
 };
 try { const pending=api.get('/lab-tests?search=old',{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(credentials,'include'); }
 finally { globalThis.fetch=original; }
});

test('request cancellation support preserves authenticated errors and success envelopes', async () => {
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async ()=>new Response(JSON.stringify({success:false,message:'Access denied'}),{status:403});
  await assert.rejects(api.get('/lab-tests'), error=>error instanceof ApiError && error.status===403 && error.message==='Access denied');
  globalThis.fetch=async ()=>new Response(JSON.stringify({success:true,data:{items:[{id:'synthetic'}]}}),{status:200});
  assert.deepEqual(await api.get('/lab-tests'),{items:[{id:'synthetic'}]});
 } finally { globalThis.fetch=original; }
});
