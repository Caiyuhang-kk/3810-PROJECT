'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { ObjectId } = require('mongodb');
const { DEFAULT_LOAN, PASSWORD, fixture, csrf, login } = require('./helpers');

test('private pages and direct form submissions require login', async () => {
  const { app, loanStore } = fixture();
  const row = await loanStore.create(DEFAULT_LOAN);
  const id = String(row._id);
  for (const url of ['/loans', '/loans/new', `/loans/${id}`, `/loans/${id}/edit`]) {
    const res = await request(app).get(url);
    assert.ok([302, 303].includes(res.status));
    assert.equal(res.headers.location, '/login');
  }
  for (const url of ['/loans', `/loans/${id}/update`, `/loans/${id}/delete`, '/logout']) {
    const res = await request(app).post(url).type('form').send(DEFAULT_LOAN);
    assert.ok([302, 303].includes(res.status));
    assert.equal(res.headers.location, '/login');
  }
  assert.equal((await loanStore.list()).length, 1);
  assert.equal((await loanStore.get(id)).status, 'borrowed');
});

test('login validates credentials, rejects missing CSRF, and accepts a valid account', async () => {
  const { app } = fixture();
  const agent = request.agent(app);
  const form = await agent.get('/login').expect(200);
  await agent.post('/login').type('form').send({ username: 'alice', password: PASSWORD }).expect(403);
  const token = csrf(form.text);
  await agent.post('/login').type('form').send({ _csrf: token, username: '', password: PASSWORD }).expect(400);
  await agent.post('/login').type('form').send({ _csrf: token, username: 'alice', password: 'wrong' }).expect(401);
  await agent.post('/login').type('form').send({ _csrf: token, username: 'unknown', password: PASSWORD }).expect(401);
  await login(agent);
});

test('users have isolated sessions and a token from another session cannot authorize a form', async () => {
  const { app, loanStore } = fixture();
  const alice = request.agent(app);
  const bob = request.agent(app);
  const a = await login(alice, 'alice');
  const b = await login(bob, 'bob');
  assert.notEqual(a.token, b.token);
  assert.match(a.page.text, /alice/i);
  assert.match(b.page.text, /bob/i);
  await bob.post('/loans').type('form').send({ ...DEFAULT_LOAN, _csrf: a.token }).expect(403);
  assert.equal((await loanStore.list()).length, 0);
  await request(app).get('/loans').expect(302);
});

test('logout destroys the old session, clears its cookie, and does not log out another user', async () => {
  const { app } = fixture();
  const alice = request.agent(app);
  const bob = request.agent(app);
  const a = await login(alice);
  await login(bob, 'bob');
  const cookies = a.response.headers['set-cookie'];
  assert.ok(cookies && cookies.length, 'Login must issue a regenerated session cookie');
  const oldCookie = cookies.map(cookie => cookie.split(';')[0]).join('; ');
  const res = await alice.post('/logout').type('form').send({ _csrf: a.token });
  assert.ok([302, 303].includes(res.status));
  assert.match((res.headers['set-cookie'] || []).join(' '), /Expires=Thu, 01 Jan 1970|Max-Age=0/i);
  await alice.get('/loans').expect(302);
  await request(app).get('/loans').set('Cookie', oldCookie).expect(302);
  await bob.get('/loans').expect(200);
});

test('all authenticated HTML writes reject missing or incorrect CSRF tokens', async () => {
  const { app, loanStore } = fixture();
  const agent = request.agent(app);
  await login(agent);
  const row = await loanStore.create(DEFAULT_LOAN);
  const id = String(row._id);
  for (const url of ['/loans', `/loans/${id}/update`, `/loans/${id}/delete`, '/logout']) {
    await agent.post(url).type('form').send(DEFAULT_LOAN).expect(403);
    await agent.post(url).type('form').send({ ...DEFAULT_LOAN, _csrf: 'incorrect-token' }).expect(403);
  }
  assert.equal((await loanStore.list()).length, 1);
  await agent.get('/loans').expect(200);
});

