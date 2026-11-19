'use strict';
// B（数据库）：字段、ID及搜索条件校验；A 负责接收请求并返回错误响应。

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function text(value, name, max = 80) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    fail(`${name}: required text, maximum ${max} characters`);
  }
  return value.trim();
}

function choice(value, allowed, name) {
  if (!allowed.includes(value)) fail(`${name}: invalid value`);
  return value;
}

function optionalText(value, name, max = 300) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.trim().length > max) {
    fail(`${name}: maximum ${max} characters`);
  }
  return value.trim();
}

function equipmentCode(value) {
  const result = text(value, 'itemCode', 20).toUpperCase();
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(result)) {
    fail('itemCode: use letters, numbers and hyphens, for example TAB-001');
  }
  return result;
}

function phone(value) {
  const result = text(value, 'contactPhone', 30);
  if (!/^[0-9+() -]{7,30}$/.test(result)) fail('contactPhone: use a valid phone number');
  return result;
}

function email(value) {
  const result = text(value, 'contactEmail', 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('contactEmail: use a valid email address');
  return result;
}

function dateOnly(value, name) {
  const result = text(value, name, 10);
  const date = new Date(`${result}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) ||
      Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result) {
    fail(`${name}: use a real date in YYYY-MM-DD format`);
  }
  return result;
}

function loanInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Expected an object');
  const status = choice(body.status, ['available', 'borrowed', 'unavailable'], 'status');
  const condition = choice(body.condition, ['good', 'damaged'], 'condition');
  if (condition === 'damaged' && status !== 'unavailable') {
    fail('Damaged equipment must be unavailable and cannot be borrowed');
  }
  if (condition === 'good' && status === 'unavailable') {
    fail('Unavailable equipment must be marked as damaged');
  }
  const borrowDate = status === 'borrowed' ? dateOnly(body.borrowDate, 'borrowDate') : '';
  const dueDate = status === 'borrowed' ? dateOnly(body.dueDate, 'dueDate') : '';
  if (status === 'borrowed') {
    const days = (Date.parse(`${dueDate}T00:00:00.000Z`) -
      Date.parse(`${borrowDate}T00:00:00.000Z`)) / 86400000;
    if (days < 1 || days > 14) fail('Loan period must be between 1 and 14 days');
  }
  // Only these eleven fields can be written. Never send req.body directly to MongoDB.
  return {
    itemCode: equipmentCode(body.itemCode),
    itemName: text(body.itemName, 'itemName'),
    category: choice(body.category, ['tablet', 'laptop', 'camera'], 'category'),
    condition,
    notes: optionalText(body.notes, 'notes'),
    borrower: status === 'borrowed' ? text(body.borrower, 'borrower') : '',
    contactPhone: status === 'borrowed' ? phone(body.contactPhone) : '',
    contactEmail: status === 'borrowed' ? email(body.contactEmail) : '',
    borrowDate,
    dueDate,
    status
  };
}

function idText(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) fail('Invalid id');
  return value;
}

function searchFilter(query = {}) {
  const filter = {};
  if (query.q !== undefined && query.q !== '') {
    const q = text(query.q, 'q');
    // Escape regex syntax: a user's dot means a literal dot, not any character.
    const pattern = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [{ itemCode: pattern }, { itemName: pattern }];
  }
  if (query.category !== undefined && query.category !== '') {
    filter.category = choice(query.category, ['tablet', 'laptop', 'camera'], 'category');
  }
  if (query.status !== undefined && query.status !== '') {
    filter.status = choice(query.status, ['available', 'borrowed', 'unavailable'], 'status');
  }
  return filter;
}

module.exports = { fail, loanInput, idText, searchFilter };
