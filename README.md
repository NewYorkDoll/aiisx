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

`data/` 已加入 `.gitignore`。部署前应单独备份数据库文件，不要把运行时数据库提交到 Git。

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
