import type { RpcCommand } from "@earendil-works/pi-coding-agent";
import { BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { listConfiguredProviders, listKnownProviders, removeProvider, setApiKey } from "./auth.js";
import { dispatchRpc } from "./dispatch-rpc.js";
import { clearLogs, getLogs } from "./error-log.js";
import type { ExtensionUIResponse } from "./extension-ui-bridge.js";
import { listDirectory, readFileContent } from "./file-tree.js";
import { createWindow } from "./index.js";
import { ptyManager } from "./pty-manager.js";
import { deleteSessionFile, listSessionsForCwd } from "./session-fs.js";
import { sessionRegistry } from "./session-registry.js";
import { getSessionStats } from "./session-stats.js";
import { getAgentDirPath, getDesktopSettings, setDesktopSetting } from "./settings.js";
import { isTelemetryEnabled, setTelemetryEnabled } from "./telemetry.js";
import { quitAndInstall, scheduleCheck } from "./updater.js";
import {
	addWorkspace,
	getActiveWorkspaceId,
	getWorkspace,
	listWorkspaces,
	removeWorkspace,
	setActiveWorkspaceId,
} from "./workspace-store.js";

export const RPC_EVENT_CHANNEL = "pi:event";

type ThemeSource = "system" | "light" | "dark";

// Serialized form of SessionTreeNode for IPC transfer
interface SerializedTreeNode {
	id: string;
	type: string;
	parentId: string | null;
	timestamp: string;
	children: SerializedTreeNode[];
	label?: string;
	// For user messages
	text?: string;
}

function serializeTree(nodes: any[]): SerializedTreeNode[] {
	return nodes.map((node) => {
		const entry = node.entry;
		const serialized: SerializedTreeNode = {
			id: entry.id,
			type: entry.type,
			parentId: entry.parentId,
			timestamp: entry.timestamp,
			children: serializeTree(node.children ?? []),
			label: node.label,
		};
		// Extract text from user messages
		if (entry.type === "message" && entry.message?.role === "user") {
			const content = entry.message.content;
			if (typeof content === "string") {
				serialized.text = content;
			} else if (Array.isArray(content)) {
				const textParts = content.filter((p: any) => p?.type === "text").map((p: any) => p.text);
				serialized.text = textParts.join("\n");
			}
		}
		return serialized;
	});
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | undefined): void {
	ipcMain.handle("pi:workspace:list", () => listWorkspaces());
	ipcMain.handle("pi:workspace:get-active", () => getActiveWorkspaceId());
	ipcMain.handle("pi:workspace:set-active", (_e, id: string | null) => setActiveWorkspaceId(id));
	ipcMain.handle("pi:workspace:add", (_e, path: string, name?: string) => addWorkspace(path, name));
	ipcMain.handle("pi:workspace:remove", (_e, id: string) => removeWorkspace(id));
	ipcMain.handle("pi:workspace:pick-directory", async () => {
		const win = getWindow();
		const opts: Electron.OpenDialogOptions = {
			properties: ["openDirectory", "createDirectory"],
			title: "Choose a workspace",
		};
		const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
		if (result.canceled || result.filePaths.length === 0) return null;
		return result.filePaths[0];
	});

	ipcMain.handle("pi:session:list", async (_e, workspaceId: string) => {
		const ws = getWorkspace(workspaceId);
		if (!ws) throw new Error(`Unknown workspaceId: ${workspaceId}`);
		return listSessionsForCwd(ws.path);
	});

	ipcMain.handle(
		"pi:session:open",
		async (event, opts: { workspaceId: string; sessionFile?: string }) => {
			const result = await sessionRegistry.open(opts);
			// Bind the extension UI bridge to this window
			const win = BrowserWindow.fromWebContents(event.sender);
			if (win) {
				sessionRegistry.bindWindowToBridge(result.sessionId, win);
			}
			sessionRegistry.addListener(result.sessionId, (ev) => {
				if (event.sender.isDestroyed()) return;
				event.sender.send(RPC_EVENT_CHANNEL, {
					sessionId: result.sessionId,
					event: ev,
				});
			});
			return result;
		},
	);

	ipcMain.handle("pi:session:close", async (_e, sessionId: string) => {
		await sessionRegistry.close(sessionId);
	});

	ipcMain.handle(
		"pi:session:delete",
		async (_e, args: { workspaceId: string; sessionPath: string }): Promise<void> => {
			// Close any open sessions backed by this file before deletion.
			for (const open of sessionRegistry.listOpen()) {
				const sess = sessionRegistry.tryGet(open.sessionId);
				if (sess?.sessionFile === args.sessionPath) {
					await sessionRegistry.close(open.sessionId);
				}
			}
			await deleteSessionFile(args.sessionPath);
		},
	);

	ipcMain.handle("pi:rpc", async (_e, sessionId: string, command: RpcCommand) => {
		const session = sessionRegistry.get(sessionId);
		const runtime = sessionRegistry.getRuntime(sessionId);
		return dispatchRpc(session, command, runtime);
	});

	ipcMain.handle("pi:session:tree", (_e, sessionId: string) => {
		const session = sessionRegistry.get(sessionId);
		const tree = session.sessionManager.getTree();
		const leafId = session.sessionManager.getLeafId();
		// Serialize SessionTreeNode[] to a JSON-safe format
		return { tree: serializeTree(tree), leafId };
	});

	// Extension UI response: renderer → main process bridge
	ipcMain.handle(
		"pi:extension-ui:respond",
		(_e, sessionId: string, response: ExtensionUIResponse) => {
			const bridge = sessionRegistry.getBridge(sessionId);
			bridge.handleResponse(response);
		},
	);

	ipcMain.handle("pi:ping", () => "pong");

	// Session export
	ipcMain.handle(
		"pi:session:export-html",
		async (_e, sessionId: string): Promise<string | null> => {
			const win = getWindow();
			if (!win) return null;
			const result = await dialog.showSaveDialog(win, {
				title: "Export Session as HTML",
				defaultPath: "session-export.html",
				filters: [{ name: "HTML", extensions: ["html"] }],
			});
			if (result.canceled || !result.filePath) return null;
			const session = sessionRegistry.get(sessionId);
			const resp = await dispatchRpc(session, {
				type: "export_html",
				outputPath: result.filePath,
			});
			if (resp.success && resp.command === "export_html") {
				return resp.data.path;
			}
			throw new Error(resp.success ? "Export failed" : resp.error);
		},
	);

	ipcMain.handle("pi:shell:show-item", (_e, path: string) => {
		shell.showItemInFolder(path);
	});
	ipcMain.handle("pi:shell:open-path", async (_e, path: string) => {
		return shell.openPath(path);
	});

	// Settings
	ipcMain.handle("pi:settings:get", () => getDesktopSettings());
	ipcMain.handle("pi:settings:set", (_e, key: string, value: unknown) => {
		setDesktopSetting(key, value);
	});
	ipcMain.handle("pi:settings:agent-dir", () => getAgentDirPath());
	ipcMain.handle("pi:app:version", () => {
		const { app } = require("electron");
		return app.getVersion();
	});

	// Window management
	ipcMain.handle("pi:window:new", () => {
		void createWindow();
	});

	// Telemetry
	ipcMain.handle("pi:telemetry:get", () => isTelemetryEnabled());
	ipcMain.handle("pi:telemetry:set", (_e, value: boolean) => {
		setTelemetryEnabled(value);
	});

	// Auto-updater
	ipcMain.handle("pi:update:check", () => {
		scheduleCheck();
	});
	ipcMain.handle("pi:update:install", () => {
		quitAndInstall();
	});

	// Error logs
	ipcMain.handle("pi:logs:get", () => getLogs());
	ipcMain.handle("pi:logs:clear", () => {
		clearLogs();
	});

	// File tree
	ipcMain.handle("pi:file-tree:list", async (_e, dirPath: string) => {
		return listDirectory(dirPath);
	});
	ipcMain.handle("pi:file-tree:read", async (_e, filePath: string) => {
		return readFileContent(filePath);
	});

	// Session statistics
	ipcMain.handle("pi:stats:get", () => getSessionStats());

	ipcMain.handle("pi:auth:list", () => listConfiguredProviders());
	ipcMain.handle("pi:auth:known-providers", () => listKnownProviders());
	ipcMain.handle("pi:auth:set-key", (_e, provider: string, key: string) => {
		setApiKey(provider, key);
	});
	ipcMain.handle("pi:auth:remove", (_e, provider: string) => {
		removeProvider(provider);
	});

	ipcMain.handle("pi:theme:set-source", (_e, source: ThemeSource) => {
		if (source === "light" || source === "dark" || source === "system") {
			nativeTheme.themeSource = source;
		}
		return nativeTheme.shouldUseDarkColors ? "dark" : "light";
	});

	ipcMain.handle("pi:theme:get", () => ({
		source: nativeTheme.themeSource,
		shouldUseDark: nativeTheme.shouldUseDarkColors,
	}));

	nativeTheme.on("updated", () => {
		const win = getWindow();
		if (!win || win.isDestroyed()) return;
		win.webContents.send("pi:theme:updated", {
			source: nativeTheme.themeSource,
			shouldUseDark: nativeTheme.shouldUseDarkColors,
		});
	});

	// ── PTY Terminal ────────────────────────────────────────────────────────
	ipcMain.handle("pi:pty:spawn", (_e, opts?: { cwd?: string; cols?: number; rows?: number }) => {
		const instance = ptyManager.spawn(opts);
		return { id: instance.id, shell: instance.shell, cwd: instance.cwd };
	});

	ipcMain.handle("pi:pty:write", (_e, id: string, data: string) => {
		ptyManager.write(id, data);
	});

	ipcMain.handle("pi:pty:resize", (_e, id: string, cols: number, rows: number) => {
		ptyManager.resize(id, cols, rows);
	});

	ipcMain.handle("pi:pty:kill", (_e, id: string) => {
		ptyManager.kill(id);
	});

	ipcMain.handle("pi:pty:list", () => {
		return ptyManager.list();
	});

	// Forward PTY events to all windows
	ptyManager.on("data", ({ id, data }) => {
		for (const win of BrowserWindow.getAllWindows()) {
			if (!win.isDestroyed()) {
				win.webContents.send("pi:pty:data", { id, data });
			}
		}
	});

	ptyManager.on("exit", ({ id, exitCode, signal }) => {
		for (const win of BrowserWindow.getAllWindows()) {
			if (!win.isDestroyed()) {
				win.webContents.send("pi:pty:exit", { id, exitCode, signal });
			}
		}
	});
}
