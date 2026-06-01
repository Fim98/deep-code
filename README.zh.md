<div align="center">

# deepcode

### Apple Music 风格的 [pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) 编程智能体桌面客户端

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a>
</p>

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/package-json/v/Fim98/deep-code)](package.json)
[![CI](https://github.com/Fim98/deep-code/actions/workflows/ci.yml/badge.svg)](https://github.com/Fim98/deep-code/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[报告 Bug](https://github.com/Fim98/deep-code/issues/new?template=bug_report.md) · [功能建议](https://github.com/Fim98/deep-code/issues/new?template=feature_request.md)

</div>

---

## ✨ 功能特性

- **原生桌面体验** — 基于 Electron 构建，在 macOS / Windows / Linux 上拥有原生应用般的流畅感受
- **Apple Music 风格界面** — 三栏分屏布局，半透明侧边栏，大留白、沉稳排版
- **pi 驱动** — 直接以进程内库的方式集成 `@earendil-works/pi-coding-agent`，无子进程开销
- **多工作区 & 多会话** — 同时管理多个项目和多个 AI 对话
- **丰富聊天时间线** — 流式响应、工具调用卡片、语法高亮代码块
- **内置终端** — 交互式 xterm.js 终端，支持 Bash 面板和 Diff 查看器
- **模型 & 提供商设置** — 配置 API Key，切换提供商，管理模型
- **文件树 & 预览** — 浏览项目文件，语法高亮预览
- **多窗口支持** — 打开多个窗口进行并行工作
- **国际化** — 支持多语言切换
- **可选遥测** — 基于 Sentry 的隐私友好型错误上报

## 🏗 架构

```
渲染进程 (React 19 + Tailwind CSS v4)
       │  ipcRenderer.invoke("pi:rpc", sid, cmd)
       ▼
Electron 主进程
       │  dispatchRpc(session, cmd)         ← 进程内函数调用
       ▼
@earendil-works/pi-coding-agent (每个会话一个 AgentSession)
```

- **主进程**直接导入 pi SDK 并管理 `Map<sessionId, AgentSession>`。无子进程、无 JSON-over-stdio — 渲染进程的每次 RPC 调用都是同一 V8 实例内的函数调用。
- **多工作区、多会话。** 每个 `AgentSession` 拥有独立的 `cwd` / `SessionManager` / 事件总线；共享的 `AuthStorage` 和 `ModelRegistry` 为单例。
- **IPC 载荷直接复用 pi 的 `RpcCommand` / `RpcResponse` 类型。**
- **渲染进程**使用 React 19 + Tailwind CSS v4，基于 Radix 的 UI 组件库，状态管理使用 Zustand。

## 📦 安装

### 环境要求

- **Node.js** ≥ 22
- **npm** ≥ 10

### 从源码构建

```bash
git clone https://github.com/Fim98/deep-code.git
cd deep-code
npm install
npm run dev
```

> 💡 首次安装会下载 Electron 二进制文件（约 100 MB）。网络较慢时可以设置镜像：
> ```bash
> ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
> ```

### 预编译安装包

从 [GitHub Releases](https://github.com/Fim98/deep-code/releases) 下载最新版本。

| 平台 | 格式 |
|------|------|
| macOS（Intel & Apple Silicon） | `.dmg` / `.zip` |
| Windows（x64 & arm64） | `.exe`（NSIS 安装器）/ `.zip` |
| Linux（x64 & arm64） | `.AppImage` / `.zip` |

## 🛠 开发

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发模式（热更新） |
| `npm run build` | 生产环境构建 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | Biome 代码检查 |
| `npm run format` | Biome 代码格式化 |
| `npm run test` | 运行全部测试（node + web） |
| `npm run test:node` | 运行主进程测试 |
| `npm run test:web` | 运行渲染进程测试 |
| `npm run package` | 构建并打包当前平台 |
| `npm run package:mac` | 打包 macOS（双架构） |
| `npm run package:win` | 打包 Windows（双架构） |
| `npm run package:linux` | 打包 Linux（双架构） |

### 项目结构

```
deep-code/
├── src/
│   ├── main/          # Electron 主进程
│   ├── preload/       # 预加载脚本（上下文桥接）
│   ├── renderer/      # React 渲染进程（UI）
│   └── test/          # 测试工具
├── resources/         # 应用图标和静态资源
├── .github/           # CI/CD 工作流和 Issue 模板
└── .husky/            # Git 钩子（commitlint）
```

## 🚀 路线图

完整的功能路线图和当前进度请查看 [ROADMAP.md](ROADMAP.md)。

### 已完成里程碑

| 里程碑 | 范围 | 状态 |
|--------|------|------|
| M1 | 项目脚手架 | ✅ |
| M2 | pi SDK 桥接 + IPC | ✅ |
| M3 | Apple Music 三栏布局 | ✅ |
| M4 | 工作区管理 | ✅ |
| M5 | 会话列表 | ✅ |
| M6 | 聊天时间线 | ✅ |
| M7 | 工具调用卡片 | ✅ |
| M8 | 模型 & 提供商设置 | ✅ |
| M9 | Bash 面板 + Diff 查看器 | ✅ |
| M10 | 打磨 + 上下文/花费栏 | ✅ |

## 🤝 参与贡献

我们欢迎各种形式的贡献！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何开始。

### 贡献者

感谢所有为 deepcode 做出贡献的人：

<!-- ALL-CONTRIBUTORS-LIST:START -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

| | |
|---|---|
| <a href="https://github.com/Fim98"><img src="https://github.com/Fim98.png" width="64" height="64" alt="Fim98" style="border-radius:50%"></a> | **[Fim98](https://github.com/Fim98)** — 创建者 & 维护者 |

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 🙏 致谢

- [pi coding agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) — 驱动 deepcode 的 AI 编程智能体 SDK
- [Electron](https://www.electronjs.org/) — 桌面应用框架
- [React](https://react.dev/) — UI 库
- [Tailwind CSS](https://tailwindcss.com/) — 原子化 CSS 框架
- [Radix UI](https://www.radix-ui.com/) — 无障碍 UI 基础组件

---

<div align="center">

用 ❤️ 打造，by [deepcode 贡献者](https://github.com/Fim98/deep-code/graphs/contributors)

</div>
