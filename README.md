# COMP3810：校园设备借用登记簿

## 1. 项目介绍

使用 **Node.js / Express 5、EJS、MongoDB Atlas** 实现校园设备库存与免费借用管理。Ubuntu VM 运行网页服务，Atlas 保存数据；VM 不需要安装 MongoDB 服务器。系统先保存带唯一编号的设备，再提供登录/退出、设备增删改查、借出/归还、损坏停用、备注、组合搜索、逾期提示和 REST API。老师的题目没有要求收费，本项目不计算费用。

数据流：`浏览器或 curl → Express 路由 → 数据层 → MongoDB Atlas`。网页登录后，两个预设账号均可管理全部记录；本项目是借用登记簿，不含库存数量或预约冲突检查。

这是完整参考实现；课程禁止直接提交纯 AI 完成的项目，请理解代码、完成自己的开发和验证，并如实说明参考来源。

## 2. 组信息及四人分工

**组号：1（占位，请改为实际组号；同时检查文件夹名和数据库名）**

| 成员 | 姓名 / SID | 主责 | 交付内容 |
|---|---|---|---|
| A | 待填 / 待填 | 路由 | `server.js`、`app.js`、`routes/`、`middleware/`、`lib/view.js`、`scripts/seed-users.js`；登录、会话、请求处理、逾期计算与整合 |
| B LI Lili | 待填 / 待填 | 数据库 | `models/`、`scripts/check-db.js`、`scripts/seed_data.js`；Atlas、字段校验、CRUD、搜索、用户及示例设备数据初始化 |
| C | 待填 / 待填 | UI | `views/`、`public/`；页面、表单、搜索框、样式、错误与逾期显示 |
| D | 待填 / 待填 | 测试 | `tests/`、测试/演示脚本及测试记录；正常/异常流程、Ubuntu 联调、演示协调 |

每个人先验证自己的模块，再由 D 组织集成验收。新增流程：C 的表单 → A 的路由 → B 的保存函数 → C 的结果页面；D 检查全过程。B 不负责 HTTP 状态码，A 不直接在路由中编写数据库查询，C 不接触 Atlas 密码。

## 3. 文件与数据介绍

| 路径 | 作用 |
|---|---|
| `server.js` | 连接 Atlas、启动服务及关闭连接 |
| `app.js` | 组装 Express、会话、模板、网页/API 路由及错误响应 |
| `models/database.js` | 数据库连接与相关初始化 |
| `models/loan_store.js` | `list/get/create/update/remove`，供网页和 API 共用 |
| `models/user_store.js` | 查找账号、创建缺少的账号 |
| `models/validation.js` | 业务字段、ID 和搜索条件校验 |
| `routes/auth.js`、`web.js`、`api.js` | 登录/退出、网页 CRUD、REST CRUD |
| `middleware/security.js` | 登录保护及网页表单安全校验 |
| `lib/view.js`、`views/`、`public/` | 页面辅助函数、EJS 模板与静态样式 |
| `scripts/seed_data.js` | B第一次手动运行：插入20台平板、10台电脑和5台摄像机；不包含登录代码 |
| `scripts/seed-users.js` | A整合登录时创建两个演示账号 |
| `scripts/check-db.js` | 只连接并 ping Atlas，不写数据 |
| `scripts/check-syntax.js` | JavaScript 语法检查 |
| `scripts/demo-api.sh` | curl 演示，检查状态码和数据，并清理自己创建的记录 |
| `scripts/test-atlas.js` | 在专用测试库验证真实 MongoDB 操作 |
| `tests/` | 校验、网页和 API 等自动测试 |
| `package.json`、`package-lock.json` | 启动/测试命令及固定依赖版本 |

`loans` 每条记录有十一个可编辑字段；`_id`、`createdAt`、`updatedAt` 由数据库/服务器管理。

