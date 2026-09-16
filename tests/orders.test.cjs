const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const filename = path.resolve(__dirname, '../lib/orders.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = new Module(filename, module);
loaded._compile(compiled, filename);
const { parseOrder } = loaded.exports;
const first = '11111111-1111-4111-8111-111111111111';
const second = 'abcdefab-abcd-4abc-8abc-abcdefabcdef';
const valid = () => ({ slug: 'saffron-table', customerName: ' Ayesha ', requestId:first, checkout:{phone:'9999999999',fulfillment:'PICKUP',address:'',notes:''}, items: [{ id: first, quantity: 2 }] });

test('accepts a cart and strips client-supplied prices and totals', () => {
  const value = valid();
  value.total = 1;
  value.items[0].price = 1;
  assert.deepEqual(parseOrder(value), { ...valid(), customerName: 'Ayesha' });
});

test('requires fulfillment details and a retry key', () => {
  assert.equal(parseOrder({...valid(),requestId:undefined}),null);
  for (const phone of ['abc1234567','123',null]) assert.equal(parseOrder({...valid(),checkout:{...valid().checkout,phone}}),null);
  assert.equal(parseOrder({...valid(),checkout:{...valid().checkout,fulfillment:'DELIVERY'}}),null);
  assert.ok(parseOrder({...valid(),checkout:{...valid().checkout,fulfillment:'DELIVERY',address:'123 Test Street'}}));
});

test('saved carts discard malformed quantities and unrelated keys', () => {
  const {restoreCart} = loaded.exports;
  assert.deepEqual(restoreCart({[first]:2,[second]:-1,unrelated:5}),{[first]:2});
  assert.deepEqual(restoreCart(null),{});
});

test('rejects malformed payloads without throwing', () => {
  for (const value of [null, false, 12, 'cart', [], {}, { ...valid(), items: [null] }, { ...valid(), items: ['dish'] }]) {
    assert.equal(parseOrder(value), null);
  }
});

test('rejects empty, duplicate, and oversized carts', () => {
  assert.equal(parseOrder({ ...valid(), items: [] }), null);
  assert.equal(parseOrder({ ...valid(), items: [{ id: second, quantity: 1 }, { id: second.toUpperCase(), quantity: 2 }] }), null);
  assert.equal(parseOrder({ ...valid(), items: Array.from({ length: 51 }, () => ({ id: first, quantity: 1 })) }), null);
});

test('requires bounded integer quantities and valid identifiers', () => {
  for (const quantity of [0, -1, 1.5, 100, '2', null, Infinity, NaN]) {
    assert.equal(parseOrder({ ...valid(), items: [{ id: first, quantity }] }), null);
  }
  assert.equal(parseOrder({ ...valid(), items: [{ id: 'not-a-uuid', quantity: 1 }] }), null);
  assert.ok(parseOrder({ ...valid(), items: [{ id: second, quantity: 99 }] }));
});

test('requires a valid storefront slug and a customer name', () => {
  for (const slug of ['', '-invalid', 'bad--slug', 'UPPER', 'a'.repeat(81)]) assert.equal(parseOrder({ ...valid(), slug }), null);
  for (const customerName of ['', '   ', 'a'.repeat(101), 123]) assert.equal(parseOrder({ ...valid(), customerName }), null);
});
