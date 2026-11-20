'use strict';

// 浏览器原生确认对话框：取消删除时不提交表单。
document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const message = form.dataset.confirm;
  if (message && !window.confirm(message)) event.preventDefault();
});

// 表单状况与状态联动
document.addEventListener('DOMContentLoaded', () => {
  const conditionSelect = document.getElementById('condition');
  const statusSelect = document.getElementById('status');
  const borrowFields = document.getElementById('borrow-fields');

  if (!conditionSelect || !statusSelect || !borrowFields) return;

  function toggleForm() {
    const isBorrowed = statusSelect.value === 'borrowed';
    const isDamaged = conditionSelect.value === 'damaged';

    borrowFields.style.display = isBorrowed ? 'block' : 'none';
    
    // 规则1：损坏自动变停用
    if (isDamaged && statusSelect.value !== 'unavailable') {
      statusSelect.value = 'unavailable';
    }
    // 规则2：正常状态不能选停用
    if (!isDamaged && statusSelect.value === 'unavailable') {
      statusSelect.value = 'available';
    }
  }

  conditionSelect.addEventListener('change', toggleForm);
  statusSelect.addEventListener('change', toggleForm);
  toggleForm();
});