| 字段 | 格式 | 例子 |
|---|---|---|
| `itemCode` | 唯一；1–20个字母、数字或连字符，保存为大写 | `TAB-001` |
| `itemName` | 去首尾空格后的 1–80 字符 | `Camera A` |
| `category` | `tablet` / `laptop` / `camera` | `tablet` |
| `condition` | `good`（正常）/ `damaged`（损坏） | `good` |
| `notes` | 可为空，最多300字符 | `屏幕左下角有划痕` |
| `borrower` | 借出时填写1–80字符；可借时为空 | `Demo Student` |
| `contactPhone` | 借出时必填的7–30字符联系电话 | `+852 9123 4567` |
| `contactEmail` | 借出时必填的邮箱 | `student@example.com` |
| `borrowDate` | 借出时填写有效的 `YYYY-MM-DD` | `2026-11-10` |
| `dueDate` | 借出时填写有效的 `YYYY-MM-DD`；可借时为空 | `2026-11-20` |
| `status` | `available`（可借）/ `borrowed`（借出）/ `unavailable`（停用） | `available` |

业务规则：正常设备可设为可借或借出；损坏设备必须设为停用，不能借出。借用期限为1–14天。超过应还日期后仍保持借出状态，页面显示逾期提示，由管理员按电话或邮箱联系借用人，不计算费用。归还后借用人、联系方式和两个日期自动清空。损坏归还时选择 `damaged + unavailable` 并填写备注；维修后改回 `good + available`。

`users` 保存唯一 `username` 和 `passwordHash`，不保存明文密码。Atlas 网站账号、Atlas 数据库用户、网页的 `member1/member2` 是三种不同账号。

## 4. 操作指南

### 4.1 准备 Ubuntu 与 Atlas

1. 将整个 `comp3810sef_group1` 文件夹放进 Ubuntu VM；以下命令在 **Ubuntu Terminal** 执行。
2. 使用 Node.js 20 或更新版本和 npm，四人尽量保持相同主版本。执行 `node -v`、`npm -v` 确认可用。
3. 在 Atlas 创建供应用使用的数据库用户，赋予目标数据库读写权限；将 Ubuntu 网络的**公网出口 IP** 加入项目 IP 访问列表。VM 的 `192.168.*` 私网 IP 通常不是公网出口 IP。
4. 在集群中选择 **Connect → Drivers → Node.js**，复制连接串。它通常以 `mongodb+srv://` 开头；Atlas 网页登录链接不是程序连接串。替换其中数据库用户名/密码，保留真实集群地址和连接选项；密码特殊字符需 URL 编码。

```bash
cd ~/实际存放位置/comp3810sef_group1
npm install
nano models/database.js
```

在 `models/database.js` 中把 `PASTE_YOUR_ATLAS_DRIVER_URI_HERE` 替换为 Atlas 的真实 Drivers 连接串；`dbName` 默认已与数据库负责人 B 的共享库对齐（`comp3810_groupG62`），如实际组号不同再改。连接串包含数据库账号密码，不要上传公开仓库或出现在演示截图中。登录脚本由A负责；当前演示账号为 `member1 / Member1Pass!` 和 `member2 / Member2Pass!`。

不想改代码时，用环境变量覆盖（A 的启动配置）：

| 环境变量 | 默认值 | 作用 |
|---|---|---|
| `MONGODB_URI` | `models/database.js` 中的常量 | Atlas Drivers 连接串 |
| `DB_NAME` | `comp3810_groupG62` | 目标数据库名，必须与 B 的共享库一致 |
| `PORT` | `8099` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址，默认只允许 VM 本机访问 |
| `SESSION_SECRET` | 内置演示值 | 会话签名密钥，至少32字符 |

```bash
MONGODB_URI='mongodb+srv://<user>:<pwd>@<cluster>/...' DB_NAME=comp3810_groupG62 npm start
```

### 4.2 首次运行

```bash
node scripts/check-db.js
node scripts/seed_data.js
node scripts/seed-users.js
npm start
```

