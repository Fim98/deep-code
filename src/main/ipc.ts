import type { RpcCommand } from "@earendil-works/pi-coding-agent";
import { type BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { listConfiguredProviders, listKnownProviders, removeProvider, setApiKey } from "./auth.js";
import { dispatchRpc } from "./dispatch-rpc.js";
import { clearLogs, getLogs } from "./error-log.js";
import { listDirectory } from "./file-tree.js";
import { createWindow } from "./index.js";
import { deleteSessionFile, listSessionsForCwd } from "./session-fs.js";
import { sessionRegistry } from "./session-registry.js";
import { getAgentDirPath, getDesktopSettings, setDesktopSetting } from "./settings.js";
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
}
