# IoT Admin Platform

基于 [Fantastic-admin](https://fantastic-admin.hurui.me) 构建的 IoT 设备管理平台。

## 技术栈

- **框架**: Vue 3 + Vite 8 + TypeScript
- **UI**: Element Plus + UnoCSS
- **状态管理**: Pinia
- **图表**: ECharts + vue-echarts
- **包管理**: pnpm (monorepo)

## 功能

- 仪表盘 — 设备概览、实时数据图表
- 设备管理 — 设备列表、添加设备
- 数据监控 — 设备数据查询、趋势图表、自动刷新

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 代码检查
pnpm lint
```

## 环境变量

复制 `.env.development` 并根据需要修改：

```env
VITE_APP_API_BASEURL = http://localhost:8182/api
VITE_APP_TITLE = IoT Admin Platform
```

## 项目结构

```
apps/core-element-plus/
├── src/
│   ├── api/          # API 接口
│   ├── assets/       # 静态资源
│   ├── components/   # 公共组件
│   ├── layouts/      # 布局组件
│   ├── router/       # 路由配置
│   ├── store/        # Pinia 状态
│   ├── views/        # 页面
│   │   └── iot/      # IoT 业务页面
│   └── settings.ts   # 框架配置
├── vite.config.ts
└── .env.development
packages/              # 框架核心包
```

## License

MIT
