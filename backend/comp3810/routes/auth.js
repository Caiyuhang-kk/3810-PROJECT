'use strict';
// A：登录/退出及会话。用户数据操作由 B 的 userStore 提供。
const express = require('express');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const { requireLogin, checkCsrf } = require('../middleware/security');

module.exports = function makeAuth(userStore) {
  const router = express.Router();
  router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/loans');
    res.render('login', { title: '登录', error: null, username: '' });
  });
  router.post('/login', checkCsrf, async (req, res, next) => {
    const { username, password } = req.body || {};
    const loginError = (status, error) => res.status(status).render('login', {
      title: '登录', error, username: typeof username === 'string' ? username : ''
    });
    if (typeof username !== 'string' || !username.trim() || username.trim().length > 80 ||
        typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) {
      return loginError(400, '请输入有效账号和密码。');
    }
    const user = await userStore.findByUsername(username.trim());
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return loginError(401, '账号或密码错误。');
    }
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.user = { id: user._id.toString(), username: user.username };
      req.session.csrfToken = randomBytes(32).toString('hex');
      req.session.save(err => err ? next(err) : res.redirect(303, '/loans'));
    });
  });
  router.post('/logout', requireLogin, checkCsrf, (req, res, next) => {
    req.session.destroy(err => {
      if (err) return next(err);
      res.clearCookie('connect.sid', { path: '/' });
      res.redirect(303, '/login');
    });
  });
  return router;
};
