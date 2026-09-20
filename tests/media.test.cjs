const { test } = require('node:test');
const assert = require('node:assert/strict');
const { imageType, MAX_IMAGE_BYTES } = require('./load-typescript.cjs')('lib/media.ts');

test('media rejects active content and files above the upload cap', () => {
  assert.equal(imageType(Buffer.from('<svg onload="alert(1)"></svg>')),null);
  assert.equal(imageType(Buffer.from('<html>not an image</html>')),null);
  assert.equal(imageType(Buffer.alloc(MAX_IMAGE_BYTES+1)),null);
  assert.equal(imageType(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])),'image/png');
  assert.equal(imageType(Buffer.from([255,216,255,224,0,0,0,0,0,0,0,0])),'image/jpeg');
  assert.equal(imageType(Buffer.from('RIFF0000WEBP')),'image/webp');
});

test('images at 3 MB are accepted and larger images are rejected',()=>{assert.equal(MAX_IMAGE_BYTES,3*1024*1024);const bytes=Buffer.alloc(MAX_IMAGE_BYTES+1);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);assert.equal(imageType(bytes.subarray(0,MAX_IMAGE_BYTES)),'image/png');assert.equal(imageType(bytes),null);});
