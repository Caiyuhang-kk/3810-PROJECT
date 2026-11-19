// B（数据库）：第一次手动运行，插入35台设备。
// 只使用Lecture 5中的collection、findOne和insertOne。
const { connectDatabase } = require('../models/database');

async function insertEquipment(collection, itemCode, itemName, category) {
  const oldEquipment = await collection.findOne({ itemCode: itemCode });

  if (oldEquipment === null) {
    await collection.insertOne({
      itemCode: itemCode,
      itemName: itemName,
      category: category,
      condition: 'good',
      notes: '',
      borrower: '',
      contactPhone: '',
      contactEmail: '',
      borrowDate: '',
      dueDate: '',
      status: 'available',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(itemCode + ' inserted');
  } else {
    console.log(itemCode + ' already exists');
  }
}

async function main() {
  const database = await connectDatabase();
  const equipment = database.db.collection('loans');

  for (let i = 1; i <= 20; i++) {
    const number = String(i).padStart(3, '0');
    await insertEquipment(equipment, 'TAB-' + number, 'Tablet ' + i, 'tablet');
  }

  for (let i = 1; i <= 10; i++) {
    const number = String(i).padStart(3, '0');
    await insertEquipment(equipment, 'LAP-' + number, 'Laptop ' + i, 'laptop');
  }

  for (let i = 1; i <= 5; i++) {
    const number = String(i).padStart(3, '0');
    await insertEquipment(equipment, 'CAM-' + number, 'Camera ' + i, 'camera');
  }

  console.log('35 equipment records checked.');
  await database.client.close();
}

main().catch(function (error) {
  console.log(error.message);
});
