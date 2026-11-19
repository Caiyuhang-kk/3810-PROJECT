'use strict';
const { randomBytes, timingSafeEqual } = require('node:crypto');

function requireLogin(req, res, next) {
  if (req.session.user) return next();
  return res.redirect('/login');
}

function prepareCsrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function checkCsrf(req, res, next) {
  const supplied = req.body?._csrf;
  const expected = req.session.csrfToken;
  if (typeof supplied !== 'string' || typeof expected !== 'string' ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return next(Object.assign(new Error('页面已过期或请求校验失败，请刷新页面后重试。'), { status: 403 }));
  }
  next();
}

module.exports = { requireLogin, prepareCsrf, checkCsrf };
