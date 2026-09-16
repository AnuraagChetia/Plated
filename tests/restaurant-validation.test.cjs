const { test } = require('node:test');
const assert = require('node:assert/strict');
const { restaurantValidationError } = require('./load-typescript.cjs')('lib/restaurant-validation.ts');
const valid = {name:'Test',slug:'test',description:'Seasonal dishes',theme:'saffron',pickupAddress:'123 Test Street',contactPhone:'+91 98765 43210',dishName:'Bhaat',dishPrice:120};
test('launch identifies invalid phone independently of a valid dish price', () => {
  for (const contactPhone of ['123123sda','-------','123456','1234567890123456']) {
    const error = restaurantValidationError({...valid,contactPhone});
    assert.equal(error.step,0);
    assert.match(error.message,/phone number/);
  }
  assert.equal(restaurantValidationError(valid),null);
});
test('each onboarding step validates its own fields and launch checks all fields', () => {
  assert.equal(restaurantValidationError({...valid,dishName:'',dishPrice:0},0),null);
  assert.equal(restaurantValidationError({...valid,dishPrice:120.5},2).step,2);
  assert.match(restaurantValidationError({...valid,dishPrice:120.5}).message,/whole-rupee/);
  assert.match(restaurantValidationError({...valid,pickupAddress:'short'}).message,/pickup address/);
});
