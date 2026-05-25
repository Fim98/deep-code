import { contextBridge, ipcRenderer } from "electron";

const RPC_EVENT_CHANNEL = "pi:event";

interface RpcEventPayload {
	sessionId: string;
	event: unknown;
}

const workspaces = {
	list: () => ipcRenderer.invoke("pi:workspace:list"),
	getActive: () => ipcRenderer.invoke("pi:workspace:get-active"),
	setActive: (id: string | null) =>
		ipcRenderer.invoke("pi:workspace:set-active", id),
	add: (path: string, name?: string) =>
		ipcRenderer.invoke("pi:workspace:add", path, name),
	remove: (id: string) => ipcRenderer.invoke("pi:workspace:remove", id),
	pickDirectory: () => ipcRenderer.invoke("pi:workspace:pick-directory"),
};

const sessions = {
	list: (workspaceId: string) =>
		ipcRenderer.invoke("pi:session:list", workspaceId),
	open: (opts: { workspaceId: string; sessionFile?: string }) =>
		ipcRenderer.invoke("pi:session:open", opts),
	close: (sessionId: string) =>
		ipcRenderer.invoke("pi:session:close", sessionId),
};

const rpc = {
	send: (sessionId: string, command: unknown) =>
		ipcRenderer.invoke("pi:rpc", sessionId, command),
	subscribe: (sessionId: string, cb: (event: unknown) => void) => {
		const handler = (_e: Electron.IpcRendererEvent, payload: RpcEventPayload) => {
			if (payload.sessionId === sessionId) cb(payload.event);
		};
		ipcRenderer.on(RPC_EVENT_CHANNEL, handler);
		return () => ipcRenderer.off(RPC_EVENT_CHANNEL, handler);
	},
};

const theme = {
	setSource: (source: "system" | "light" | "dark") =>
		ipcRenderer.invoke("pi:theme:set-source", source),
	get: () => ipcRenderer.invoke("pi:theme:get"),
	onUpdate: (cb: (info: { source: string; shouldUseDark: boolean }) => void) => {
		const handler = (
			_e: Electron.IpcRendererEvent,
			info: { source: string; shouldUseDark: boolean },
		) => cb(info);
		ipcRenderer.on("pi:theme:updated", handler);
		return () => ipcRenderer.off("pi:theme:updated", handler);
	},
};

const api = {
	ping: (): Promise<string> => ipcRenderer.invoke("pi:ping"),
	workspaces,
	sessions,
	rpc,
	theme,
} as const;

contextBridge.exposeInMainWorld("pi", api);

export type PiApi = typeof api;
