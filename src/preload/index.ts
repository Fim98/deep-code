import { contextBridge, ipcRenderer } from "electron";

const RPC_EVENT_CHANNEL = "pi:event";

interface RpcEventPayload {
	sessionId: string;
	event: unknown;
}

const workspaces = {
	list: () => ipcRenderer.invoke("pi:workspace:list"),
	getActive: () => ipcRenderer.invoke("pi:workspace:get-active"),
	setActive: (id: string | null) => ipcRenderer.invoke("pi:workspace:set-active", id),
	add: (path: string, name?: string) => ipcRenderer.invoke("pi:workspace:add", path, name),
	remove: (id: string) => ipcRenderer.invoke("pi:workspace:remove", id),
	pickDirectory: () => ipcRenderer.invoke("pi:workspace:pick-directory"),
};

const sessions = {
	list: (workspaceId: string) => ipcRenderer.invoke("pi:session:list", workspaceId),
	open: (opts: { workspaceId: string; sessionFile?: string }) =>
		ipcRenderer.invoke("pi:session:open", opts),
	close: (sessionId: string) => ipcRenderer.invoke("pi:session:close", sessionId),
	delete: (args: { workspaceId: string; sessionPath: string }) =>
		ipcRenderer.invoke("pi:session:delete", args),
	tree: (sessionId: string) => ipcRenderer.invoke("pi:session:tree", sessionId),
	exportHtml: (sessionId: string) => ipcRenderer.invoke("pi:session:export-html", sessionId),
};

const shellApi = {
	showItemInFolder: (path: string) => ipcRenderer.invoke("pi:shell:show-item", path),
};

const logs = {
	get: () =>
		ipcRenderer.invoke("pi:logs:get") as Promise<
			Array<{ timestamp: number; source: string; message: string; stack?: string }>
		>,
	clear: () => ipcRenderer.invoke("pi:logs:clear") as Promise<void>,
};

const fileTree = {
	list: (dirPath: string) =>
		ipcRenderer.invoke("pi:file-tree:list", dirPath) as Promise<
			Array<{ name: string; path: string; type: "file" | "directory" }>
		>,
};

const windowManagement = {
	new: () => ipcRenderer.invoke("pi:window:new") as Promise<void>,
};

const telemetry = {
	get: () => ipcRenderer.invoke("pi:telemetry:get") as Promise<boolean>,
	set: (value: boolean) => ipcRenderer.invoke("pi:telemetry:set", value) as Promise<void>,
};

const rpc = {
	send: (sessionId: string, command: unknown) => ipcRenderer.invoke("pi:rpc", sessionId, command),
	subscribe: (sessionId: string, cb: (event: unknown) => void) => {
		const handler = (_e: Electron.IpcRendererEvent, payload: RpcEventPayload) => {
			if (payload.sessionId === sessionId) cb(payload.event);
		};
		ipcRenderer.on(RPC_EVENT_CHANNEL, handler);
		return () => ipcRenderer.off(RPC_EVENT_CHANNEL, handler);
	},
};

const EXTENSION_UI_REQUEST_CHANNEL = "pi:extension-ui:request";

const extensionUI = {
	onRequest: (cb: (request: unknown) => void) => {
		const handler = (_e: Electron.IpcRendererEvent, request: unknown) => cb(request);
		ipcRenderer.on(EXTENSION_UI_REQUEST_CHANNEL, handler);
		return () => ipcRenderer.off(EXTENSION_UI_REQUEST_CHANNEL, handler);
	},
	respond: (sessionId: string, response: unknown) =>
		ipcRenderer.invoke("pi:extension-ui:respond", sessionId, response),
};

const auth = {
	list: () => ipcRenderer.invoke("pi:auth:list"),
	knownProviders: () => ipcRenderer.invoke("pi:auth:known-providers"),
	setKey: (provider: string, key: string) => ipcRenderer.invoke("pi:auth:set-key", provider, key),
	remove: (provider: string) => ipcRenderer.invoke("pi:auth:remove", provider),
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

const settings = {
	get: () => ipcRenderer.invoke("pi:settings:get"),
	set: (key: string, value: unknown) => ipcRenderer.invoke("pi:settings:set", key, value),
	agentDir: () => ipcRenderer.invoke("pi:settings:agent-dir"),
};

const appInfo = {
	version: () => ipcRenderer.invoke("pi:app:version"),
};

const updater = {
	check: () => ipcRenderer.invoke("pi:update:check"),
	install: () => ipcRenderer.invoke("pi:update:install"),
	onState: (cb: (state: { status: string; version?: string; error?: string }) => void) => {
		const handler = (
			_e: Electron.IpcRendererEvent,
			state: { status: string; version?: string; error?: string },
		) => cb(state);
		ipcRenderer.on("pi:update:state", handler);
		return () => ipcRenderer.off("pi:update:state", handler);
	},
};

const api = {
	ping: (): Promise<string> => ipcRenderer.invoke("pi:ping"),
	workspaces,
	sessions,
	rpc,
	extensionUI,
	theme,
	auth,
	settings,
	appInfo,
	updater,
	shell: shellApi,
	logs,
	fileTree,
	window: windowManagement,
	telemetry,
} as const;

contextBridge.exposeInMainWorld("pi", api);

export type PiApi = typeof api;
