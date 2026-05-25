import type { RpcCommand } from "@earendil-works/pi-coding-agent";
import { type BrowserWindow, dialog, ipcMain, nativeTheme } from "electron";
import {
	listConfiguredProviders,
	listKnownProviders,
	removeProvider,
	setApiKey,
} from "./auth.js";
import { dispatchRpc } from "./dispatch-rpc.js";
import { deleteSessionFile, listSessionsForCwd } from "./session-fs.js";
import { sessionRegistry } from "./session-registry.js";
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

export function registerIpcHandlers(getWindow: () => BrowserWindow | undefined): void {
	ipcMain.handle("pi:workspace:list", () => listWorkspaces());
	ipcMain.handle("pi:workspace:get-active", () => getActiveWorkspaceId());
	ipcMain.handle("pi:workspace:set-active", (_e, id: string | null) =>
		setActiveWorkspaceId(id),
	);
	ipcMain.handle("pi:workspace:add", (_e, path: string, name?: string) =>
		addWorkspace(path, name),
	);
	ipcMain.handle("pi:workspace:remove", (_e, id: string) => removeWorkspace(id));
	ipcMain.handle("pi:workspace:pick-directory", async () => {
		const win = getWindow();
		const opts: Electron.OpenDialogOptions = {
			properties: ["openDirectory", "createDirectory"],
			title: "Choose a workspace",
		};
		const result = win
			? await dialog.showOpenDialog(win, opts)
			: await dialog.showOpenDialog(opts);
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
		async (
			_e,
			args: { workspaceId: string; sessionPath: string },
		): Promise<void> => {
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

	ipcMain.handle(
		"pi:rpc",
		async (_e, sessionId: string, command: RpcCommand) => {
			const session = sessionRegistry.get(sessionId);
			return dispatchRpc(session, command);
		},
	);

	ipcMain.handle("pi:ping", () => "pong");

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
