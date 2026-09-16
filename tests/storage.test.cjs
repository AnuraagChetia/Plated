const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rmdir } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const load = require('./load-typescript.cjs');
const { LocalStorageService } = load('lib/storage.ts', {'./media':load('lib/media.ts')});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6SAAAAABJRU5ErkJggg==','base64');
test('local storage persists bytes, validates files, isolates paths, and deletes safely', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'plated-storage-'));
  const storage = new LocalStorageService(root);
  try {
    await assert.rejects(storage.upload(Buffer.from('<svg onload="alert(1)">')),/PNG/);
    const file = await storage.upload(png);
    assert.equal(file.mime,'image/png');
    assert.deepEqual(await storage.read(file.key),png);
    assert.throws(() => storage.read('../.env.local'),/Invalid storage key/);
    await assert.rejects(storage.delete('local/../../.env.local'),/Invalid storage key/);
    await storage.delete(file.key);
    await storage.delete(file.key);
    await assert.rejects(storage.read(file.key),{code:'ENOENT'});
  } finally { await rmdir(root); }
});
