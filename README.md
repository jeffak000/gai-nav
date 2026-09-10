# gai溜子导航站

一个简洁、紧凑、可自己托管的书签导航站。支持「个人区 / 工作区」等多分区切换，分类与书签可拖拽排序、跨分区移动，图标本地缓存、打开即读不联外网。后端运行在 **腾讯云 EdgeOne Makers**（边缘函数 + Blob 存储），无需自建服务器。

> 开源发布版**不携带任何书签数据**，首次打开是空的，由你自己添加。

## 🚀 一键部署

点击按钮，授权 GitHub 仓库后自动部署到 EdgeOne Makers：

[![Deploy to EdgeOne](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fjeffak000%2Fgai-nav&project-name=gai-nav&env=APP_PASSWORD&env-description=%E8%AE%BE%E7%BD%AE%E7%99%BB%E5%BD%95%E5%AF%86%E7%A0%81%EF%BC%88%E9%BB%98%E8%AE%A4%20admin%EF%BC%89)

部署完成后，控制台会提示你设置环境变量 `APP_PASSWORD`（即登录密码，不设置则默认 `admin`，**请务必修改**）。

## ✨ 功能特性

- **多分区**：默认「个人区 / 工作区」，可在设置里增删、重命名、拖拽或右键快速分到其他分区。
- **分类管理**：左侧固定分类栏，宽度可拖拽（120–440px）；分类可新增 / 编辑 / 删除 / 拖拽排序 / 右键分到其他分区。
- **书签卡片**：统一宽度、紧凑排列；支持拖拽改位置、拖到分类改归属、拖到分区标签改分区。
- **图标策略**：仅在「新增书签」或点「刷新图标」时抓取一次，之后只读本地缓存；再次打开页面**不主动联外网**（被墙站点自动回退为域名首字母占位图）。
- **右键菜单**：书签 / 分类均支持右键操作（打开、编辑、删除、移动分区等），无需悬停找按钮。
- **数据可携**：设置里支持一键备份（导出 JSON）/ 恢复（导入 JSON）/ 清空。
- **站点信息**：首页展示站点名、作者、网址与版本号；站点名可在「设置 → 站点信息」中修改。
- **登录保护**：写操作（增删改、备份恢复）需登录，Bearer Token 鉴权。

## 🧱 技术栈

- 前端：原生 `index.html` + `app.js`（无框架、无构建步骤）
- 后端：EdgeOne Makers 边缘函数（单文件 catch-all，`edge-functions/api/[[default]].js` 映射全部 `/api/*`）
- 存储：EdgeOne Blob 命名空间 `bookmarks`（首次访问自动创建）
- 鉴权：Web Crypto HMAC-SHA256 签名 Token

## 📁 目录结构

```
gai-nav/
├─ index.html                      # 前端页面与样式
├─ app.js                         # 前端逻辑（同源 + Bearer 鉴权）
├─ edge-functions/
│  └─ api/[[default]].js          # 后端：所有 /api/* 路由
├─ package.json                   # 声明 @edgeone/pages-blob（平台内置，通常无需 npm install）
├─ .env.example                   # 环境变量示例（APP_PASSWORD）
├─ deploy.sh / deploy.ps1         # 一键部署脚本
└─ LICENSE
```

> 数据文件（`data/*.json`）、`seed/`、`node_modules/`、`.edgeone/`、`.env` 均不在仓库内（见 `.gitignore`）。

## 🚀 一键部署（EdgeOne Makers）

> 前置：需要一个 **EdgeOne Makers API Token**（在 EdgeOne 控制台 → Makers → 创建 API Token 获取）。这是平台要求，无法省略。

**macOS / Linux**
```bash
./deploy.sh <你的_MAKERS_API_TOKEN> [项目名]
```

**Windows (PowerShell)**
```powershell
.\deploy.ps1 -Token <你的_MAKERS_API_TOKEN> [-Name gai-nav]
```

部署完成后：
1. 到 EdgeOne 控制台给该项目设置环境变量 `APP_PASSWORD=你的密码`（不设置则默认密码为 `admin`，**请务必修改**）。
2. 打开站点，点右上角「登录」即可进入设置、添加书签。

### 手动部署
1. 登录 EdgeOne 控制台 → 进入 Makers。
2. 新建项目，把本仓库整个文件夹拖拽上传（含 `index.html`、`app.js`、`edge-functions/`）。无需构建命令。
3. 设置环境变量 `APP_PASSWORD`（同上）。
4. 首次访问会自动创建 Blob 命名空间 `bookmarks`。

## 🔑 默认账号

- 默认登录密码：`admin`（未设置 `APP_PASSWORD` 环境变量时）。
- 登录后可在「设置 → 修改密码」中更改；或直接在控制台设置 `APP_PASSWORD` 环境变量覆盖。

## 💾 数据存储（Blob 命名空间 `bookmarks`）

- `data/categories.json` → `[{id,name,sort,group,created_at}]`
- `data/bookmarks.json`  → `[{id,category_id,title,url,icon,note,sort,group,visits,last_visit_at,created_at}]`
- `data/icons.json`      → `{"<host>": "data:image/png;base64,...."}`
- `data/groups.json`     → `[{id,name}]` 分区列表
- `data/password.json`   → `{"password":"..."}` 可选覆盖 `APP_PASSWORD`
- `data/site.json`       → 站点信息（名称 / 作者 / 网址）

## 🔌 主要接口

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| POST | `/api/login` | 密码登录，返回 Bearer Token | 公开 |
| GET | `/api/categories` | 列分类（`?group=` 过滤） | 公开 |
| POST/PUT/DELETE | `/api/categories[/:id]` | 新建 / 改 / 删（删分类级联删书签；改归属级联移书签） | 写需鉴权 |
| GET | `/api/bookmarks` | 列书签（`?group=` 过滤） | 公开 |
| POST/PUT/DELETE | `/api/bookmarks[/:id]` | 新建 / 改 / 删 | 需鉴权 |
| GET | `/api/icon?host=` | 取图标（只读缓存，无则回退字母图标） | 公开 |
| GET | `/api/icons` | 全部缓存图标 map | 公开 |
| POST | `/api/icons/refresh` | 显式刷新图标（全部或指定 `host`） | 需鉴权 |
| POST | `/api/password` | 修改登录密码 | 需鉴权 |
| GET/POST | `/api/backup`、`/api/restore` | 导出 / 导入全量 JSON | 需鉴权 |
| DELETE | `/api/data` | 清空全部数据 | 需鉴权 |
| GET/PUT | `/api/site` | 读取 / 修改站点信息 | 写需鉴权 |
| GET/POST/PUT/DELETE | `/api/groups[/:id]` | 分区增删改 | 写需鉴权 |

## 📝 License

[MIT](./LICENSE) © gai溜子到处跑
[![Deploy to EdgeOne](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fjeffak000%2Fgai-nav&project-name=gai-nav&env=APP_PASSWORD&env-description=%E8%AE%BE%E7%BD%AE%E7%99%BB%E5%BD%95%E5%AF%86%E7%A0%81%EF%BC%88%E9%BB%98%E8%AE%A4%20admin%EF%BC%89)