test('HTML create, detail, edit, update, and delete form flow changes the stored record', async () => {
  const { app, loanStore } = fixture();
  const agent = request.agent(app);
  await login(agent);
  const createPage = await agent.get('/loans/new').expect(200);
  const created = await agent.post('/loans').type('form').send({ ...DEFAULT_LOAN, _csrf: csrf(createPage.text) });
  assert.ok([302, 303].includes(created.status));
  const [row] = await loanStore.list();
  const id = String(row._id);
  const detail = await agent.get(`/loans/${id}`).expect(200);
  assert.match(detail.text, /Canon R50/);
  const editPage = await agent.get(`/loans/${id}/edit`).expect(200);
  const updated = await agent.post(`/loans/${id}/update`).type('form')
    .send({ ...DEFAULT_LOAN, status: 'available', _csrf: csrf(editPage.text) });
  assert.ok([302, 303].includes(updated.status));
  assert.equal((await loanStore.get(id)).status, 'available');
  assert.equal((await loanStore.get(id)).borrower, '');
  assert.equal((await loanStore.get(id)).contactPhone, '');
  assert.equal((await loanStore.get(id)).contactEmail, '');
  assert.equal((await loanStore.get(id)).borrowDate, '');
  const damagePage = await agent.get(`/loans/${id}/edit`).expect(200);
  const damaged = await agent.post(`/loans/${id}/update`).type('form')
    .send({ ...DEFAULT_LOAN, condition: 'damaged', notes: 'Lens cracked on return',
      status: 'unavailable', _csrf: csrf(damagePage.text) });
  assert.ok([302, 303].includes(damaged.status));
  assert.equal((await loanStore.get(id)).condition, 'damaged');
  assert.equal((await loanStore.get(id)).status, 'unavailable');
  assert.equal((await loanStore.get(id)).borrower, '');
  const afterEdit = await agent.get(`/loans/${id}`).expect(200);
  const removed = await agent.post(`/loans/${id}/delete`).type('form').send({ _csrf: csrf(afterEdit.text) });
  assert.ok([302, 303].includes(removed.status));
  assert.equal((await loanStore.list()).length, 0);
  await agent.get(`/loans/${id}`).expect(404);
});

test('invalid create and edit forms keep entered fields and do not change storage', async () => {
  const { app, loanStore } = fixture();
  const agent = request.agent(app);
  const { token } = await login(agent);
  const invalid = { ...DEFAULT_LOAN, itemName: 'Keep-my-entry', borrower: 'Keep-my-name', dueDate: '2026-02-30' };
  const create = await agent.post('/loans').type('form').send({ ...invalid, _csrf: token }).expect(400);
  assert.match(create.text, /Keep-my-entry/);
  assert.match(create.text, /Keep-my-name/);
  assert.equal((await loanStore.list()).length, 0);
  const row = await loanStore.create(DEFAULT_LOAN);
  const edit = await agent.post(`/loans/${row._id}/update`).type('form')
    .send({ ...invalid, _csrf: csrf(create.text) }).expect(400);
  assert.match(edit.text, /Keep-my-entry/);
  assert.match(edit.text, /Keep-my-name/);
  assert.equal((await loanStore.get(String(row._id))).itemName, DEFAULT_LOAN.itemName);
});

test('HTML search combines name, category and status; user input is escaped in every page', async () => {
  const { app, loanStore } = fixture();
  const agent = request.agent(app);
  await login(agent);
  await loanStore.create({ ...DEFAULT_LOAN, itemCode: 'CAM-101', itemName: 'Match-Camera' });
  await loanStore.create({ ...DEFAULT_LOAN, itemCode: 'CAM-102', itemName: 'Match-Available', status: 'available' });
  await loanStore.create({ ...DEFAULT_LOAN, itemCode: 'LAP-103', itemName: 'Match-Laptop', category: 'laptop' });
  const page = await agent.get('/loans').query({ q: 'match', category: 'camera', status: 'borrowed' }).expect(200);
  assert.match(page.text, /Match-Camera/);
  assert.doesNotMatch(page.text, /Match-Available|Match-Laptop/);
  const payload = '<script>alert(1)</script>';
  const row = await loanStore.create({ ...DEFAULT_LOAN, itemCode: 'CAM-104', itemName: payload, borrower: payload, notes: payload });
  for (const url of ['/loans', `/loans/${row._id}`, `/loans/${row._id}/edit`]) {
    const response = await agent.get(url).expect(200);
    assert.doesNotMatch(response.text, /<script>alert\(1\)<\/script>/);
    assert.match(response.text, /&lt;script&gt;/);
  }
});

