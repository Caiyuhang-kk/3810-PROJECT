'use strict';
// D（测试）维护用例，B 在交付数据库模块前也运行这些测试。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loanInput, idText, searchFilter } = require('../models/validation');
const valid = {
  itemCode: ' cam-001 ', itemName: ' Camera A ', category: 'camera', condition: 'good',
  notes: ' Small scratch ', borrower: 'Student A', contactPhone: '+852 9123 4567',
  contactEmail: 'StudentA@Example.com',
  borrowDate: '2026-11-10', dueDate: '2026-11-20', status: 'borrowed'
};

test('normalizes text and strips protected or unknown fields', () => {
  const result = loanInput({ ...valid, _id: 'fake', createdAt: 'fake', $set: {} });
  assert.equal(result.itemCode, 'CAM-001');
  assert.equal(result.itemName, 'Camera A');
  assert.equal(result.notes, 'Small scratch');
  assert.equal(result.contactEmail, 'studenta@example.com');
  assert.equal(Object.keys(result).length, 11);
  assert.equal(result._id, undefined);
});
test('rejects missing fields and injected objects', () => {
  for (const key of ['itemCode', 'itemName', 'category', 'condition', 'borrower', 'contactPhone',
    'contactEmail', 'borrowDate', 'dueDate', 'status']) {
    const body = { ...valid };
    delete body[key];
    assert.throws(() => loanInput(body), { status: 400 });
  }
  assert.throws(() => loanInput({ ...valid, borrower: { $ne: null } }), { status: 400 });
});
test('rejects impossible dates; accepts a real leap day', () => {
  for (const dueDate of ['2026-02-30', '2026-13-01', '2026-02-29', 'bad']) {
    assert.throws(() => loanInput({ ...valid, dueDate }), { status: 400 });
  }
  assert.equal(loanInput({ ...valid, borrowDate: '2028-02-20', dueDate: '2028-02-29' }).dueDate, '2028-02-29');
  for (const dueDate of ['2026-11-10', '2026-11-25']) {
    assert.throws(() => loanInput({ ...valid, dueDate }), { status: 400 });
  }
});
test('available equipment does not require borrower or due date', () => {
  const result = loanInput({ itemCode: 'CAM-001', itemName: 'Camera A', category: 'camera',
    condition: 'good', status: 'available' });
  assert.equal(result.borrower, '');
  assert.equal(result.contactPhone, '');
  assert.equal(result.contactEmail, '');
  assert.equal(result.borrowDate, '');
  assert.equal(result.dueDate, '');
});
test('validates enums and text length', () => {
  for (const patch of [{ status: 'lost' }, { category: 'bad' }, { itemName: ' ' },
    { condition: 'unknown' }, { itemCode: 'bad code!' }, { notes: 'x'.repeat(301) },
    { contactPhone: 'abc' }, { contactEmail: 'not-an-email' },
    { itemName: 'x'.repeat(81) }]) {
    assert.throws(() => loanInput({ ...valid, ...patch }), { status: 400 });
  }
  assert.throws(() => loanInput({ ...valid, condition: 'damaged', status: 'borrowed' }), { status: 400 });
  const damaged = loanInput({ ...valid, condition: 'damaged', status: 'unavailable' });
  assert.equal(damaged.borrower, '');
  assert.equal(damaged.contactPhone, '');
  assert.equal(damaged.contactEmail, '');
  assert.equal(damaged.borrowDate, '');
  assert.equal(damaged.dueDate, '');
});
test('validates id format before database access', () => {
  assert.equal(idText('0123456789abcdef01234567'), '0123456789abcdef01234567');
  for (const value of ['bad', 'z'.repeat(24), '', null, {}]) {
    assert.throws(() => idText(value), { status: 400 });
  }
});
test('combines filters and escapes user regex characters', () => {
  const filter = searchFilter({ q: 'Cam.*', category: 'camera', status: 'borrowed' });
  const regex = new RegExp(filter.$or[1].itemName.$regex, filter.$or[1].itemName.$options);
  assert.ok(regex.test('cam.* A'));
  assert.equal(regex.test('Camera A'), false);
  assert.equal(filter.category, 'camera');
  assert.equal(filter.status, 'borrowed');
  assert.deepEqual(searchFilter({ q: '', category: '', status: '' }), {});
  assert.throws(() => searchFilter({ q: { $ne: null } }), { status: 400 });
  assert.throws(() => searchFilter({ status: 'lost' }), { status: 400 });
});
