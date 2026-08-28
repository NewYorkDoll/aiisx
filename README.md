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

同步任务默认每天 12:00 和 20:00 执行。数据库使用 `DATABASE_URL` 配置；未配置数据库时只使用进程内存，重启后数据不会保留。

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
