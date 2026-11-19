'use strict';
// A：装配应用；依赖注入使 D 可用测试替身验证 HTTP，而不触碰 Atlas。
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const makeApi = require('./routes/api');
const makeAuth = require('./routes/auth');
const makeWeb = require('./routes/web');
const { requireLogin, prepareCsrf } = require('./middleware/security');
const { categoryLabels, statusLabels, conditionLabels } = require('./lib/view');

function createApp({ loanStore, userStore, sessionSecret, sessionStore, secureCookies = false,
  now = () => new Date() }) {
  if (typeof sessionSecret !== 'string' || sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must have at least 32 characters');
  }
  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.locals.categoryLabels = categoryLabels;
  app.locals.statusLabels = statusLabels;
  app.locals.conditionLabels = conditionLabels;
  app.use((req, res, next) => {
    res.locals.user = null;
    res.locals.csrfToken = '';
    res.locals.currentPath = req.path;
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'same-origin');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
    next();
  });
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.json({ limit: '16kb' }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));
  // The course explicitly allows unauthenticated REST. Keep demo server on loopback.
  app.use('/api/loans', makeApi(loanStore));
  app.use('/api', (req, res) => res.status(404).json({ error: 'API not found' }));
  const sessionOptions = {
    secret: sessionSecret, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: secureCookies, maxAge: 3600000 }
  };
  if (sessionStore) sessionOptions.store = sessionStore;
  app.use(session(sessionOptions));
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.locals.user = req.session.user || null;
    next();
  });
  app.use(prepareCsrf);
  app.get('/', (req, res) => res.redirect(req.session.user ? '/loans' : '/login'));
  app.use(makeAuth(userStore));
  app.use('/loans', requireLogin, makeWeb(loanStore, now));
  app.use((req, res) => res.status(404).render('error', {
    title: '页面不存在', status: 404, message: '找不到此页面，请从导航返回。'
  }));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
    const message = status >= 500 ? '服务暂时无法完成请求，请稍后重试。' :
      err.type === 'entity.parse.failed' ? '请求JSON格式错误。' : err.message;
    if (req.path === '/api' || req.path.startsWith('/api/')) return res.status(status).json({ error: message });
    res.status(status).render('error', { title: '操作未完成', status, message });
  });
  return app;
}

module.exports = { createApp };
