# deepcode Roadmap

Status as of 2026-06-07.

## Context

The MVP is complete and builds successfully: workspace/session management,
in-process pi SDK bridge, chat timeline, composer, live tool cards, diff view,
Bash panel, model picker, provider auth UI, session rename/delete, themes,
keyboard shortcuts, and context/cost display.

The next route is not to turn deepcode into a separate agent platform. The
primary reference is `~/Documents/pi-mono`: deepcode should keep following pi's
SDK primitives (`AgentSession`, `AgentSessionRuntime`, `SessionManager`,
`AuthStorage`, `ModelRegistry`, `SettingsManager`, `ImageContent`).

`~/Documents/opencode` is useful as a productization reference for packaging,
PTY terminal architecture, typed local APIs, and MCP/plugin surface area. It is
not the model for deepcode's current core runtime.

Phases are priority bands, not strict release numbers. Effort labels: **S** <=
0.5d, **M** 1-2d, **L** 3-5d, **XL** > 1w.

---

## P0 — Alpha hardening

These items keep the app fast, verifiable, and aligned with the upstream pi API
before the feature surface grows.

### A1 · Bundle weight reduction — **S** — Done

The production build currently succeeds, but the renderer entry chunk is still
large. Split markdown/highlighting/diagram-heavy dependencies away from the app
shell.

**Tech**: configure Vite `manualChunks` for `streamdown`, `shiki`, `mermaid`,
Radix primitives, motion, icons, and React vendor code. Re-check generated
bundle sizes after every dependency change.

**Done**: Vite manual chunks split the renderer into app shell, vendor, React,
Radix UI, icons, motion, and markdown chunks. The main renderer entry chunk is
now ~127 kB.

---

### A2 · Basic test + CI baseline — **M** — Done

There are no test files yet. Add a minimal quality floor before runtime and
session behavior grows more complex.

**Tech**: add vitest for `dispatch-rpc.ts`, `workspace-store.ts`, and
`session-fs.ts`; add React tests for `Composer`, `ModelPicker`, and
`SettingsDialog`; add CI running `npm run typecheck` and tests.

**Done**: Test coverage now includes 325 tests. Node/main tests cover dispatch RPC, workspace/session filesystem, auth, plan tracking, file tree, pi resources, and related main-process helpers. Renderer tests cover session state, composer, model picker, settings, keyboard, resources/packages/tools panels, and UI utilities. GitHub Actions CI workflow runs typecheck + tests on every push/PR.

---

### A3 · Runtime/session alignment with pi — **L** — Done

The current desktop registry owns a `Map<sessionId, AgentSession>`, which is
enough for chat but blocks native pi session replacement flows. Commands such
as `new_session`, `switch_session`, `fork`, `clone`, and `get_commands` are
currently rejected by `dispatchRpc`.

**Tech**: introduce `AgentSessionRuntime` in the main-process registry and
route session replacement through pi's native runtime methods. Keep the
renderer-facing desktop session id stable while rebinding to the replaced pi
session.

**Done**: `session-registry.ts` now owns `AgentSessionRuntime` per entry. On
session replacement (new/fork/switch), `setRebindSession` re-subscribes event
listeners to the new pi session while keeping the desktop sessionId stable.
`dispatchRpc` accepts an optional runtime parameter and handles `new_session`,
`switch_session`, `fork`, `clone`, and `get_commands` natively. 7 new tests
cover all session replacement paths.

---

## P1 — Daily workflow

These are the controls users reach for during normal work.

### B1 · Command palette (Cmd+K) — **M** — Done
Single-shortcut launcher for:

- switch / create workspace
- switch / open / new session in current workspace
- switch model + thinking level
- toggle bash panel, theme, settings dialog
- invoke pi slash commands (`get_commands` already exists)

**Tech**: build the overlay with existing Radix-based dialog/input primitives.
New `components/command-palette/CommandPalette.tsx` plus a global `Cmd+K`
shortcut in `lib/keyboard.ts`. RPC: `get_commands`, `get_available_models`.

