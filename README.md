# 轻量物料进销存 MVP

简易库存管理(非完整 ERP)。技术栈: **Vue3 + Element Plus + Node.js Express + MySQL**。

## 核心铁则

> **库存 = 累计入库流水 - 累计出库流水**
> 数据库里**没有**"库存"字段，一切库存数字均由 `flows` 出入库流水实时推导，禁止直接修改库存。所有单据留痕(操作人 + 操作时间)，可审计。

## 功能清单

| 模块 | 说明 | 权限 |
|------|------|------|
| 登录 | 账号密码登录，JWT 鉴权，失败5次锁定15分钟(防爆破) | 全部 |
| 物料档案 | 唯一编码(CL/BZ/WL大类)/名称/规格/单位/分类/商品分组/安全库存，Excel批量导入 | 管理员/超管可维护 |
| 产品配方(BOM) | 成品 = 多个配件×单件耗用量，建配方后按成品出入库 | 管理员/超管 |
| 入库单 | 按物料批量 或 按成品入库，Excel导入 | 全部 |
| 出库单 | 按物料批量 或 按成品出库(自动扣配件)，带出库方向 | 全部 |
| 在途物料 | 采购在途登记 → 到货勾选"确认入库"一键入库 | 全部 |
| 库存看板 | 实时库存+可组装成品数(瓶颈配件)+低库存预警+筛选排序+Excel导出 | 全部 |
| 流水台账 | 筛选 + 作废(红冲) + 出库方向列 + Excel导出 | 全部(作废仅管理员) |
| 审计日志 | 记录全部操作(谁+动作+详情+IP) | 管理员/超管 |
| 用户管理 | 增删用户、改角色、重置密码 | 超级管理员 |
| 系统设置 | 系统名称/默认安全库存/低库存预警开关 | 超级管理员 |

## 项目目录

```
inventory-mvp/
├── sql/
│   └── init.sql                  # 建表 SQL(后端启动时自动执行, 也可手动执行)
├── server/                       # 后端 Node.js Express
│   ├── app.js                    # 入口: 启动时自动建库建表+初始化默认账号
│   ├── package.json
│   ├── .env                      # 数据库/JWT 配置(本地)
│   ├── config/
│   │   └── db.js                 # MySQL 连接池
│   ├── middleware/
│   │   └── auth.js               # JWT 鉴权 + 角色校验(管理员/超管)
│   ├── routes/
│   │   ├── auth.js               # 登录(限流) + 当前用户
│   │   ├── materials.js          # 物料档案 CRUD + Excel导入
│   │   ├── products.js           # 成品 + BOM配方管理
│   │   ├── flows.js              # 批量入库/出库/成品出入库/作废/导入 + 台账
│   │   ├── inventory.js          # 库存看板/统计/可组装成品/低库存
│   │   ├── intransit.js          # 在途物料
│   │   ├── users.js              # 用户管理(仅超管)
│   │   ├── settings.js           # 系统设置(仅超管可改)
│   │   └── audit.js              # 审计日志
│   ├── scripts/
│   │   ├── initDb.js             # 建库建表 + 初始化默认账号
│   │   └── changePassword.js     # 改密码工具
│   └── utils/
│       ├── flowNo.js             # 流水号(原子序列表, 并发不撞号)
│       ├── audit.js              # 操作审计
│       ├── paginate.js           # 分页安全解析
│       ├── materialCat.js        # 物料大类推断
│       └── excel.js              # Excel 导出
├── frontend/                     # 前端 Vue3 + Element Plus
│   ├── src/
│   │   ├── views/                # 各页面(看板/物料/产品配方/出入库/在途/台账/审计/用户/设置)
│   │   ├── router/index.js
│   │   ├── api/index.js
│   │   └── layout/MainLayout.vue # 布局+角色菜单
├── excel模板/                    # 四表/五表 Excel 模板
└── *.bat                         # 一键启动/局域网/MySQL远程脚本
    ├── index.html
    ├── vite.config.js            # /api 代理到后端 3000
    ├── package.json
    └── src/
        ├── main.js               # 入口(挂载 Element Plus 中文)
        ├── App.vue
        ├── router/index.js       # 路由 + 登录守卫
        ├── api/index.js          # axios 封装(token/错误拦截)
        ├── utils/auth.js         # 登录态存取
        ├── layout/MainLayout.vue # 侧边栏 + 顶栏布局
        └── views/
            ├── Login.vue         # 登录页
            ├── Dashboard.vue     # 库存看板(低库存标红)
            ├── Materials.vue     # 物料档案(管理员维护)
            ├── Inbound.vue       # 入库单
            ├── Outbound.vue      # 出库单
            └── Flows.vue         # 流水台账 + Excel 导出
```

## 依赖清单

