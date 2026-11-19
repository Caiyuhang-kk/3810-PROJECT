'use strict';
// B/D：只读连接检查，不初始化索引、不写测试记录。
const { connectDatabase } = require('../models/database');

async function check() {
  const { client } = await connectDatabase({ initialize: false });
  try { console.log('PASS: Atlas connection and ping succeeded. No records were changed.'); }
  finally { await client.close(); }
}
check().catch(err => { console.error(`Database check failed: ${err.message}`); process.exitCode = 1; });
