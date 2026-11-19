'use strict';
// B（数据库）：对 A 提供 list/get/create/update/remove，不处理 req/res。
const { ObjectId } = require('mongodb');
const { fail, loanInput, idText, searchFilter } = require('./validation');

module.exports = function makeLoanStore(db) {
  const collection = db.collection('loans');
  const key = id => ({ _id: new ObjectId(idText(id)) });
  const rethrow = err => {
    if (err && err.code === 11000) fail('itemCode: this equipment code already exists');
    throw err;
  };
  return {
    async list(query = {}) {
      return collection.find(searchFilter(query)).sort({ createdAt: -1 }).toArray();
    },
    async get(id) {
      const doc = await collection.findOne(key(id));
      if (!doc) fail('Loan not found', 404);
      return doc;
    },
    async create(body) {
      const now = new Date();
      const doc = { ...loanInput(body), createdAt: now, updatedAt: now };
      try {
        const result = await collection.insertOne(doc);
        return { ...doc, _id: result.insertedId };
      } catch (err) { return rethrow(err); }
    },
    async update(id, body) {
      const filter = key(id);
      const values = loanInput(body);
      let doc;
      try {
        doc = await collection.findOneAndUpdate(
          filter,
          { $set: { ...values, updatedAt: new Date() } },
          { returnDocument: 'after', includeResultMetadata: false }
        );
      } catch (err) { return rethrow(err); }
      if (!doc) fail('Loan not found', 404);
      return doc;
    },
    async remove(id) {
      const result = await collection.deleteOne(key(id));
      if (result.deletedCount === 0) fail('Loan not found', 404);
    }
  };
};
