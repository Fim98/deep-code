import type { AgentSessionEvent, RpcCommand, RpcResponse } from "@earendil-works/pi-coding-agent";

export interface WorkspaceEntry {
	id: string;
	name: string;
	path: string;
	addedAt: number;
}

export interface SessionListItem {
	path: string;
	id: string;
	cwd: string;
	name?: string;
	parentSessionPath?: string;
	created: number;
	modified: number;
	messageCount: number;
	firstMessage: string;
}

export interface OpenSessionResult {
	sessionId: string;
	workspaceId: string;
	sessionFile: string | undefined;
	piSessionId: string;
}

export interface SessionTreeNode {
	id: string;
	type: string;
	parentId: string | null;
	timestamp: string;
	children: SessionTreeNode[];
	label?: string;
	text?: string;
}

export interface SessionTreeData {
	tree: SessionTreeNode[];
	leafId: string | null;
}

export interface DesktopSettings {
	defaultProvider: string | undefined;
	defaultModel: string | undefined;
	defaultThinkingLevel: string | undefined;
	transport: string;
	steeringMode: string;
	followUpMode: string;
	theme: string | undefined;
	compactionEnabled: boolean;
	retryEnabled: boolean;
	hideThinkingBlock: boolean;
	showImages: boolean;
	imageAutoResize: boolean;
	blockImages: boolean;
	enabledModels: string[] | undefined;
}

// ─── Extension UI types ─────────────────────────────────────────────────────

export interface ExtensionUIRequestBase {
	type: "extension_ui_request";
	id: string;
	sessionId: string;
}

export interface ExtensionUISelectRequest extends ExtensionUIRequestBase {
	method: "select";
	title: string;
	options: string[];
	timeout?: number;
}

export interface ExtensionUIConfirmRequest extends ExtensionUIRequestBase {
	method: "confirm";
	title: string;
	message: string;
	timeout?: number;
}

export interface ExtensionUIInputRequest extends ExtensionUIRequestBase {
	method: "input";
	title: string;
	placeholder?: string;
	timeout?: number;
}

export interface ExtensionUIEditorRequest extends ExtensionUIRequestBase {
	method: "editor";
	title: string;
	prefill?: string;
}

export interface ExtensionUINotifyRequest extends ExtensionUIRequestBase {
	method: "notify";
	message: string;
	notifyType?: "info" | "warning" | "error";
}

export interface ExtensionUISetStatusRequest extends ExtensionUIRequestBase {
	method: "setStatus";
	statusKey: string;
	statusText: string | undefined;
}

export interface ExtensionUISetWidgetRequest extends ExtensionUIRequestBase {
	method: "setWidget";
	widgetKey: string;
	widgetLines: string[] | undefined;
	widgetPlacement?: "aboveEditor" | "belowEditor";
}

export interface ExtensionUISetTitleRequest extends ExtensionUIRequestBase {
	method: "setTitle";
	title: string;
}

export interface ExtensionUISetEditorTextRequest extends ExtensionUIRequestBase {
	method: "set_editor_text";
	text: string;
}

export type ExtensionUIRequest =
	| ExtensionUISelectRequest
	| ExtensionUIConfirmRequest
	| ExtensionUIInputRequest
	| ExtensionUIEditorRequest
	| ExtensionUINotifyRequest
	| ExtensionUISetStatusRequest
	| ExtensionUISetWidgetRequest
	| ExtensionUISetTitleRequest
	| ExtensionUISetEditorTextRequest;

export interface PiBridge {
	ping: () => Promise<string>;
	workspaces: {
		list: () => Promise<WorkspaceEntry[]>;
		getActive: () => Promise<string | null>;
		setActive: (id: string | null) => Promise<void>;
		add: (path: string, name?: string) => Promise<WorkspaceEntry>;
		remove: (id: string) => Promise<void>;
		pickDirectory: () => Promise<string | null>;
	};
	sessions: {
		list: (workspaceId: string) => Promise<SessionListItem[]>;
		open: (opts: { workspaceId: string; sessionFile?: string }) => Promise<OpenSessionResult>;
		close: (sessionId: string) => Promise<void>;
		delete: (args: { workspaceId: string; sessionPath: string }) => Promise<void>;
		tree: (sessionId: string) => Promise<SessionTreeData>;
		exportHtml: (sessionId: string) => Promise<string | null>;
	};
	shell: {
		showItemInFolder: (path: string) => Promise<void>;
	};
	logs: {
		get: () => Promise<LogEntry[]>;
		clear: () => Promise<void>;
	};
	fileTree: {
		list: (dirPath: string) => Promise<FileTreeNode[]>;
	};
	window: {
		new: () => Promise<void>;
	};
	telemetry: {
		get: () => Promise<boolean>;
		set: (value: boolean) => Promise<void>;
	};
	rpc: {
		send: <C extends RpcCommand>(sessionId: string, command: C) => Promise<RpcResponse>;
		subscribe: (sessionId: string, cb: (event: AgentSessionEvent) => void) => () => void;
	};
	extensionUI: {
		onRequest: (cb: (request: ExtensionUIRequest) => void) => () => void;
		respond: (sessionId: string, response: unknown) => Promise<void>;
	};
	theme: {
		setSource: (source: "system" | "light" | "dark") => Promise<"light" | "dark">;
		get: () => Promise<{ source: string; shouldUseDark: boolean }>;
		onUpdate: (cb: (info: { source: string; shouldUseDark: boolean }) => void) => () => void;
	};
	auth: {
		list: () => Promise<ProviderEntry[]>;
		knownProviders: () => Promise<string[]>;
		setKey: (provider: string, key: string) => Promise<void>;
		remove: (provider: string) => Promise<void>;
	};
	settings: {
		get: () => Promise<DesktopSettings>;
		set: (key: string, value: unknown) => Promise<void>;
		agentDir: () => Promise<string>;
	};
	appInfo: {
		version: () => Promise<string>;
	};
	updater: {
		check: () => Promise<void>;
		install: () => Promise<void>;
		onState: (cb: (state: UpdateState) => void) => () => void;
	};
}

export interface UpdateState {
	status:
		| "idle"
		| "checking"
		| "available"
		| "not-available"
		| "error"
		| "downloading"
		| "downloaded";
	version?: string;
	error?: string;
}

export interface LogEntry {
	timestamp: number;
	source: string;
	message: string;
	stack?: string;
}

export interface FileTreeNode {
	name: string;
	path: string;
	type: "file" | "directory";
}

export interface ProviderEntry {
	provider: string;
	type: "api_key" | "oauth";
	maskedKey?: string;
}

declare global {
	interface Window {
		pi: PiBridge;
	}
}

export const pi: PiBridge = window.pi;
