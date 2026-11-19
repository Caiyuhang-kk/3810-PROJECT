'use strict';
// A：网页请求及显示数据整合；C 提供 EJS 模板，B 提供 store。
const express = require('express');
const { checkCsrf } = require('../middleware/security');
const { forDisplay, formValues } = require('../lib/view');

module.exports = function makeWeb(store, now) {
  const router = express.Router();
  const notices = { created: '设备已新增。', updated: '设备状态已更新。', deleted: '设备已删除。' };
  router.get('/', async (req, res) => {
    const loans = await store.list(req.query);
    const date = now();
    res.render('list', { title: '设备管理', loans: loans.map(loan => forDisplay(loan, date)),
      query: req.query, notice: Object.hasOwn(notices, req.query.notice || '') ? notices[req.query.notice] : '' });
  });
  router.get('/new', (req, res) => {
    res.render('form', { title: '新增设备', loan: null, action: '/loans', error: null });
  });
  router.post('/', checkCsrf, async (req, res) => {
    try {
      await store.create(req.body);
      res.redirect(303, '/loans?notice=created');
    } catch (err) {
      if (err.status !== 400) throw err;
      res.status(400).render('form', { title: '新增设备', loan: formValues(req.body),
        action: '/loans', error: err.message });
    }
  });
  router.get('/:id/edit', async (req, res) => {
    const loan = await store.get(req.params.id);
    res.render('form', { title: '编辑设备', loan, action: `/loans/${loan._id}/update`, error: null });
  });
  router.get('/:id', async (req, res) => {
    res.render('details', { title: '设备详情', loan: forDisplay(await store.get(req.params.id), now()) });
  });
  router.post('/:id/update', checkCsrf, async (req, res) => {
    // Check existence first; an invalid form must not resurrect a missing record.
    const original = await store.get(req.params.id);
    try {
      await store.update(req.params.id, req.body);
      res.redirect(303, '/loans?notice=updated');
    } catch (err) {
      if (err.status !== 400) throw err;
      res.status(400).render('form', { title: '编辑设备',
        loan: { ...formValues(req.body), _id: original._id },
        action: `/loans/${original._id}/update`, error: err.message });
    }
  });
  router.post('/:id/delete', checkCsrf, async (req, res) => {
    await store.remove(req.params.id);
    res.redirect(303, '/loans?notice=deleted');
  });
  return router;
};
