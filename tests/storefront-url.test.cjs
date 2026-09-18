const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const validation = load('lib/restaurant-validation.ts');

test('storefront addresses normalize names and reject invalid paths', () => {
  assert.equal(validation.storefrontSlug(' Café & Kitchen! '), 'cafe-kitchen');
  assert.equal(validation.validStorefrontSlug('cafe_kitchen'), true);
  assert.equal(validation.storefrontSlug('a'.repeat(79) + ' b'), 'a'.repeat(79));
  for (const value of ['', '../admin', 'UPPER', 'two--hyphens', 'a'.repeat(81)]) {
    assert.equal(validation.validStorefrontSlug(value), false);
  }
});

test('settings saves custom addresses, derives renamed addresses, and protects ownership', async () => {
  let user = { id: 'owner' }, current = { name: 'Old Kitchen', slug: 'old-kitchen' };
  let updateError = null, writes = [], filters = [];
  const { PATCH } = load('app/api/restaurants/route.ts', {
    '../../../lib/hours':load('lib/hours.ts'),
    '../../../lib/restaurant-validation': validation,
    '../../../lib/http': load('lib/http.ts'),
    '../../../lib/api-server': load('lib/api-server.ts'),
    '../../../lib/supabase/route': { routeClient: () => ({
      json: (body, status = 200) => Response.json(body, { status }),
      client: {
        auth: { getUser: async () => ({ data: { user } }) },
        from() {
          let writing = false;
          const builder = {
            select() { return builder; },
            eq(key, value) { filters.push([key, value]); return builder; },
            update(value) { writing = true; writes.push(value); return builder; },
            async maybeSingle() { return writing ? { data: { id: 'restaurant' }, error: updateError } : { data: current, error: null }; },
          };
          return builder;
        },
      },
    }) },
  });
  const save = (overrides = {}) => PATCH(new Request('http://localhost/api/restaurants', {
    method: 'PATCH', body: JSON.stringify({ id: 'restaurant', name: 'Old Kitchen', slug: 'old-kitchen',
      description: 'Fresh food', pickup_address: '123 Kitchen Road', contact_phone: '9999999999',
      accepts_pickup: true, accepts_delivery: false, accepting_orders: true, is_published: true,
      estimated_minutes: 30, ...overrides }),
  }));
  assert.equal((await save({ slug: 'custom-address' })).status, 200);
  assert.equal(writes.at(-1).slug, 'custom-address');
  assert.equal((await save({ name: 'New Kitchen' })).status, 200);
  assert.equal(writes.at(-1).slug, 'new-kitchen');
  assert.equal((await save({ name: 'New Kitchen', slug: 'my-kitchen' })).status, 200);
  assert.equal(writes.at(-1).slug, 'my-kitchen');
  assert.equal((await save()).status, 200);
  assert.equal(writes.at(-1).slug, 'old-kitchen');
  updateError = { code: '23505' };
  const conflict = await save({ slug: 'taken-address' });
  assert.equal(conflict.status, 409);
  assert.match((await conflict.json()).error, /taken/);
  const before = writes.length;
  assert.equal((await save({ slug: '../admin' })).status, 400);
  current = null;
  assert.equal((await save()).status, 404);
  user = null;
  assert.equal((await save()).status, 401);
  assert.equal(writes.length, before);
  assert.ok(filters.some(([key, value]) => key === 'owner_id' && value === 'owner'));
});
