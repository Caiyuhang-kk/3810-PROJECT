'use strict';

// 浏览器原生确认对话框：取消删除时不提交表单。
document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const message = form.dataset.confirm;
  if (message && !window.confirm(message)) event.preventDefault();
});
