'use strict';
const categoryLabels = { tablet: '平板', laptop: '电脑', camera: '摄像机' };
const statusLabels = { available: '可借', borrowed: '借出中', unavailable: '停用' };
const conditionLabels = { good: '正常', damaged: '损坏' };

function campusDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function forDisplay(loan, date) {
  return { ...loan, overdue: loan.status === 'borrowed' && loan.dueDate < campusDate(date) };
}

// Retain only string fields when redisplaying an invalid browser form.
function formValues(body = {}) {
  return Object.fromEntries(['itemCode', 'itemName', 'category', 'condition', 'notes', 'borrower',
    'contactPhone', 'contactEmail', 'borrowDate', 'dueDate', 'status']
    .map(key => [key, typeof body[key] === 'string' ? body[key] : '']));
}

module.exports = { categoryLabels, statusLabels, conditionLabels, campusDate, forDisplay, formValues };
