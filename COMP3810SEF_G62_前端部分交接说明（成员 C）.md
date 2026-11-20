# COMP3810SEF G61 前端部分交接说明（成员 C）

## 1. 项目背景
- COMP3810SEF 课程作业：校园设备借用登记系统 (Campus Equipment Loan Register)。
- 技术栈：Node.js + Express 5 + EJS + MongoDB Atlas。
- 本文件为成员 C 的交付说明，负责 **UI 视图层（EJS 模板）、静态资源与前端交互逻辑**。

## 2. 成员 C 负责的部分
- 编写所有页面的 EJS 模板。
- 实现借用记录列表、组合搜索、详情展示、新增/编辑表单。
- 实现表单业务联动逻辑。

## 3. 文件清单与作用
| 文件路径 | 作用 |
|---|---|
| `views/partials/header.ejs` | 全局公共头部、导航栏、退出登录按钮、引用的 CSS/JS |
| `views/partials/footer.ejs` | 全局公共底部 |
| `views/login.ejs` | 登录页面（管理员账号入口） |
| `views/list.ejs` | 设备列表页、搜索表单（关键词/类别/状态组合查询）、操作按钮 |
| `views/details.ejs` | 设备详情页、逾期警告提示、联系人信息展示 |
| `views/form.ejs` | 新增与编辑表单（包含业务逻辑联动） |
| `views/error.ejs` | 404/500 统一报错页面 |
| `public/styles.css` | 全局 UI 样式表（注：已由其他成员提供） |
| `public/app.js` | 前端交互脚本（包含删除防误触确认、表单状况与状态联动） |

## 4. 核心业务交互逻辑（前端实现）
根据 B 的数据库校验规则（`validation.js`），UI 层做了以下联动处理：
1. **损坏自动停用（防呆设计）**：当用户在表单中把 `condition` 选为 `damaged` 时，JavaScript 会自动将 `status` 锁定为 `unavailable`，并禁用该下拉框，防止提交非法数据。
2. **借出显示详情（动态表单）**：只有当 `status` 选为 `borrowed` 时，借用人、电话、邮箱、日期等输入框才会动态显示；否则隐藏。
3. **归还自动清空**：用户在编辑页面将状态改回 `available` 时，前端隐藏联系方式输入框，后端 `validation.js` 会自动清空残留数据并存入数据库。
4. **逾期高亮**：读取 A 在路由中计算的 `loan.overdue` 布尔值，在列表和详情页动态渲染红色的 "Overdue" 提示。

## 5. 联调注意事项（致成员 A / D）
- **CSP 安全策略**：由于 A 设置了严格的 `Content-Security-Policy`，**严禁在 EJS 文件中直接写入 `<script>` 标签**。所有的前端交互逻辑（如删除确认、表单联动）均已抽离至 `public/app.js` 中，通过 `<script src="/app.js" defer></script>` 引入。
- **CSRF Token**：所有 POST 表单均已正确嵌入 `<input type="hidden" name="_csrf" value="<%= csrfToken %>">`。

## 6. 联调验收清单（UI 部分）
- [ ] 访问 `http://127.0.0.1:8099` 正常跳转至英文登录页。
- [ ] 登录后列表页正确显示设备，且排版无错乱。
- [ ] 组合搜索（输入关键词 + 类别 + 状态）能正确过滤数据。
- [ ] **表单联动验证**：选择 `Damaged` 状况，状态自动锁死为 `Unavailable`，且下拉框不可点击。
- [ ] **表单联动验证**：选择 `Borrowed` 状态，联系人信息输入框正常展示。
- [ ] 删除记录：点击删除弹出浏览器确认框，确认后记录消失。
- [ ] 错误页面：访问无效路径（如 `/abc`）能正确显示英文 404 页面。