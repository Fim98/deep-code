# deepcode Roadmap

Status as of 2026-05-28.

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

**Done**: 125 tests across 11 test files. Node (main-process): `dispatch-rpc.ts` (34 tests), `workspace-store.ts` (15), `session-fs.ts` (6), `auth.ts` (9). Renderer: `session-state.ts` (13), `theme.ts` (7), `Composer.tsx` (10), `ModelPicker.tsx` (6), `SettingsDialog.tsx` (9), `keyboard.ts` (8), `utils.ts` (7). GitHub Actions CI workflow runs typecheck + tests on every push/PR.

---

### A3 · Runtime/session alignment with pi — **L**

The current desktop registry owns a `Map<sessionId, AgentSession>`, which is
enough for chat but blocks native pi session replacement flows. Commands such
as `new_session`, `switch_session`, `fork`, `clone`, and `get_commands` are
currently rejected by `dispatchRpc`.

**Tech**: introduce `AgentSessionRuntime` in the main-process registry and
route session replacement through pi's native runtime methods. Keep the
renderer-facing desktop session id stable while rebinding to the replaced pi
session.

**Done when**: `new_session`, `switch_session`, `fork`, `clone`, and
`get_commands` work through the same bridge as normal prompts.

---

## P1 — Daily workflow

These are the controls users reach for during normal work.

### B1 · Command palette (Cmd+K) — **M**
Single-shortcut launcher for:

- switch / create workspace
- switch / open / new session in current workspace
- switch model + thinking level
- toggle bash panel, theme, settings dialog
- invoke pi slash commands (`get_commands` already exists)

**Tech**: build the overlay with existing Radix-based dialog/input primitives.
New `components/command-palette/CommandPalette.tsx` plus a global `Cmd+K`
shortcut in `lib/keyboard.ts`. RPC: `get_commands`, `get_available_models`.

**Done when**: pressing `Cmd+K` opens an overlay with grouped actions and
fuzzy-search; selecting routes via the existing handlers.

---

### B2 · Composer attachments (images + files) — **M**
The composer should support drag/drop, file picking, and screenshot capture.
Agent `prompt` already accepts `ImageContent[]`.

**Tech**: extend the local composer with attachment chips, hidden file input,
drag/drop, and clipboard image handling. On submit, read each image file to
base64 and pass as `images: ImageContent[]` to
`pi.rpc.send(sid, { type: "prompt", message, images })`.

**Done when**: dragging an image onto the composer attaches it; sending
includes it in the prompt; assistant can `read` the image (vision
models).

---

### B3 · Settings dialog v2 — General + Providers + Models + About — **M**

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

**Done when**: provider auth still works, theme/startup/general settings are
editable, and settings persist through pi's normal global/project files.

---

### B4 · Session and message search — **M**

With long histories the sidebar becomes a wall. Add per-workspace session
search and in-session `Cmd+F` message search.

**Done when**: sidebar search filters by name/message text; in-session search
highlights matches and Enter cycles results.

---

## P2 — Shipping surface

### C1 · electron-builder packaging — **M**
The app is currently dev-only. Ship `.dmg` (universal2), `.exe` (NSIS),
and `.AppImage`.

**Tech**: add `electron-builder.config.ts`, app icons (1024², .icns, .ico,
.png), `npm run package:mac|win|linux` scripts. Bundle the pi
dist directly (already on `^0.75.5`), pin runtime deps so
`asarUnpack` covers `undici` and any native modules. Skip code signing
+ notarization in this milestone (separate cert work).

**Done when**: `npm run package:mac` produces a working `.dmg`;
double-clicking installs, launching opens the same window as `npm run
dev`, IPC + RPC work, electron-store persists across launches.

---

### C2 · Fork / branch tree visualization — **M**
pi tracks session branches (`getEntries`, `getTree`, `fork`, `clone`).
Today there's no way to fork or visualize branches in deepcode.

**Tech**: new "Branches" panel that opens in the right side of the
session (or as a popover under the session header). Build a tree from
`SessionManager.getTree()` (need a new IPC + a renderer SVG/CSS tree).
"Fork from here" button on any user message → RPC `fork` with the
entry id → opens the new session.

