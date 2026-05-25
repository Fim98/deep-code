# deepcode Roadmap

Status as of 2026-05-26.

## Context

The MVP (M1–M10) is complete and deployable end-to-end: workspace + session
management, in-process pi SDK bridge, ai-elements–powered chat & composer,
tool/diff/bash panels, model picker, provider auth UI, light/dark themes,
session rename/delete, keyboard shortcuts. The next phases focus on (a)
shipping deepcode as a real macOS/Windows/Linux app, (b) the everyday-flow
gaps people hit after their first hour (commands, search, attachments,
context cost), and (c) deeper agent surface (file tree, MCP, fork tree).

Phases are **priority bands** (P0 → P3), not strict time orderings. Within a
band, items are listed roughly in the order I'd pick them up. Effort labels:
**S** ≤ 0.5d, **M** 1–2d, **L** 3–5d, **XL** > 1w.

---

## P0 — Daily-use blockers

These are the items every new user notices within their first session.

### N1 · Command palette (⌘K) — **M**
Single-shortcut launcher for:

- switch / create workspace
- switch / open / new session in current workspace
- switch model + thinking level
- toggle bash panel, theme, settings dialog
- invoke pi slash commands (`get_commands` already exists)

**Tech**: `cmdk` is already in the bundle via shadcn `command.tsx`. New
`components/command-palette/CommandPalette.tsx` + global `⌘K` shortcut in
`lib/keyboard.ts`. RPC: `get_commands`, `get_available_models`.

**Done when**: pressing `⌘K` opens an overlay with grouped actions and
fuzzy-search; selecting routes via the existing handlers.

---

### N2 · Bundle weight reduction — **S**
The renderer main bundle is 4.4 MB today, dominated by Streamdown +
shiki's full language pack + mermaid. Cold start on a HiDPI MacBook is
~600ms.

**Tech**: configure vite `build.rollupOptions.output.manualChunks` to
split `streamdown`, `shiki`, `mermaid`, `@radix-ui/*`. Investigate
Streamdown's `langs` option to inline only ~20 popular languages and
lazy-load the rest (already lazy-chunked, but the entry pulls them
eagerly via the language registry).

**Done when**: main `index.js` < 1.5 MB, no UX regression on markdown
rendering for the 20 most common languages (ts/tsx/js/jsx/json/py/rs/go/
java/kotlin/swift/c/cpp/cs/sql/yaml/toml/bash/sh/diff).

---

### N3 · PromptInput attachments (images + files) — **M**
The ai-elements `PromptInput` ships with attachment + screenshot machinery
that we currently don't wire up. Agent `prompt` already accepts
`ImageContent[]`.

**Tech**: wrap our Composer in `<PromptInputBody>` + `<PromptInputHeader>`
with `<PromptInputAttachmentsDisplay>` + `<PromptInputActionMenu>`
(attach files / capture screenshot). On submit, read each file to base64
and pass as `images: ImageContent[]` to `pi.rpc.send(sid, { type:
"prompt", message, images })`.

**Done when**: dragging an image onto the composer attaches it; sending
includes it in the prompt; assistant can `read` the image (vision
models).

---

### N4 · Settings dialog — Tabs + MCP + General — **M**
Today's `SettingsDialog` shows providers only. Split into a left-rail
nested layout:

| Tab | Content |
|---|---|
| General | Theme (move from header), startup workspace, ⌘ shortcuts hint |
| Providers | Current API key editor |
| MCP servers | List `mcpServers` from pi `Settings`; add/remove/enable |
| About | Version, links, "Open ~/.pi/agent/" button |

**Tech**: pi `SettingsManager.getProjectSettings()` / `getGlobalSettings()`
exposes `mcpServers: Record<string, McpConfig>`. New main IPC
`pi:settings:get` / `pi:settings:set` (writes through SettingsManager
locking). Use shadcn `Tabs` (not yet added).

**Done when**: provider auth still works; can add an MCP server (e.g.
filesystem) and see it surface in pi's available tools after restart.

---

### N5 · Context usage + cost bar — **S**
`SessionStats` already returns `tokens`, `cost`, and `contextUsage`.
Surface this so users know when to compact / switch models.

**Tech**: poll `get_session_stats` on every `turn_end` event; render a
small bar in the titlebar between the model picker and the bash icon:
`[contextUsed/total]  $0.12`. Add a tooltip with the breakdown
(input/output/cacheRead/cacheWrite).

**Done when**: bar updates after each turn; clicking opens a popover with
the full breakdown and a "Compact now" button (RPC `compact`).

---

### N6 · electron-builder packaging — **M**
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

## P1 — Important feature gaps

### N7 · ai-elements `<Tool>` replaces ToolCallCard — **S**
Currently we render tool calls with our own card. Switching to ai-elements
`<Tool>` + `<ToolHeader>` + `<ToolInput>` + `<ToolOutput>` gives us the
official status pills, consistent typography, and free integration with
`<CodeBlock>` for diffs.

