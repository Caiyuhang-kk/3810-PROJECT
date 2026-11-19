'use strict';
// D：真实 Atlas 集成测试，只清理自己创建的记录，不删除数据库。
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { connectDatabase, dbName } = require('../models/database');
const makeLoanStore = require('../models/loan_store');
const makeUserStore = require('../models/user_store');

// D 运行真实测试前才改为 true；测试只使用独立的 _test 数据库。
const runAtlasTest = false;
const testDbName = `${dbName}_test`;

async function testAtlas() {
  if (!runAtlasTest || !testDbName.endsWith('_test')) {
    throw new Error('Set runAtlasTest=true only when using the dedicated _test database; no connection attempted');
  }
  let { client, db } = await connectDatabase({ databaseName: testDbName });
  let loans = makeLoanStore(db);
  const owned = new Set();
  const marker = randomUUID();
  const username = `test-${marker}`;
  let userCreated = false;
  try {
    const input = { itemCode: `TST-${marker.slice(0, 12).toUpperCase()}`, itemName: `TEST-${marker}`,
      category: 'camera', condition: 'good', notes: 'Atlas integration test',
      borrower: 'Integration Test', contactPhone: '+852 9123 4567', contactEmail: 'test@example.com',
      borrowDate: '2099-12-20', dueDate: '2099-12-31', status: 'borrowed' };
    const row = await loans.create(input);
    const id = row._id.toString();
    owned.add(id);
    assert.equal((await loans.get(id)).itemName, input.itemName);
    const matches = await loans.list({ q: marker, category: 'camera', status: 'borrowed' });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]._id.toString(), id);
    assert.equal((await loans.update(id, input)).status, 'borrowed');
    const available = await loans.update(id, { ...input, status: 'available' });
    assert.equal(available.status, 'available');
    assert.equal(available.borrower, '');
    assert.equal(available.contactPhone, '');
    assert.equal(available.contactEmail, '');
    assert.equal(available.borrowDate, '');
    assert.equal(available.dueDate, '');
    await assert.rejects(() => loans.create({ ...input, dueDate: '2026-02-30' }), { status: 400 });
    await assert.rejects(() => loans.get('bad-id'), { status: 400 });
    // Reconnect before reading the same ID to verify persistence beyond a client instance.
    await client.close();
    ({ client, db } = await connectDatabase({ databaseName: testDbName }));
    loans = makeLoanStore(db);
    assert.equal((await loans.get(id)).status, 'available');
    const users = makeUserStore(db);
    const hash = await require('bcryptjs').hash('Temporary-test-password!', 4);
    const result = await users.insertIfMissing(username, hash);
    userCreated = result.upsertedCount === 1;
    assert.ok(userCreated);
    await users.insertIfMissing(username, 'must-not-replace-existing-hash');
    assert.equal((await users.findByUsername(username)).passwordHash, hash);
    await loans.remove(id);
    owned.delete(id);
    await assert.rejects(() => loans.get(id), { status: 404 });
    console.log('PASS: Atlas CRUD, combined search, validation, reconnect persistence and user initialization.');
  } finally {
    try {
      for (const id of owned) await loans.remove(id);
      if (userCreated) await db.collection('users').deleteOne({ username });
    } finally { await client.close(); }
  }
}
testAtlas().catch(err => { console.error(`Atlas test failed: ${err.message}`); process.exitCode = 1; });