**后端 `server/package.json`:**
- `express` — Web 框架
- `mysql2` — MySQL 驱动(promise 连接池)
- `bcryptjs` — 密码加密
- `jsonwebtoken` — 登录令牌
- `cors` — 跨域
- `xlsx` — Excel 导出
- `dotenv` — 环境变量

**前端 `frontend/package.json`:**
- `vue` / `vue-router` — 框架与路由
- `element-plus` / `@element-plus/icons-vue` — UI 组件与图标
- `axios` — HTTP 请求
- `vite` / `@vitejs/plugin-vue` — 构建工具

## 本地启动步骤

### 1. 准备 MySQL

确保本机已安装并启动 MySQL(如 8.x)，创建一个数据库(也可不建，后端会自动建):

```sql
CREATE DATABASE IF NOT EXISTS inventory_mvp DEFAULT CHARACTER SET utf8mb4;
```

### 2. 配置后端数据库连接

```bash
cd server
copy .env.example .env        # Windows 复制为 .env
# 编辑 .env, 把 DB_PASSWORD 改成你的 MySQL 密码
```

> 不复制 .env 也可启动，默认连接 `127.0.0.1:3306`，用户 `root`，空密码，库名 `inventory_mvp`。

### 3. 启动后端

```bash
cd server
npm install
npm start                     # 启动后自动建库建表 + 创建默认账号
# 看到 "进销存后端已启动: http://127.0.0.1:3000" 即成功
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev                   # 打开 http://127.0.0.1:5173
```

### 5. 登录使用

| 角色 | 账号 | 密码 |
|------|------|------|
| 管理员(全权限) | `admin` | `admin123` |
| 操作员(仅录单/查询) | `operator` | `123456` |

## 默认端口与账号

- 生产模式(推荐日常使用): 单端口 `3000`，前端已构建由后端托管，双击 `start.bat` 即可，浏览器打开 `http://127.0.0.1:3000`
- 开发模式: 前端 `npm run dev`(端口 5173)，后端 `node app.js`(端口 3000)

## 局域网访问(同网络电脑直接使用)

1. 双击 `start.bat` 启动(单端口 3000)。
2. 双击 `enable-lan-access.bat`(会弹 UAC 确认，放行 Windows 防火墙 3000 端口)。
3. 在**同一网络**的其他电脑浏览器打开 `http://本机局域网IP:3000`。本机局域网 IP 见后端启动窗口横幅(例如 `http://192.168.1.142:3000`)。

> 无需数据库、无需装 Node —— 其他电脑只是浏览器访问，数据都在这台主机的 MySQL 里。

## 公网内网穿透(frp) —— 在外地也能访问

前提: 一台有公网 IP 的 VPS(阿里云/腾讯云/其他)。数据仍在本机，VPS 只负责转发。

**第 1 步：在 VPS 上运行 frps(服务端)**
- 从 https://github.com/fatedier/frp/releases 下载对应 VPS 系统的 frp 压缩包解压
- 把 `frp/frps.toml` 复制到解压目录(先改里面的 `auth.token` 成你自己的随机串)
- 执行 `./frps -c frps.toml`(Windows VPS 则 `frps.exe -c frps.toml`)
- 在 VPS 防火墙 / 云安全组放行 **7000** 和 **6000** 端口

**第 2 步：在本机运行 frpc(客户端)**
- 下载 frp 的 Windows 版解压到如 `C:\frp`
- 把 `frp/frpc.toml` 复制过去，改好三处: `serverAddr`(VPS公网IP)、`auth.token`(与上面一致)
- 双击 `frp/start-frpc.bat` 或执行 `frpc.exe -c frpc.toml`

**第 3 步：使用**
- 任何人(外地/手机)访问 `http://你的VPS公网IP:6000` 即可打开系统。
- 局域网内的电脑仍可直接用 `http://本机IP:3000`，两套并存互不影响。

## 两台电脑共用一套数据库(第二台电脑不用装MySQL)

适用: 主电脑有MySQL，办公室另一台电脑不能装MySQL，但想让两台电脑都各自跑系统、共用同一份数据。

**架构**: 第二台电脑运行自己的前端+后端，后端通过局域网连到**主电脑的MySQL**。第二台电脑只需装 **Node.js**，无需MySQL。

**主电脑一次性配置(已完成):**
- 已创建远程共享账号: `inventory_remote`(密码在 `server/.env.remote`，仅授权 `inventory_mvp` 库、仅限局域网 `192.168.1.%` 网段)
- MySQL 已监听 0.0.0.0:3306，无需改配置
- 需运行一次 `enable-lan-access.bat`(弹UAC放行防火墙 **3000** 和 **3306** 端口)