**Done when**: clicking a past user message reveals "Fork from here",
which creates a sibling branch; the branches panel lists both with the
active one highlighted.

---

### C3 · Auto-updater — **M**
Once C1 ships notarized builds, wire `electron-updater` so users get
patches without re-downloading.

**Tech**: `autoUpdater` in main, check on startup + every 6h; show a
non-blocking toast when an update is ready, install on quit. Channel
selection (stable/beta) in Settings → General.

**Done when**: shipping a new version bumps users on next launch with a
single click.

---

### C4 · File tree sidebar — **L**
Optional secondary sidebar (right side, toggleable) showing the
workspace cwd. Click a file → ask the agent to read it (pre-fills the
composer with `Read @path` or similar), double-click → open in the
system editor.

**Tech**: new lazy-loaded directory walker in main (`fs.readdir` +
gitignore filter via the `ignore` package already in pi). React panel
with virtualized tree (react-arborist or hand-rolled).

**Done when**: toggling the file tree shows the active workspace; clicks
work as described; large repos (10k files) don't freeze the UI.

---

## P3 — Quality-of-life

### D1 · Bash panel polish — **S**
Add ANSI color support and a more terminal-like look to the existing
BashPanel. We're still running one-shot commands, not pty.

---

### D2 · Theme presets + accent picker — **S**
Currently only system/light/dark. Apple Music has a few accent
variations. Add 3–4 presets that swap `--primary` + `--accent` + adjust
related rings/badges, persisted via electron-store.

---

### D3 · i18n (zh-CN + en) — **M**
User-facing strings (Settings, NoSessionState, empty states, dialogs)
get extracted into a tiny `i18n.ts` (function-based, no runtime
library). zh-CN + en bundled, follows system locale by default with a
Settings override.

---

### D4 · Inline diff editor — **M**
For edit/write tool calls, let the user approve / tweak the proposed
diff before pi applies it. Requires a preview-then-confirm RPC, which
pi exposes via the extension system (`BeforeToolCallContext` returns
allow/deny/modified args). Could ship deepcode as a built-in pi
extension that intercepts edit/write.

---

### D5 · Slash command palette — **S**
Surfacing `get_commands` (RPC already exists). In the composer, typing
`/` shows registered extension commands + skills + prompt templates,
similar to Cursor. Reuses N1's command palette infrastructure.

---

### D6 · Session sharing — **S**
RPC `export_html` already returns a self-contained HTML transcript. Add
a "Share" menu item with two options: save as `.html` (system save
dialog) or upload to a gist (uses pi's `getShareViewerUrl`).

---

## P4 — Long tail

### E1 · pty interactive terminal — **L**
Embed `node-pty` (already in opencode's deps) and an xterm.js viewport
to give a real shell inside the bash panel.

### E2 · Multi-window — **M**
Each `BrowserWindow` keeps its own `activeWorkspaceId` + `activeSessionId`
in window state. Useful when comparing two sessions side-by-side.
Requires moving renderer global state out of localStorage into
per-window IPC.

### E3 · Crash / error log viewer — **S**
`drainErrors()` on settings/auth + main process uncaught errors collected
into an in-memory ring buffer. Settings → About → "View logs".

### E4 · Telemetry / Sentry (opt-in) — **M**
Wrap Sentry init around an opt-in toggle in Settings → General. Useful
for catching regressions in beta builds.

### E5 · Broader tests — **L**
- vitest for `dispatch-rpc.ts`, `workspace-store.ts`, `session-fs.ts`
- @testing-library/react for `ModelPicker`, `Composer`,
  `SettingsDialog`, `MessageTimeline`
- playwright-electron smoke for: open app → add workspace → new session
  → send prompt → see response

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

1. **A2** minimal tests/CI (M) — establishes a regression floor.
2. **A3** runtime/session alignment (L) — unlocks fork/clone/commands cleanly.
3. **B1** command palette (M) — largest daily navigation win.
4. **B2** attachments (M) — unlocks vision workflows.
5. **B3** Settings dialog v2 (M) — makes pi settings editable from the app.

After this sprint, deepcode is closer to a real alpha than a dev demo.
