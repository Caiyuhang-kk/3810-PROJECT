'use strict';
// B（数据库）：只查找/保存用户；密码处理与会话由 A 负责。
const { fail } = require('./validation');

module.exports = function makeUserStore(db) {
  const users = db.collection('users');
  function cleanUsername(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
      fail('Invalid username');
    }
    return value.trim();
  }
  return {
    async findByUsername(username) {
      return users.findOne({ username: cleanUsername(username) });
    },
    async insertIfMissing(username, passwordHash) {
      username = cleanUsername(username);
      if (typeof passwordHash !== 'string' || !passwordHash) fail('Password hash required');
      return users.updateOne(
        { username },
        { $setOnInsert: { username, passwordHash } },
        { upsert: true }
      );
    }
  };
};
