import type { RpcCommand } from "@earendil-works/pi-coding-agent";
import { type BrowserWindow, dialog, ipcMain } from "electron";
import { dispatchRpc } from "./dispatch-rpc.js";
import { listSessionsForCwd } from "./session-fs.js";
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
		"pi:rpc",
		async (_e, sessionId: string, command: RpcCommand) => {
			const session = sessionRegistry.get(sessionId);
			return dispatchRpc(session, command);
		},
	);

	ipcMain.handle("pi:ping", () => "pong");
}