test('overdue display uses the injected date and excludes available and due-today equipment', async () => {
  const { app, loanStore } = fixture();
  const agent = request.agent(app);
  await login(agent);
  for (const example of [
    { itemCode: 'CAM-111', dueDate: '2026-11-03', status: 'borrowed', overdue: true },
    { itemCode: 'CAM-112', dueDate: '2026-11-03', status: 'available', overdue: false },
    { itemCode: 'CAM-113', dueDate: '2026-11-04', status: 'borrowed', overdue: false }
  ]) {
    const row = await loanStore.create({ ...DEFAULT_LOAN, itemCode: example.itemCode,
      dueDate: example.dueDate, status: example.status });
    const page = await agent.get(`/loans/${row._id}`).expect(200);
    if (example.overdue) assert.match(page.text, /Overdue|逾期/i);
    else assert.doesNotMatch(page.text, />\s*(?:Overdue|逾期)\s*</i);
  }
});

test('public JSON API supports complete CRUD and accepts an update to unchanged values', async () => {
  const { app } = fixture();
  const created = await request(app).post('/api/loans').send(DEFAULT_LOAN).expect(201);
  await request(app).post('/api/loans').send(DEFAULT_LOAN).expect(400);
  const id = created.body._id;
  assert.match(id, /^[a-f\d]{24}$/i);
  const first = await request(app).get(`/api/loans/${id}`).expect(200);
  assert.equal(first.body.itemName, DEFAULT_LOAN.itemName);
  const unchanged = await request(app).put(`/api/loans/${id}`).send(DEFAULT_LOAN).expect(200);
  assert.equal(unchanged.body._id, id);
  const updated = await request(app).put(`/api/loans/${id}`).send({ ...DEFAULT_LOAN, status: 'available' }).expect(200);
  assert.equal(updated.body.status, 'available');
  assert.equal(updated.body.borrower, '');
  assert.equal(updated.body.contactPhone, '');
  assert.equal(updated.body.contactEmail, '');
  assert.equal(updated.body.borrowDate, '');
  assert.equal(updated.body.dueDate, '');
  const list = await request(app).get('/api/loans').expect(200);
  assert.equal(list.body.length, 1);
  await request(app).delete(`/api/loans/${id}`).expect(204);
  await request(app).get(`/api/loans/${id}`).expect(404);
  await request(app).delete(`/api/loans/${id}`).expect(404);
});

test('API search combines filters, matches literal regex characters, and rejects invalid filters', async () => {
  const { app, loanStore } = fixture();
  await loanStore.create({ ...DEFAULT_LOAN, itemCode: 'CAM-121', itemName: 'Canon.R50' });
  await loanStore.create({ ...DEFAULT_LOAN, itemCode: 'CAM-122', itemName: 'CanonXR50' });
  await loanStore.create({ ...DEFAULT_LOAN, itemCode: 'CAM-123', itemName: 'Canon.R50 available', status: 'available' });
  await loanStore.create({ ...DEFAULT_LOAN, itemCode: 'LAP-124', itemName: 'Canon.R50 laptop', category: 'laptop' });
  const res = await request(app).get('/api/loans')
    .query({ q: 'canon.', category: 'camera', status: 'borrowed' }).expect(200);
  assert.deepEqual(res.body.map(row => row.itemName), ['Canon.R50']);
  await request(app).get('/api/loans').query({ category: 'invalid' }).expect(400);
  await request(app).get('/api/loans').query({ status: 'invalid' }).expect(400);
  await request(app).get('/api/loans').query({ q: 'x'.repeat(81) }).expect(400);
});

