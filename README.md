# deepcode

An Apple Music–style Electron desktop client for the [pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) coding agent.

> **Status:** early scaffold. M1 (Electron + React + Tailwind + shadcn 脚手架) and M2 (in-process pi SDK bridge over IPC) are done. M3–M10 in progress.

## Architecture

- **Main process** directly imports `@earendil-works/pi-coding-agent` and manages a `Map<sessionId, AgentSession>`. No subprocess, no JSON-over-stdio — every renderer RPC call is a function call in the same V8 instance.
- **Multi-workspace, multi-session.** Each `AgentSession` carries its own `cwd` / `SessionManager` / event bus; shared `AuthStorage` and `ModelRegistry` are singletons.
- **IPC payloads reuse pi's `RpcCommand` / `RpcResponse` types** verbatim, but the implementation is a direct switch over `AgentSession` methods (`dispatchRpc`).
- **Renderer** is React 19 + TailwindCSS + shadcn/ui + ai-elements. State managed with Zustand.

```
Renderer (React)
       │  ipcRenderer.invoke("pi:rpc", sid, cmd)
       ▼
Electron Main
       │  dispatchRpc(session, cmd)         ← in-process function call
       ▼
@earendil-works/pi-coding-agent (AgentSession instance per session)
```

## Develop

```bash
npm install
npm run dev
```

> The first install downloads the Electron binary (~100MB). If you're on a slow link, set `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`.

## Build

```bash
npm run build
```

Outputs `out/main/index.js`, `out/preload/index.cjs`, `out/renderer/`.

## Status of features

| Milestone | Scope | Status |
|---|---|---|
| M1 | Scaffold | ✅ |
| M2 | pi SDK bridge + IPC | ✅ |
| M3 | Apple Music three-pane layout | ⏳ |
| M4 | Workspace management | ⏳ |
| M5 | Session list | ⏳ |
| M6 | Chat timeline | ⏳ |
| M7 | Tool call cards | ⏳ |
| M8 | Model + provider settings | ⏳ |
| M9 | Bash panel + diff viewer | ⏳ |
| M10 | Polish | ⏳ |

## License

MIT