**第二台电脑操作:**
1. 安装 Node.js。
2. 拷贝整个 `inventory-mvp` 文件夹过去(可删 `node_modules`、`frontend/dist`，会自动重建)。
3. 把 `server\.env.remote` 复制为 `server\.env`(已填好主电脑IP和账号)。
4. 双击 `start.bat` 启动。若主电脑IP不是 `192.168.1.142`，改 `.env` 里的 `DB_HOST`。
5. 浏览器打开 `http://127.0.0.1:3000` 使用。

**注意事项:**
- 第二台电脑的数据实时写入主电脑数据库，两台看到的是同一份账目。
- 若第二台电脑与主电脑不在同一网段(`192.168.1.x`)，需在主电脑上扩大账号网段: 登录MySQL执行
  `CREATE USER IF NOT EXISTS 'inventory_remote'@'%' IDENTIFIED BY '密码'; GRANT ALL PRIVILEGES ON inventory_mvp.* TO 'inventory_remote'@'%'; FLUSH PRIVILEGES;`
- 更简单的替代方案: 第二台电脑其实**无需装任何东西**，直接浏览器访问 `http://主电脑IP:3000` 就能用(前面"局域网访问"一节)。只有当你想让第二台电脑也能独立启动系统时才需要本节的配置。

## 部署到 Linux 服务器(给别人用, 一劳永逸)

把整套系统部署到你的公网云服务器，**所有人(任何电脑/手机)直接访问服务器**，数据在服务器上、不依赖任何人的电脑开机，也无需内网穿透。

**适用**: 有 Linux 云服务器(Ubuntu/Debian)，希望别人通过公网 IP 访问。

**操作步骤:**
1. **上传项目**: 把本项目传到服务器，**排除** `node_modules` 和 `frontend/dist`(服务器上会自动安装/构建)。本机执行:
   ```
   rsync -av --exclude node_modules --exclude dist inventory-mvp/ root@服务器IP:/root/inventory-mvp/
   ```
   (或把文件夹打成zip上传后解压)
2. **一键部署**: SSH 登录服务器，进入项目目录执行:
   ```
   sudo bash deploy.sh
   ```
   脚本会自动: 安装 Node.js/MySQL/PM2 → 创建数据库和账号 → 安装依赖构建前端 → PM2 启动并设开机自启 → 放行3000端口。
3. **云控制台安全组**: 在云服务商控制台放行 **TCP 3000** 端口(入方向)。
4. **别人访问**: 浏览器打开 `http://服务器公网IP:3000` 即可。

**常用管理命令(服务器上):**
```
pm2 list                 # 查看服务状态
pm2 logs inventory-mvp   # 查看运行日志
pm2 restart inventory-mvp # 重启服务
```

> CentOS/RHEL 服务器: 安装命令不同(`dnf install -y mysql-server nodejs npm`)，其余步骤一致。建议先用 Ubuntu/Debian。

## 安全提醒(重要 —— 一旦对外网开放)

默认账号密码已在公网暴露风险极高，**上线前务必修改**：

1. **改默认密码**: 登录管理员后暂无改密界面，可执行 `server/scripts/changePassword.js`(见文件顶部说明)，或删库重来(见下方"忘记密码")。
2. **改 JWT 密钥**: 编辑 `server/.env`，把 `JWT_SECRET` 换成一段随机长字符串。
3. **改 frp 口令**: `frp/frps.toml` 与 `frp/frpc.toml` 的 `auth.token` 改为一致的随机串。
4. 若追求 HTTPS，可给 VPS 加域名 + 证书后改 frp 为 `type = "http"` 并配 `vhostHTTPPort`，或改用 Cloudflare Tunnel。

## 注意事项

- 出库时后端会先计算实时库存，库存不足会拒绝并提示，防止负库存。
- 物料"停用"为软删除，不影响历史流水引用。
- 操作员无物料档案维护权限，前端隐藏按钮 + 后端双重拦截。
- 忘记默认密码时，清空 `users` 表后重启后端会自动重建默认账号。
- 角色分三级: `superadmin`(超级管理员)/`admin`(管理员)/`operator`(操作员)，超管可管理用户与系统设置。
- 流水号由 `flow_seq` 序列表原子生成，并发不撞号。
- 作废(红冲)的流水不再计入库存，但保留在台账(划线显示)。

## 安全说明

- 已更换随机 `JWT_SECRET`；登录接口限流(同一IP失败5次锁15分钟)。
- 局域网脚本 `enable-lan-access.bat` 仅开放3000；3306 需单独运行 `enable-mysql-remote.bat`(用完运行 `close-mysql-remote.bat` 关闭)。
- 前端 Excel 由浏览器端 `xlsx` 库生成/解析，后端零文件依赖。
- 依赖 `xlsx@0.18.5` 为 SheetJS 在 npm 的最后版本(含已知CVE)，如后续升级可改用其官方维护源。