- `node scripts/check-db.js` 只检查 Atlas 连通性，不新增记录。
- `node scripts/seed_data.js` 是B的一次性设备初始化：在 `loans` 中插入20台平板（`TAB-001`–`TAB-020`）、10台电脑（`LAP-001`–`LAP-010`）和5台摄像机（`CAM-001`–`CAM-005`）。初始状况全部正常、状态全部可借；重复运行会按编号跳过已有设备。
- `node scripts/seed-users.js` 是A整合登录时运行的账号初始化，不属于B当前设备数据库阶段。
- `npm start` 启动时会打印 `Atlas database: <库名> (loans: N, users: M)`：先确认库名是共享库、`loans` 为 **35**、`users` 为 **2**。若提示 `loans is empty`，说明连接串或 `DB_NAME` 不对，先修正配置，不要重复跑 seed。
- 在 **Ubuntu 浏览器** 打开 `http://127.0.0.1:8099`，使用上面列出的演示账号登录。
- `Ctrl+C` 停止服务，再次执行 `npm start` 可启动。借用数据保存在 Atlas；单进程演示使用内存会话，重启后需要重新登录。

不要把 Windows 浏览器中的 `127.0.0.1` 当成 Ubuntu VM 的地址。首次验证直接在 Ubuntu 浏览器完成。

### 4.3 网页操作与手工验收

| 操作 | 预期结果 | 主责 |
|---|---|---|
| 未登录访问借用页面 | 跳转登录，无法直接操作 | A / D |
| 错误密码，再用正确密码登录 | 错误有提示，正确进入列表 | A / D |
| 初始化后查看库存 | 应有20台平板、10台电脑、5台摄像机，全部可借 | B / D |
| 输入编号或名称，并选择类别、状态搜索 | 结果满足全部条件；清除后恢复列表 | A / B / C / D |
| 选择一台设备，设为 `borrowed` 并填写借用人、电话、邮箱和日期 | 期限1–14天时保存成功，超出范围时拒绝 | A / B / C / D |
| 归还时选择 `damaged + unavailable` 并写备注 | 借用信息被清空，设备显示损坏/停用且不能再借 | A / B / C / D |
| 建立到期日已过且 `borrowed` 的设备 | 显示逾期和联系方式；归还后不再逾期且借用信息清空 | A / C / D |
| 空设备名、无效日期等输入 | 拒绝保存并提示；数据库不出现坏记录 | B / C / D |
| 删除自己新建的测试记录 | 列表和数据库均不再包含它 | A / B / C / D |
| 保留一条测试记录，重启并重新登录 | 数据仍存在，演示持久化；随后自行删除 | B / D |
| 退出后再次打开受保护页面 | 要求重新登录 | A / D |

UI 的提交通过网页路由完成；网页表单带安全校验信息，演示脚本使用独立的 JSON API。

### 4.4 REST API 与 curl 演示

按课程允许，**API 在本地演示时无须登录**；网页 CRUD 仍要求登录。默认只监听本机 `127.0.0.1`。如改为对外服务，应先补充 API 认证、HTTPS 和持久会话等部署配置。

| 方法 | 路径 | 成功响应 |
|---|---|---|
| GET | `/api/loans?q=CAM-001&category=camera&status=available` | `200`，JSON 数组；三个参数均可省略；关键词匹配编号或名称 |
| GET | `/api/loans/:id` | `200`，单条 JSON 对象 |
| POST | `/api/loans` | `201`，含 `_id` 的新对象 |
| PUT | `/api/loans/:id` | `200`，更新后的对象；必须提供全部十一个业务字段 |
| DELETE | `/api/loans/:id` | `204`，没有正文 |

POST / PUT 示例正文：

```json
{
  "itemCode": "CAM-001",
  "itemName": "Camera A",
  "category": "camera",
  "condition": "good",
  "notes": "Checked before loan",
  "borrower": "Demo Student",
  "contactPhone": "+852 9123 4567",
  "contactEmail": "demo@example.com",
  "borrowDate": "2026-11-10",
  "dueDate": "2026-11-20",
  "status": "borrowed"
}
```