**Tech**: adapter that maps our `AssistantMessage.content[].toolCall` +
the joined `ToolResultMessage` into Vercel AI SDK's `ToolUIPart` shape:
`{ type: "tool-<name>", toolCallId, state, input, output, errorText }`.
Keep our diff renderer (`DiffViewer`) inside `<ToolOutput>` when the
detail has `patch`.

**Done when**: every read/edit/bash/grep/find/write tool renders via
ai-elements; collapsing state persists across re-renders; diffs still
appear for edit/write.

---

### N8 · Fork / branch tree visualization — **M**
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

### N9 · Session & message search — **M**
With long histories the sidebar becomes a wall. Add:

- per-workspace search input above the session list (filter by name +
  `allMessagesText` already returned by `SessionInfo`)
- in-session `⌘F` overlay (filter messages currently rendered)

**Tech**: client-side filter for session list (fast, already have the
data). For in-session search use a controlled state + scrollIntoView on
match.

**Done when**: typing in the workspace search narrows the list; `⌘F`
opens a small input near the titlebar, highlights matches in the
timeline, `Enter` cycles.

---

### N10 · Auto-updater — **M**
Once N6 ships notarized builds, wire `electron-updater` so users get
patches without re-downloading.

**Tech**: `autoUpdater` in main, check on startup + every 6h; show a
non-blocking toast when an update is ready, install on quit. Channel
selection (stable/beta) in Settings → General.

**Done when**: shipping a new version bumps users on next launch with a
single click.

---

### N11 · File tree sidebar — **L**
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

## P2 — Quality-of-life

### N12 · ai-elements `<Terminal>` replaces BashPanel — **S**
Brings ANSI color support and a more terminal-like look. We're still
running one-shot commands, not pty.

---

### N13 · Theme presets + accent picker — **S**
Currently only system/light/dark. Apple Music has a few accent
variations. Add 3–4 presets that swap `--primary` + `--accent` + adjust
related rings/badges, persisted via electron-store.

---

### N14 · i18n (zh-CN + en) — **M**
User-facing strings (Settings, NoSessionState, empty states, dialogs)
get extracted into a tiny `i18n.ts` (function-based, no runtime
library). zh-CN + en bundled, follows system locale by default with a
Settings override.

---

### N15 · Inline diff editor — **M**
For edit/write tool calls, let the user approve / tweak the proposed
diff before pi applies it. Requires a preview-then-confirm RPC, which
pi exposes via the extension system (`BeforeToolCallContext` returns
allow/deny/modified args). Could ship deepcode as a built-in pi
extension that intercepts edit/write.

---

### N16 · Slash command palette — **S**
Surfacing `get_commands` (RPC already exists). In the composer, typing
`/` shows registered extension commands + skills + prompt templates,
similar to Cursor. Reuses N1's command palette infrastructure.

---

### N17 · Session sharing — **S**
RPC `export_html` already returns a self-contained HTML transcript. Add
a "Share" menu item with two options: save as `.html` (system save
dialog) or upload to a gist (uses pi's `getShareViewerUrl`).

---

## P3 — Long tail

### N18 · pty interactive terminal — **L**
Embed `node-pty` (already in opencode's deps) and an xterm.js viewport
to give a real shell inside the bash panel.

### N19 · Multi-window — **M**
Each `BrowserWindow` keeps its own `activeWorkspaceId` + `activeSessionId`
in window state. Useful when comparing two sessions side-by-side.
Requires moving renderer global state out of localStorage into
per-window IPC.

### N20 · Crash / error log viewer — **S**
`drainErrors()` on settings/auth + main process uncaught errors collected
into an in-memory ring buffer. Settings → About → "View logs".

### N21 · Telemetry / Sentry (opt-in) — **M**
Wrap Sentry init around an opt-in toggle in Settings → General. Useful
for catching regressions in beta builds.

### N22 · Tests — **L**
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
  worth documenting once N6 ships so packaged apps keep settings across
  versions.
- **Workspace package extraction** — once electron-builder is in (N6),
  audit `package.json` "dependencies" vs "devDependencies" so the
  packaged app doesn't carry vite/electron itself.

---

## Suggested order for the next sprint

If I were picking the next 1–2 weeks:

1. **N2** bundle reduction (S) — invisible win, but every other UI
   change feels snappier afterwards.
2. **N1** command palette (M) — single biggest navigation upgrade.
3. **N5** context usage bar (S) — answers the most common "why is it
   slow / expensive" question.
4. **N3** PromptInput attachments (M) — unlocks vision flows.
5. **N6** electron-builder packaging (M) — lets you actually hand the
   app to a friend.

Total: ~5 working days. After this we're closer to a real public alpha
than to a dev demo.
