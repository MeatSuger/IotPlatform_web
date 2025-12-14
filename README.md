# Font (Web Frontend)

Vite + Vue 3 + TypeScript 前端应用。

项目结构

- `package.json`：依赖与脚本
- `vite.config.ts`：开发与构建配置（含代理）
- `src/`：源码
  - `main.ts` / `App.vue`：入口与根组件
  - `router/`：路由
  - `stores/`：Pinia 状态管理
  - `services/`：接口封装（如 `auth.ts`）
  - `utils/request.ts`：HTTP 请求封装
  - `views/`：页面（如 `LoginPage.vue`）

环境要求

- Node.js 18+（建议）
- npm / pnpm / yarn（任选其一）

开发与运行

```powershell
cd .\font
node -v
npm install
npm run dev
```

构建与预览

```powershell
npm run build
npm run preview
```

环境变量

- 如需区分环境，请添加 `.env.development` / `.env.production` 等文件，并在代码中通过 `import.meta.env` 使用
- 若与后端联调，请在 `vite.config.ts` 中配置代理到后端地址

常见问题

- 跨域：确保后端 CORS 策略允许前端域名或使用代理
- 接口地址：修改 `utils/request.ts` 或环境变量以匹配后端地址
- 依赖问题：删除 `node_modules` 并重新 `npm install`
