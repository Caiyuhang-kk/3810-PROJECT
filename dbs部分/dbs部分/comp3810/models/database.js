'use strict';
// B（数据库）：连接 MongoDB Atlas 并建立索引；A 的入口调用并负责关闭。
const { MongoClient } = require('mongodb');

// 按 Lecture 5 的写法：把 Atlas Drivers 页面复制的连接字符串填在这里。
// 示例：mongodb+srv://myUser:myPassword@cluster0.xxxxx.mongodb.net/
const mongourl = 'PASTE_YOUR_ATLAS_DRIVER_URI_HERE';
const dbName = 'comp3810_group1';

async function connectDatabase({ initialize = true, databaseName = dbName } = {}) {
  if (!/^mongodb(?:\+srv)?:\/\//.test(mongourl) || /[<>]/.test(mongourl)) {
    throw new Error('Replace PASTE_YOUR_ATLAS_DRIVER_URI_HERE in models/database.js with the Atlas Drivers URI');
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/.test(databaseName)) {
    throw new Error('Database name must use letters, numbers, underscores or hyphens');
  }
  const client = new MongoClient(mongourl, {
    serverSelectionTimeoutMS: 15000
  });
  try {
    await client.connect();
    const db = client.db(databaseName);
    await db.command({ ping: 1 });
    if (initialize) {
      await db.collection('loans').createIndex({ category: 1, status: 1 });
      await db.collection('loans').createIndex(
        { itemCode: 1 },
        { unique: true, partialFilterExpression: { itemCode: { $type: 'string' } } }
      );
      await db.collection('users').createIndex({ username: 1 }, { unique: true });
    }
    return { client, db };
  } catch (err) {
    await client.close();
    throw err;
  }
}

module.exports = { connectDatabase, dbName };