坏字段/坏 ID 返回 `400`；格式正确但不存在的 ID 返回 `404`。PUT 更新成相同内容仍算成功。

保持 `npm start` 的终端运行，在 Ubuntu **另开终端**进入同一项目目录：

```bash
bash scripts/demo-api.sh
```

脚本要求 `curl` 和 `node`，不需要 `jq`。它依次新建 → 按 ID 读取 → 组合搜索 → 修改 → 删除 → 验证已删除，检查 HTTP 状态码及实际返回值；只删除本次脚本新建的记录。中途失败时也尝试清理该记录。自定义地址示例：`BASE=http://127.0.0.1:8099 bash scripts/demo-api.sh`。

### 4.5 自动测试与真实 Atlas 验证

```bash
npm run check
npm test
```

`check` 检查 JavaScript 语法和EJS模板编译；`npm test` 使用内存替身验证业务与 HTTP 流程，**不连接 Atlas**，因此不能替代真实数据库及 Ubuntu 浏览器验收。实际已完成的检查见 [验证记录](VERIFICATION.md)。

只有在你明确决定运行真实数据库测试时，才打开 `scripts/test-atlas.js`，确认 `testDbName` 以 `_test` 结尾，再把 `runAtlasTest` 改为 `true`。它会在专用测试库写入并清理测试数据；不要把正式联调库当测试库。然后执行：

```bash
npm run test:atlas
```

完成后立即把 `runAtlasTest` 改回 `false`。此处命令仅提供操作方法，不代表已经连接或通过你们的 Atlas。

D 应记录：日期、Node 版本、测试命令、结果、网页验收、发现的问题及修复复测；避免记录真实 URI 或密码。

### 4.6 排错、演示与提交

| 现象 | 检查 |
|---|---|
| Atlas 连接超时 | VM 能否联网、Atlas IP 访问列表是否包含当前公网出口 IP、集群是否可用 |
| Authentication failed | URI 使用数据库用户而非 Atlas 网站账号；密码及特殊字符编码是否正确 |
| not authorized | 数据库用户权限是否覆盖 `models/database.js` 中 `dbName` 指定的库 |
| 启动日志 `loans: 0` | 连接串或 `DB_NAME` 与 B 的共享库不一致；确认连的是同一个 Atlas 集群/库后再决定是否 seed |
| 登录失败 | 是否先运行 seed；网页密码是否对应已创建账号；seed 不会重置旧密码 |
| 端口占用 | 停止自己之前启动的应用，或修改 `server.js` 中的 `port`；浏览器与 BASE 同步修改 |
| 重启后掉线 | 内存会话的预期行为，重新登录；借用数据仍在 Atlas |
| 测试通过但真实应用失败 | 内存测试不能验证 Atlas 网络/凭据，继续执行 `node scripts/check-db.js` 和实际网页流程 |

10 分钟演示建议：A 用 1 分钟讲架构与分工、1 分钟讲登录；C 用 3 分钟展示完整网页 CRUD 与搜索；B 用 2 分钟展示 Atlas 数据变化、查询和持久化；D 用 3 分钟运行 curl、说明异常与测试结果。每个人讲自己的实现原理，展示前先准备虚构数据。

提交前填写姓名/SID/实际组号、确认老师要求与截止时间，并从项目文件夹的**上一级目录**打包：

```bash
zip -r comp3810sef_group1.zip comp3810sef_group1 \
  -x '*/node_modules/*' '*/.git/*' '*/coverage/*' '*.log'
unzip -l comp3810sef_group1.zip
```

保留 `package-lock.json`。连接串直接写在代码中时，只使用权限受限的课程数据库用户，并按老师要求决定提交凭据的方式。B先运行一次 `node scripts/seed_data.js`；整合后由A建立登录账号，再执行 `npm start`。