test('API rejects invalid fields and protects managed fields from client overwrites', async () => {
  const { app, loanStore } = fixture();
  for (const body of [
    {}, [], { ...DEFAULT_LOAN, itemName: '   ' }, { ...DEFAULT_LOAN, category: 'printer' },
    { ...DEFAULT_LOAN, status: 'deleted' }, { ...DEFAULT_LOAN, dueDate: '2026-02-30' },
    { ...DEFAULT_LOAN, borrower: { $ne: null } }, { ...DEFAULT_LOAN, itemName: 'x'.repeat(81) }
  ]) {
    await request(app).post('/api/loans').send(body).expect(400);
  }
  assert.equal((await loanStore.list()).length, 0);
  const suppliedId = String(new ObjectId());
  const create = await request(app).post('/api/loans')
    .send({ ...DEFAULT_LOAN, _id: suppliedId, admin: true, createdAt: '1900-01-01', $set: { status: 'available' } }).expect(201);
  assert.notEqual(create.body._id, suppliedId);
  assert.equal(create.body.admin, undefined);
  assert.equal(create.body.$set, undefined);
  assert.notEqual(create.body.createdAt, '1900-01-01');
  await request(app).put(`/api/loans/${create.body._id}`).send({ status: 'available' }).expect(400);
  assert.equal((await loanStore.get(create.body._id)).status, 'borrowed');
});

test('API distinguishes invalid IDs from missing records and consistently returns JSON errors', async () => {
  const { app } = fixture();
  for (const [id, expected] of [['bad-id', 400], [String(new ObjectId()), 404]]) {
    for (const method of ['get', 'put', 'delete']) {
      let req = request(app)[method](`/api/loans/${id}`);
      if (method === 'put') req = req.send(DEFAULT_LOAN);
      const res = await req.expect(expected);
      assert.match(res.headers['content-type'], /application\/json/);
      assert.ok(res.body && typeof res.body === 'object');
    }
  }
});

test('API rejects non-JSON and malformed JSON bodies without crashing', async () => {
  const { app } = fixture();
  await request(app).post('/api/loans').type('form').send(DEFAULT_LOAN).expect(415);
  await request(app).post('/api/loans').type('text').send('hello').expect(415);
  const malformed = await request(app).post('/api/loans').set('Content-Type', 'application/json')
    .send('{"itemName":').expect(400);
  assert.match(malformed.headers['content-type'], /application\/json/);
  await request(app).get('/api/loans').expect(200);
});

test('unknown pages and malformed or missing HTML records have controlled error responses', async () => {
  const { app } = fixture();
  const unknown = await request(app).get('/does-not-exist').expect(404);
  assert.match(unknown.headers['content-type'], /text\/html/);
  const apiUnknown = await request(app).get('/api/does-not-exist').expect(404);
  assert.match(apiUnknown.headers['content-type'], /application\/json/);
  const agent = request.agent(app);
  await login(agent);
  await agent.get('/loans/invalid-id').expect(400);
  await agent.get(`/loans/${new ObjectId()}`).expect(404);
  await agent.get('/loans').query({ category: 'not-a-category' }).expect(400);
});

test('unexpected storage errors return generic HTML and JSON errors without leaking secrets', async () => {
  const secret = 'mongodb+srv://user:secret-password@private.example/test';
  const loanStore = { async list() { throw new Error(secret); } };
  const { app } = fixture({ loanStore });
  const api = await request(app).get('/api/loans').expect(500);
  assert.match(api.headers['content-type'], /application\/json/);
  assert.doesNotMatch(api.text, /secret-password|private\.example|at .*\.js:/);
  const agent = request.agent(app);
  const form = await agent.get('/login').expect(200);
  const auth = await agent.post('/login').type('form')
    .send({ username: 'alice', password: PASSWORD, _csrf: csrf(form.text) });
  assert.ok([302, 303].includes(auth.status));
  const page = await agent.get('/loans').expect(500);
  assert.match(page.headers['content-type'], /text\/html/);
  assert.doesNotMatch(page.text, /secret-password|private\.example|at .*\.js:/);
});