**Done**: `⌘K` opens a Radix Dialog-based overlay with fuzzy-search filtering,
grouped actions (Workspace, Session, Interface, Model, Thinking, Commands),
keyboard navigation (↑↓ + Enter), highlighted matches, and item badges.
Models and slash commands are fetched via RPC on open. 15 tests cover rendering,
filtering, action dispatch, keyboard nav, and RPC integration.

---

### B2 · Composer attachments (images + files) — **M** — Done
The composer should support drag/drop, file picking, and screenshot capture.
Agent `prompt` already accepts `ImageContent[]`.

**Tech**: extend the local composer with attachment chips, hidden file input,
drag/drop, and clipboard image handling. On submit, read each image file to
base64 and pass as `images: ImageContent[]` to
`pi.rpc.send(sid, { type: "prompt", message, images })`.

**Done**: Composer now supports image attachments via:
- 📎 Attach button (hidden file input, accepts png/jpeg/gif/webp)
- 📋 Clipboard paste (auto-detects image items)
- 🖱️ Drag & drop (with visual overlay)
- Chip display with thumbnail, filename, size, and remove button
- On submit: converts to base64 `ImageContent[]` and passes to RPC
- Send button enabled with attachments even without text
- 26 tests covering all attachment flows

---

### B3 · Settings dialog v2 — General + Providers + Models + About — **M** — Done

Today's `SettingsDialog` shows providers only. Split into a left-rail nested
layout:

| Tab | Content |
|---|---|
| General | Theme (move from header), startup workspace, ⌘ shortcuts hint |
| Providers | Current API key editor |
| Models | Enabled model patterns, custom models file hint |
| About | Version, links, "Open ~/.pi/agent/" button, diagnostics |

**Tech**: use pi `SettingsManager` instead of inventing a desktop-only settings
format. New main IPC `pi:settings:get` / `pi:settings:set` should write through
pi's settings manager.

**Done**: Settings dialog now has a left-rail tab navigation with four tabs:
- **General**: theme selector, default thinking level, auto-compaction, auto-retry, image handling, keyboard shortcuts reference
- **Providers**: existing API key management (configured list + add form)
- **Models**: enabled model patterns editor (textarea, one per line), block images toggle, models.json docs link
- **About**: app version, agent directory path, config file locations, external links

Main process uses pi `SettingsManager` via new `pi:settings:get/set` IPC.
Preload and renderer types updated. 18 tests cover all tabs and interactions.

---

## P2 — Shipping surface

### C1 · electron-builder packaging — **M** — Done
The app is currently dev-only. Ship `.dmg` (universal2), `.exe` (NSIS),
and `.AppImage`.

**Tech**: add `electron-builder.config.ts`, app icons (1024², .icns, .ico,
.png), `npm run package:mac|win|linux` scripts. Bundle the pi
dist directly (currently on `^0.78.1`), pin runtime deps so
`asarUnpack` covers `undici` and any native modules. Skip code signing
+ notarization in this milestone (separate cert work).

**Done**: `electron-builder.config.ts` updated with:
- `asarUnpack` for all `*.node` native addons and `undici`
- Linux target (`AppImage` + `zip` for x64/arm64)
- `package:linux` / `package:linux:x64` / `package:linux:arm64` scripts
- `@tailwindcss/postcss` moved from `dependencies` to `devDependencies`
- Test files excluded from `files` glob
- `npm run package:mac` produces working `.dmg` for arm64 (173MB) and x64 (179MB)
- Native modules (pi-tui, clipboard) correctly unpacked from asar
- Code signing + notarization deferred to a separate milestone

---

### C2 · Fork / branch tree visualization — **M** — Done
pi tracks session branches (`getEntries`, `getTree`, `fork`, `clone`).
Today there's no way to fork or visualize branches in deepcode.

**Tech**: new "Branches" panel that opens in the right side of the
session (or as a popover under the session header). Build a tree from
`SessionManager.getTree()` (need a new IPC + a renderer SVG/CSS tree).
"Fork from here" button on any user message → RPC `fork` with the
entry id → opens the new session.

