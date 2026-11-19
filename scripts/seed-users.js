// A（路由/登录）：完整项目整合时建立演示账号；不属于B的设备初始化工作。
const bcrypt = require('bcryptjs');
const { connectDatabase } = require('../models/database');
const makeUserStore = require('../models/user_store');

async function main() {
  const database = await connectDatabase();
  const users = makeUserStore(database.db);
  await users.insertIfMissing('member1', await bcrypt.hash('Member1Pass!', 12));
  await users.insertIfMissing('member2', await bcrypt.hash('Member2Pass!', 12));
  await database.client.close();
  console.log('Login accounts checked.');
}

main().catch(function (error) {
  console.log(error.message);
});
