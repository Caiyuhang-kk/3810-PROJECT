'use strict';
// A（路由/集成）：读取配置、连接 Atlas、装配 Express、启动后自检、优雅关闭。
const { createApp } = require('./app');
const { connectDatabase, dbName } = require('./models/database');
const makeLoanStore = require('./models/loan_store');
const makeUserStore = require('./models/user_store');

// 课堂演示用的本地默认值；正式使用请设置 SESSION_SECRET。
const FALLBACK_SESSION_SECRET = 'comp3810-group1-local-session-secret';

function readConfig(env = process.env) {
  const port = Number(env.PORT || 8099);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const host = env.HOST || '127.0.0.1';
  const sessionSecret = env.SESSION_SECRET || FALLBACK_SESSION_SECRET;
  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must have at least 32 characters');
  }
  return { port, host, sessionSecret };
}

async function start(env = process.env) {
  const config = readConfig(env);
  const { client, db } = await connectDatabase();
  let server;
  try {
    const app = createApp({ loanStore: makeLoanStore(db), userStore: makeUserStore(db),
      sessionSecret: config.sessionSecret });
    const [loanCount, userCount] = await Promise.all([
      db.collection('loans').countDocuments(),
      db.collection('users').countDocuments()
    ]);
    console.log(`Atlas database: ${dbName} (loans: ${loanCount}, users: ${userCount})`);
    if (loanCount === 0) {
      console.log('Hint: loans is empty. Check that DB_NAME matches the shared database, or run `npm run seed` once.');
    }
    if (userCount === 0) {
      console.log('Hint: users is empty. Run `npm run seed:users` before logging in.');
    }
    server = await new Promise((resolve, reject) => {
      const listening = app.listen(config.port, config.host, () => resolve(listening));
      listening.once('error', reject);
    });
  } catch (err) {
    await client.close();
    throw err;
  }
  console.log(`Campus Loans running: http://${config.host}:${config.port}/login`);
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    const timer = setTimeout(() => process.exit(1), 10000);
    timer.unref();
    server.close(async () => {
      await client.close();
      clearTimeout(timer);
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return { server, client };
}

if (require.main === module) start().catch(err => {
  console.error(`Startup failed: ${err.message}`);
  process.exitCode = 1;
});
module.exports = { start, readConfig };