**Done**: Added `BranchesPanel` popover in session header showing branch
count and fork points. "Fork" button appears on hover over each user
message in the timeline. Main-process `pi:session:tree` IPC serializes
`SessionManager.getTree()` for the renderer. Forking calls RPC `fork`
command then re-hydrates the session. `sessions.tree()` added to preload
bridge and renderer `PiBridge` types.

---

### C3 · Auto-updater — **M** — Done
Once C1 ships notarized builds, wire `electron-updater` so users get
patches without re-downloading.

**Tech**: `autoUpdater` in main, check on startup + every 6h; show a
non-blocking toast when an update is ready, install on quit. Channel
selection (stable/beta) in Settings → General.

**Done**: `electron-updater` wired into the main process:
- `src/main/updater.ts`: initializes on app ready, checks on startup + every 6h
- Emits state events (checking, available, downloading, downloaded, error) to renderer
- Non-blocking toast with "Restart" action when update is downloaded
- Settings → About tab: "Check for Updates" button + live status display
- Preload bridge: `updater.{check, install, onState}`
- Gracefully no-ops in dev mode (`app.isPackaged` guard)
- Channel selection deferred to after notarization is set up

---

### C4 · File tree sidebar — **L** — Done
Optional secondary sidebar (right side, toggleable) showing the
workspace cwd. Click a file → ask the agent to read it (pre-fills the
composer with `Read @path` or similar), double-click → open in the
system editor.

**Tech**: new lazy-loaded directory walker in main (`fs.readdir` +
gitignore filter via the `ignore` package already in pi). React panel
with virtualized tree (react-arborist or hand-rolled).

**Done**: `src/main/file-tree.ts` — lazy directory walker using
`fs.readdir` with skip-list (node_modules, .git, etc.) and 2000-entry
cap. `FileTree` React component with collapsible directories, file type
icons, lazy-loading on expand. Click copies relative path to clipboard.
Toggleable right sidebar in main layout. IPC: `pi:file-tree:list`.
6 tests cover directory listing, skip patterns, and sorting.

---

## P3 — Quality-of-life

### D1 · Bash panel polish — **S** — Done
Add ANSI color support and a more terminal-like look to the existing
BashPanel. We're still running one-shot commands, not pty.

**Done**: `src/renderer/lib/ansi.tsx` — lightweight ANSI parser supporting
SGR codes (bold/dim/italic/underline), 256-color, and true-color modes.
Integrated into BashPanel via `<AnsiText>` component.

---

### D2 · Theme presets + accent picker — **S** — Done
Currently only system/light/dark. Apple Music has a few accent
variations. Add 3–4 presets that swap `--primary` + `--accent` + adjust
related rings/badges, persisted via electron-store.

**Done**: `src/renderer/stores/accent.ts` provides 5 accent presets
(Indigo, Blue, Emerald, Rose, Amber) that swap `--primary`,
`--primary-hover`, `--primary-soft`, `--accent`, `--accent-foreground`,
and `--ring` CSS variables on the document root. Persisted via
localStorage. Accent picker with color swatches in Settings → General.
8 tests cover preset validation, persistence, CSS application.

---

### D3 · i18n (zh-CN + en) — **M** — Done
User-facing strings (Settings, NoSessionState, empty states, dialogs)
get extracted into a tiny `i18n.ts` (function-based, no runtime
library). zh-CN + en bundled, follows system locale by default with a
Settings override.

**Done**: `src/renderer/lib/i18n.ts` — function-based i18n with no
runtime library. `useI18n()` hook returns `t()` translator with
`{{param}}` interpolation. Dictionaries: `en.ts` (150+ keys) and
`zh-CN.ts` (full Chinese translation). System locale detection on boot
with localStorage override. Language picker in Settings → General.
9 tests cover key parity, interpolation, persistence, locale switching.

---

### D4 · Inline diff editor — **M** — Deferred
For edit/write tool calls, let the user approve / tweak the proposed
diff before pi applies it. Requires a preview-then-confirm RPC, which
pi exposes via the extension system (`BeforeToolCallContext` returns
allow/deny/modified args). Could ship deepcode as a built-in pi
extension that intercepts edit/write.

