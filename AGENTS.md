# Fantastic-admin · IoT 管理平台

## 关键规则：调用技能
只要任务可能与某个技能相关（页面 / CRUD / 表单 / 路由 / Store / 主题 / 框架设置等），
动手前必须先通过 `skill` 工具加载对应技能并遵循其流程。

- 仓库内技能位于 `.agents/skills/`：
  `fa-crud-page-generator`、`fa-form-builder`、`fa-page-optimizer`、`fa-route-generator`、
  `fa-store-generator`、`fa-slot-creator`、`fa-framework-settings`、`fa-theme-customizer`、`fa-feedback`。
- 以 `skill` 工具实际列出的可用技能为准（可能含插件提供的技能）。

## 项目概要
基于 Fantastic-admin 框架的 IoT 设备管理后台。**单一应用** `apps/core-element-plus`
（包名 `@fantastic-admin/core-element-plus`）。pnpm monorepo。
Node `^22.22.2 || ^24.15.0 || >=26`；packageManager `pnpm@11.9.0`。**只能用 pnpm**（禁 npm/yarn）。

## 常用命令
- 根目录 `pnpm dev` / `pnpm build` 是**交互式**（需选应用），agent 请直接跑应用级：
  - `pnpm --filter ./apps/core-element-plus dev`   （= vite）
  - `pnpm --filter ./apps/core-element-plus build` （= vue-tsc -b && vite build）
- 改动后必跑校验：根目录 `pnpm lint` = `run-s lint:tsc lint:eslint lint:stylelint`。
  eslint / stylelint 均带 `--fix`（会自动修正 UnoCSS 类顺序与缩进）。
  - 注意：应用级 `lint` 脚本只是 `vue-tsc -b`（仅类型，不含 eslint）。
  - 单文件快查：`pnpm exec eslint <文件> --fix`。
- 提交：pre-commit 触发 lint-staged（eslint + stylelint `--fix`）。commitizen 用 `pnpm commit`。

## 目录与边界
- `apps/core-element-plus/src/` — 应用。IoT 页面在 `views/iot/`；API 模块在 `api/modules/iot/`
  （device / control / data / sensor）；mock 在 `api/fake_modules/*.fake.ts`
  （vite-plugin-fake-server，命名 `<模块>.fake.ts`，仅 dev 生效）。
- `packages/components` — 框架内建 `Fa*` 组件。**只读，未经用户明确确认不得修改**；
  优先用内建组件而非第三方或自定义实现。
- `../back` — 同级 **Go 后端仓库**。接口权威文档：`../back/api/swagger/API.md`，前端须与其对齐。

## API 约定
- 后端**仅用 GET / POST**；统一响应 `{ code, message, data }`，`code===200` 为成功。
- axios baseURL 已含 `/api`（`.env.development`：`VITE_APP_API_BASEURL=http://localhost:8182/api`），
  模块内用相对路径（如 `/devices`）。拦截器返回完整响应体，业务数据在 `res.data`。
- 代码须同时兼容真实后端与 fake mock 两种返回形状（参考 `views/iot/device-list.vue` 的 `normalize()`）。
- WebSocket：`composables/useDeviceWebSocket.ts`（`VITE_WSS_URL`）。

## 自动导入（勿手写 import）
vue / vue-router / pinia API、`Fa*` 组件、`store/modules/*`、`composables/*`
均由 unplugin-auto-import + 组件解析器自动导入。

## 开发规范
- 使用 `<script setup lang="ts">`；组件命名 PascalCase，文件名与组件名一致。
- 样式优先 UnoCSS 原子类，复杂样式用 SCSS。
- Store 用 Pinia composition API 风格，放 `store/modules/`。

## 易踩坑
- 模板里内联 `@click="someRef = 'x'"` 赋值，会让 vue-tsc 对后续兄弟节点做类型收窄（TS2367）；
  请改用处理函数。
- UnoCSS 类顺序由 eslint（unocss/order）强制；改完 class 记得跑 `eslint --fix`。
- `FaTable`：多选需显式加 `{ type: 'selection' }` 列；想让某列填满剩余宽度，用
  `table-class="table-fixed"` 且该列不设 `width`、其余列设固定宽；`fixed`（固定）列必须给宽度。
- `FaTooltip` / `FaHoverCard` 内容是**深色底**，内部文字别用深色（如 `text-primary`）。

## 反复修改检测
使用任何 `fa-*` 技能时，若用户对同一功能点已要求修改 3 次及以上仍未达预期
（连续说「不对」/「再改改」/「还是不行」），必须触发 `fa-feedback` 技能，询问是否反馈给框架作者。
