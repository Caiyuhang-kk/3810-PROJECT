# COMP3810SEF G61 后端部分交接说明（成员 A）

## 1. 项目背景
- COMP3810SEF 课程作业：校园设备借用登记系统。
- 技术栈：Node.js + Express 5 + EJS + MongoDB Atlas，部署在 Ubuntu VM（服务监听 `127.0.0.1:8099`）。
- 本文件夹为成员 A 的交付代码，负责 **路由 / 登录 / 集成** 三部分。

## 2. 成员 A 负责的部分
- 网页路由（列表 / 详情 / 新增 / 编辑 / 删除）
- REST API（`/api/loans` 的 CRUD）
- 登录 / 退出 / 会话（session + bcrypt 密码校验，账号存 MongoDB `users` 集合）
- 登录拦截与 CSRF 防护
- 应用装配（Express、安全响应头、统一错误处理）
- 启动配置、连接自检与优雅关闭
- 演示账号初始化脚本

## 3. 文件清单与作用
| 文件 | 作用 |
|---|---|
| `app.js` | 装配 Express 应用：session、CSRF、静态资源、安全响应头、错误处理 |
| `server.js` | 读取配置、连接 Atlas、启动服务、自检、优雅关闭 |
| `routes/web.js` | 网页路由：列表 / 详情 / 新增 / 编辑 / 删除 |
| `routes/auth.js` | 登录 / 退出 / 会话 |
| `routes/api.js` | REST API：`GET` / `POST` / `PUT` / `DELETE /api/loans` |
| `middleware/security.js` | 登录拦截 `requireLogin`、CSRF token 生成与校验 |
| `lib/view.js` | 展示辅助：类别/状态标签、逾期判断、表单回填 |
| `models/database.js` | 连接 Atlas 并选择数据库（与 B 共享，A 负责调用与关闭） |
| `scripts/seed-users.js` | 建立演示登录账号（`member1` / `member2`） |

## 4. 环境变量
| 变量 | 默认值 | 说明 |
|---|---|---|
| `MONGODB_URI` | `models/database.js` 中的常量 | Atlas Drivers 连接串 |
| `DB_NAME` | `comp3810_groupG62` | 目标数据库名，必须与 B 的共享库一致 |
| `PORT` | `8099` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址，默认只允许 VM 本机访问 |
| `SESSION_SECRET` | 内置演示值 | 会话签名密钥，至少 32 字符 |

## 5. 启动步骤
```bash
cd <项目根目录>
npm install
node scripts/seed-users.js    # 首次或需要时建立演示账号
npm start
```
- 启动日志应显示 `Atlas database: comp3810_groupG62 (loans: 35, users: 2)`。
- 浏览器打开 http://127.0.0.1:8099/login，登录 `member1 / Member1Pass!`。

## 6. 登录账号
| 账号 | 密码 |
|---|---|
| `member1` | `Member1Pass!` |
| `member2` | `Member2Pass!` |

## 7. 联调验收清单
- [ ] 服务可连接共享 Atlas 库 `comp3810_groupG62`
- [ ] 列表显示 35 台设备（编号 / 类别 / 状况 / 状态）
- [ ] 未登录访问网页时跳转到 `/login`
- [ ] 所有写操作（新增 / 编辑 / 删除 / 退出）需有效 CSRF token
- [ ] 借期 1–14 天规则、损坏停用、归还清空
- [ ] REST API CRUD 正常，非法 JSON 返回受控错误
- [ ] 服务器重启后数据仍然存在

## 8. 安全注意事项
- `models/database.js` 中的连接串为占位符 `PASTE_YOUR_ATLAS_DRIVER_URI_HERE`，**不要把真实 URI / 密码写进共享文档、截图或公开仓库**。
- 每位成员可用 `MONGODB_URI='...' npm start` 临时覆盖，或私聊数据库负责人 B 索取后填入本地副本。
- 服务默认只监听 `127.0.0.1`，仅 VM 本机可访问；如需局域网 / 公网演示，先评估安全风险。
