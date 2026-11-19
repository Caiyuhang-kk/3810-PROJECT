'use strict';

// D（测试）：内存替身只用于自动测试；正式 server.js 始终连接 MongoDB Atlas。
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { createApp } = require('../app');
const { fail, loanInput, idText, searchFilter } = require('../models/validation');

const PASSWORD = 'Demo-test-password-123!';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);
const DEFAULT_LOAN = Object.freeze({
  itemCode: 'CAM-900', itemName: 'Canon R50', category: 'camera', condition: 'good',
  notes: 'Lens checked', borrower: 'Alice', contactPhone: '+852 9123 4567',
  contactEmail: 'alice@example.com',
  borrowDate: '2026-11-01', dueDate: '2026-11-10', status: 'borrowed'
});

function createMemoryLoanStore() {
  const rows = new Map();
  function find(id) {
    const row = rows.get(idText(id).toLowerCase());
    if (!row) fail('Loan not found', 404);
    return row;
  }
  return {
    async list(query = {}) {
      const filter = searchFilter(query);
      return [...rows.values()].filter(row =>
        (!filter.$or || filter.$or.some(part => {
          const [field, pattern] = Object.entries(part)[0];
          return new RegExp(pattern.$regex, pattern.$options).test(row[field]);
        })) &&
        (!filter.category || row.category === filter.category) &&
        (!filter.status || row.status === filter.status)
      ).sort((a, b) => b.createdAt - a.createdAt).map(row => ({ ...row }));
    },
    async get(id) { return { ...find(id) }; },
    async create(body) {
      const values = loanInput(body);
      if ([...rows.values()].some(row => row.itemCode === values.itemCode)) {
        fail('itemCode: this equipment code already exists');
      }
      const now = new Date();
      const row = { ...values, _id: new ObjectId(), createdAt: now, updatedAt: now };
      rows.set(String(row._id), row);
      return { ...row };
    },
    async update(id, body) {
      const row = find(id);
      const values = loanInput(body);
      if ([...rows.values()].some(other => other !== row && other.itemCode === values.itemCode)) {
        fail('itemCode: this equipment code already exists');
      }
      Object.assign(row, values, { updatedAt: new Date() });
      return { ...row };
    },
    async remove(id) {
      find(id);
      rows.delete(id.toLowerCase());
    }
  };
}

function fixture(options = {}) {
  const loanStore = options.loanStore || createMemoryLoanStore();
  const users = [
    { _id: 'test-alice', username: 'alice', passwordHash },
    { _id: 'test-bob', username: 'bob', passwordHash }
  ];
  const userStore = {
    async findByUsername(username) { return users.find(user => user.username === username) || null; }
  };
  const app = createApp({
    loanStore, userStore,
    sessionSecret: 'test-only-secret-with-more-than-thirty-two-characters',
    now: () => new Date('2026-11-04T12:00:00.000Z'),
    ...options
  });
  return { app, loanStore };
}

function csrf(html) {
  const inputs = html.match(/<input\b[^>]*>/gi) || [];
  const input = inputs.find(tag => /\bname\s*=\s*["']_csrf["']/i.test(tag));
  assert.ok(input, 'The HTML form must contain an _csrf input');
  const value = input.match(/\bvalue\s*=\s*["']([^"']+)["']/i);
  assert.ok(value, 'The CSRF token must not be empty');
  return value[1];
}

async function login(agent, username = 'alice') {
  const form = await agent.get('/login').expect(200);
  const response = await agent.post('/login').type('form')
    .send({ _csrf: csrf(form.text), username, password: PASSWORD });
  assert.ok([302, 303].includes(response.status));
  assert.equal(response.headers.location, '/loans');
  const page = await agent.get('/loans').expect(200);
  return { response, page, token: csrf(page.text) };
}

module.exports = { DEFAULT_LOAN, PASSWORD, createMemoryLoanStore, fixture, csrf, login };
