# aiisx / personal system

基于 Vite、React、TypeScript 和 Hono 的个人博客与生活数据面板。

## 本地运行

```bash
npm install
npm run dev:all
```

前端地址为 `http://localhost:5173/`，API 地址为 `http://localhost:8787/`。

## 管理员登录

后台文章管理使用服务端会话认证。先在项目根目录 `.env` 设置管理员令牌：

```dotenv
ADMIN_TOKEN=请替换为一段随机长字符串
```

然后重启 API，访问 `/login` 登录。成功后服务端会发放 7 天有效的 HttpOnly Cookie；文章草稿列表、编辑、发布和撤回都需要有效会话。不要把 `ADMIN_TOKEN` 提交到 Git 或写入前端代码。

可以使用 Node 生成随机令牌：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 数据同步

```bash
npm run sync:platforms
npm run sync:platforms:schedule
```

同步任务默认每天 12:00 和 20:00 执行。所有同步结果都会持久化到下方配置的 SQLite 数据库。

## SQLite 数据库

项目的文章、Switch、Steam、Xbox 和健身数据统一保存在 SQLite。未配置数据库地址时，本地默认使用：

```dotenv
DATABASE_URL=file:./data/aiisx.db
```

`data/` 已加入 `.gitignore`。不要把运行时数据库提交到 Git。生产数据库的快照、按时间点恢复和回切步骤见 [生产运维手册](docs/operations.md)。

### 从旧 MySQL 迁移

把原有 MySQL 地址放入 `MYSQL_DATABASE_URL`，然后执行一次迁移：

```dotenv
MYSQL_DATABASE_URL=mysql://user:password@localhost:3306/aiisx
DATABASE_URL=file:./data/aiisx.db
```

```bash
npm run migrate:mysql
```

迁移命令会复制文章、Switch 历史、Steam、Xbox 和健身数据，重复执行时会按照各表主键覆盖相同记录。

### Vercel 持久化

Vercel Function 的本地文件不能作为持久数据库。部署 Vercel 时需要使用兼容 libSQL 的托管 SQLite，并配置：

```dotenv
DATABASE_URL=libsql://your-database-host
DATABASE_AUTH_TOKEN=your-database-token
```

本地文件 SQLite 和远程 libSQL 使用同一套表结构与业务代码。

## Vercel 部署

### 1. 上传现有 SQLite

先在本地完成 Xbox 登录，确保最新凭证已经加密写入 `data/aiisx.db`：

```bash
npm run auth:xbox
```

Windows 使用 WSL 安装 Turso CLI，然后从现有文件创建远程数据库：

```bash
turso auth login --headless
turso db create aiisx --from-file ./data/aiisx.db
turso db show aiisx --url
turso db tokens create aiisx
```

最后两个命令分别得到 `DATABASE_URL` 和 `DATABASE_AUTH_TOKEN`。

### 2. 配置 Vercel

在 Vercel 导入 GitHub 仓库 `NewYorkDoll/aiisx`，Framework Preset 选择 Vite。项目已经通过 `vercel.json` 固定以下配置：

```text
Build Command: npm run build
Output Directory: dist
Node.js: 24.x
```

在 Project Settings / Environment Variables 中配置 Production 环境变量：

```dotenv
DATABASE_URL=libsql://your-database-host
DATABASE_AUTH_TOKEN=your-database-token
ADMIN_TOKEN=与本地保持一致
CRON_SECRET=独立随机长字符串
KEEPSTRONG_BASE_URL=https://lianlian.gzyunke.cn
KEEPSTRONG_API_KEY=
KEEPSTRONG_TIMEZONE_OFFSET=480
SWITCH_CLIENT_ID=
SWITCH_SESSION_TOKEN=
STEAM_API_KEY=
STEAM_ID=
R2_ACCOUNT_ID=Cloudflare账户ID
R2_ACCESS_KEY_ID=R2令牌的Access Key ID
R2_SECRET_ACCESS_KEY=R2令牌的Secret Access Key
R2_BUCKET=aiisx-media
R2_PUBLIC_URL=https://media.aiisx.com
```

不要在 Vercel 设置 `SQLITE_DATABASE_URL=file:...` 或 `HTTPS_PROXY`。当前 Xbox 凭证使用本地 `ADMIN_TOKEN` 加密，因此部署环境中的 `ADMIN_TOKEN` 必须完全相同；如果本地明确设置过 `XBOX_TOKEN_ENCRYPTION_KEY`，部署时也必须设置相同值。

### 3. 验证部署

部署成功后依次检查：

```text
https://your-domain.vercel.app/api/health
https://your-domain.vercel.app/game-are-life
https://your-domain.vercel.app/fitness
https://your-domain.vercel.app/login
```

`vercel.json` 配置了北京时间约 12:00 和 20:00 的两次平台同步。Vercel Cron 使用 UTC，因此对应表达式为 `0 4 * * *` 和 `0 12 * * *`。Hobby 套餐的触发时间可能在对应小时内浮动。

生产环境的备份、恢复与故障处理流程见 [生产运维手册](docs/operations.md)。

## 图片与视频

文章编辑器支持 JPEG、PNG、WebP、GIF、AVIF 图片以及 MP4、WebM 视频。图片上限为 25 MB，视频上限为 500 MB。文件由浏览器使用 10 分钟有效的签名地址直接上传到 Cloudflare R2，不经过 Vercel Function；R2 凭据始终保留在服务端。视频会在浏览器中尽量生成一张本地封面。

在 Cloudflare 控制台创建名为 `aiisx-media` 的 R2 bucket，然后完成以下配置：

1. 在 bucket 的 Settings / Custom Domains 中绑定 `media.aiisx.com`。
2. 创建只允许该 bucket 读写对象的 R2 API Token，把 S3 凭据和账户 ID 写入 Vercel 环境变量。
3. 在 bucket 的 CORS Policy 中保存：

```json
[
  {
    "AllowedOrigins": [
      "https://aiisx.com",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

生产环境只需要 `https://aiisx.com`；`http://localhost:5173` 用于本地编辑器测试。Cloudflare 签名上传必须使用 R2 S3 API 地址，公开文章则通过 `R2_PUBLIC_URL` 的自定义域名读取媒体。

编辑器中的图片使用标准写法 `![说明](图片地址)`。原生视频和可信播放器由编辑器自动插入结构化指令；外部播放器目前只允许 YouTube 与 Bilibili，不渲染文章中的任意 HTML 或未知 iframe。

## Xbox 凭证

Xbox 登录凭证会使用 AES-256-GCM 加密并保存到 SQLite。加密密钥优先读取 `XBOX_TOKEN_ENCRYPTION_KEY`，未配置时使用 `ADMIN_TOKEN`：

```dotenv
XBOX_TOKEN_ENCRYPTION_KEY=请替换为独立随机长字符串
```

首次执行 `npm run auth:xbox` 或平台同步时，会自动把已有的 `.xbox.tokens.json` 导入数据库。部署后必须保持加密密钥不变，否则无法解密已经保存的 Xbox 凭证。

## Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