**Status**: Deferred — requires deep integration with pi's extension
system (BeforeToolCallContext hook). Existing DiffViewer component
can render patches but needs tool call interception layer.

---

### D5 · Slash command palette — **S** — Done
Surfacing `get_commands` (RPC already exists). In the composer, typing
`/` shows registered extension commands + skills + prompt templates,
similar to Cursor. Reuses N1's command palette infrastructure.

**Done**: Composer detects `/` prefix and shows a floating popup with
fuzzy-filtered commands from `get_commands` RPC. Supports ↑↓ navigation,
Tab/Enter to select, Esc to dismiss. 5 new tests cover popup, filtering,
selection, and dismissal.

---

### D6 · Session sharing — **S** — Done
RPC `export_html` already returns a self-contained HTML transcript. Add
a "Share" menu item with two options: save as `.html` (system save
dialog) or upload to a gist (uses pi's `getShareViewerUrl`).

**Done**: Share button in session header calls `pi.sessions.exportHtml()`
which opens a native save dialog via `pi:session:export-html` IPC.
Toast shows exported path with "Show in Finder" action. `pi.shell.showItemInFolder()`
added to preload bridge and renderer types.

---

## P4 — Long tail

### E1 · pty interactive terminal — **L** — Deferred
Embed `node-pty` (already in opencode's deps) and an xterm.js viewport
to give a real shell inside the bash panel.

**Status**: Deferred — requires adding node-pty native module + xterm.js
renderer dependency. Current bash panel runs one-shot commands via RPC.

### E2 · Multi-window — **M** — Done
Each `BrowserWindow` keeps its own `activeWorkspaceId` + `activeSessionId`
in window state. Useful when comparing two sessions side-by-side.
Requires moving renderer global state out of localStorage into
per-window IPC.

**Done**: Refactored `src/main/index.ts` from single `mainWindow` to
a `Set<BrowserWindow>` tracking all open windows. `createWindow()`
exported for multi-window creation. DevTools only opens for first
window. `pi:window:new` IPC handler + `⌘⇧N` keyboard shortcut.
Renderer zustand stores naturally isolate state per-window.

### E3 · Crash / error log viewer — **S** — Done
`drainErrors()` on settings/auth + main process uncaught errors collected
into an in-memory ring buffer. Settings → About → "View logs".

**Done**: `src/main/error-log.ts` — in-memory ring buffer (500 max)
capturing uncaught exceptions, unhandled rejections, and manually logged
errors. Global handlers installed at app ready. IPC `pi:logs:get` /
`pi:logs:clear` exposed to renderer. `LogViewerDialog` component in
Settings → About → "View Logs" with severity badges, expandable stack
traces, copy-to-clipboard, and clear. Preload bridge and renderer types
updated. 8 tests cover ring buffer, logging, and eviction.

### E4 · Telemetry / Sentry (opt-in) — **M** — Done
Wrap Sentry init around an opt-in toggle in Settings → General. Useful
for catching regressions in beta builds.

**Done**: `src/main/telemetry.ts` — opt-in Sentry integration.
Disabled by default, persisted via electron-store. Initializes Sentry
with PII filtering (strips user paths from stack frames). IPC handlers
`pi:telemetry:get/set` + preload bridge `telemetry.{get,set}`.
Settings → General → Privacy section with toggle.

### E5 · Broader tests — **L** — Done
- vitest for `dispatch-rpc.ts`, `workspace-store.ts`, `session-fs.ts`
- @testing-library/react for `ModelPicker`, `Composer`,
  `SettingsDialog`, `MessageTimeline`
- playwright-electron smoke for: open app → add workspace → new session
  → send prompt → see response

**Done**: 260 tests (124 node + 136 web) covering:
- plan-tracker-core (26 tests for pure logic functions)
- settings (11 tests for get/set with mocked SettingsManager)
- ansi parser (11 tests for SGR/256-color/true-color)
- ThemeSwitcher (4 tests for popover/selection)
- All previously covered modules

---

## Cross-cutting concerns

These don't fit a single milestone but get addressed alongside the items
above.

- **Type checking in CI** — `tsc -b` against the existing
  `tsconfig.node.json` + `tsconfig.web.json` references. Currently we
  only catch type errors at vite build time, which uses esbuild and
  doesn't enforce full TS.
- **Accessibility audit** — keyboard reachability for the model picker,
  settings dialog, session list; correct `aria-label` on icon-only
  buttons; honor `prefers-reduced-motion` for the conversation
  scroll-to-bottom animation.
- **State persistence layering** — today: workspaces in electron-store,
  theme in localStorage, sessions on disk via pi. The split is fine but
  worth documenting once C1 ships so packaged apps keep settings across
  versions.
- **Workspace package extraction** — once electron-builder is in (C1),
  audit `package.json` "dependencies" vs "devDependencies" so the
  packaged app doesn't carry vite/electron itself.

---

## Suggested order for the next sprint

1. ~~**A2** minimal tests/CI (M)~~ — **Done** (162 tests, CI pipeline).
2. ~~**A3** runtime/session alignment (L)~~ — **Done** (AgentSessionRuntime integrated).
3. ~~**B1** command palette (M)~~ — **Done** (⌘K overlay with fuzzy search + 15 tests).
4. ~~**B2** attachments (M)~~ — **Done** (drag/drop/paste/file picker + 26 tests).
5. ~~**B3** Settings dialog v2 (M)~~ — **Done** (4-tab layout + SettingsManager IPC + 18 tests).
6. ~~**C1** electron-builder packaging (M)~~ — **Done** (.dmg/.zip for mac arm64+x64, linux AppImage config).
7. ~~**C2** Fork / branch tree (M)~~ — **Done** (BranchesPanel + inline fork buttons).
8. ~~**C3** Auto-updater (M)~~ — **Done** (electron-updater + toast + settings UI).
9. ~~**D1** Bash ANSI colors (S)~~ — **Done** (ansi.tsx parser + BashPanel integration).
10. ~~**D5** Slash command palette (S)~~ — **Done** (Composer `/` popup + 5 tests).
11. ~~**D6** Session sharing (S)~~ — **Done** (Share button + export_html + save dialog).
12. ~~**D2** Accent presets (S)~~ — **Done** (5 presets + picker + 8 tests).
13. ~~**D3** i18n zh-CN + en (M)~~ — **Done** (function-based i18n + 150+ keys + 9 tests).
14. ~~**E3** Crash/error log viewer (S)~~ — **Done** (ring buffer + LogViewerDialog + 8 tests).
15. ~~**C4** File tree sidebar (L)~~ — **Done** (lazy-loaded directory walker + collapsible tree + 6 tests).
16. ~~**E2** Multi-window (M)~~ — **Done** (multi-BrowserWindow + ⌘⇧N shortcut).
17. ~~**E4** Telemetry/Sentry (M)~~ — **Done** (opt-in Sentry + PII filtering + Settings toggle).
18. ~~**E5** Broader tests (L)~~ — **Done** (260 tests: +55 across plan-tracker, settings, ansi, ThemeSwitcher).

After this sprint, deepcode is closer to a real alpha than a dev demo.

---

## Post-alpha additions

### F1 · Usage statistics dashboard — **M** — Done
Scan all pi session JSONL files under `~/.pi/agent/sessions/` and aggregate
token / cost / usage statistics per day and per model. Display as a dedicated
Dashboard page accessible from the sidebar.

**Done**: `src/main/session-stats.ts` walks session directories, parses each
JSONL entry, extracts `usage` from assistant messages, and aggregates by day
and model. Workspace cwd extracted from session header. IPC `pi:stats:get`
exposed via preload bridge. `Dashboard.tsx` renderer component shows:
- Summary cards: total cost, total tokens, requests, models used
- Time range filter (7d / 30d / all)
- Daily usage bar chart with cost + token + request count
- Model breakdown with cost proportion bars
- Token breakdown (input/output/cache read/cache write) with stacked bar
- 36 new i18n keys (en + zh-CN)
- 4 unit tests for session-stats module

### F2 · Copy last agent reply — **S** — Done
Header button copies the last assistant text response to clipboard.

**Done**: "Copy" button in session header calls `get_last_assistant_text` RPC.
Shows toast on success or if no message to copy.

### F3 · Queue mode UI — **S** — Done
Settings toggles for steering mode and follow-up mode.

**Done**: Two Select dropdowns in Settings → General → AI Behavior for
"Steering mode" and "Follow-up mode" (All at once / One at a time).
Reads/writes existing `steeringMode`/`followUpMode` settings keys.

### F4 · Session cwd fallback — **S** — Done
Graceful handling when workspace path no longer exists.

**Done**: `session-registry.ts` checks `existsSync(cwd)` before opening.
Falls back to `process.cwd()` and returns `cwdFallback: true` in result.
Renderer shows informational toast.

### F5 · Session search filter — **S** — Done
Filter sessions in sidebar by name or first message text.

**Done**: Search input above workspace list in sidebar. Filters sessions
by name/firstMessage match (case-insensitive).

### F6 · In-session message search — **M** — Done
Search within the current session's messages.

**Done**: Expandable search bar in `MessageTimeline`. Matches user,
assistant text, and tool result text. Shows match count and filters
timeline to matching items only. Escape to close.

### F7 · PTY Interactive Terminal — **L** — Done
Real interactive terminal with full TTY support (vim, less, top, etc.).

**Done**: `src/main/pty-manager.ts` manages pseudo-terminal instances
using `node-pty`. `TerminalPanel` component renders terminals using
`@xterm/xterm` with multiple tabs, resize support, and web links.
Replaces the one-shot BashPanel with a full interactive terminal.
- IPC handlers: `pi:pty:spawn`, `pi:pty:write`, `pi:pty:resize`, `pi:pty:kill`, `pi:pty:list`
- Event forwarding: `pi:pty:data`, `pi:pty:exit`
- Native module rebuilt with `@electron/rebuild`
- Dependencies: `node-pty`, `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`
- VS Code-style layout: docked at bottom, tab bar, full-width
- Apple design integration: light/dark theme colors, smooth animations
- Persistent terminals: collapse/expand without losing content

## P0 — Critical Missing Features

### F8 · pi-native resources, packages, tools, and project trust — **L** — Done

Align the desktop controls with pi's current native product surface instead of
inventing opencode-style systems.

**Done**:
- Project Trust controls backed by `~/.pi/agent/trust.json`
- Active Tools panel backed by `AgentSession.getAllTools()`,
  `getActiveToolNames()`, and `setActiveToolsByName()`
- Resources panel backed by `session.resourceLoader`, with diagnostics,
  resource path overview, reveal/copy actions, and session reload
- Packages panel backed by pi `DefaultPackageManager`, including progress
  forwarding and package path actions
- Prompt/skill resource actions for global/project `.pi` locations, including
  pi-native templates, automatic open, and reload prompt
- Session reload eventing so Resources/Tools panels refresh after reload
- Right rail exclusivity, close buttons, and resizable split-view panels
- Tests for pi resource creation plus Resources/Packages/Tools panels

### G1 · MCP (Model Context Protocol) Client — **XL** — Deferred
Connect to external tool servers via MCP protocol.

**Status**: Deferred. Current pi README/API does not expose MCP as a native
runtime primitive. deepcode should not invent a parallel MCP layer unless pi
adds one upstream. Revisit when pi ships MCP support or a supported extension
bridge for MCP-backed tools.

### G2 · Permission System — **L** — Deferred
Tool execution approval and permission rules.

**Status**: Deferred. Current pi security/product model is Project Trust,
containerization, extension/package provenance, and active tool selection. pi
does not currently expose native permission popups. deepcode should keep using
Project Trust and Active Tools instead of building a divergent custom permission
system.
