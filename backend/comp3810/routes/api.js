'use strict';
// A（路由）：HTTP方法、路径、响应状态；数据库操作调用 B 的 store。
const express = require('express');

module.exports = function makeApi(store) {
  const router = express.Router();
  router.use((req, res, next) => {
    if (['POST', 'PUT'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ error: 'Use Content-Type: application/json' });
    }
    next();
  });
  router.get('/', async (req, res) => res.json(await store.list(req.query)));
  router.get('/:id', async (req, res) => res.json(await store.get(req.params.id)));
  router.post('/', async (req, res) => {
    const doc = await store.create(req.body);
    res.status(201).location(`/api/loans/${doc._id}`).json(doc);
  });
  router.put('/:id', async (req, res) => {
    res.json(await store.update(req.params.id, req.body));
  });
  router.delete('/:id', async (req, res) => {
    await store.remove(req.params.id);
    res.status(204).end();
  });
  return router;
};
