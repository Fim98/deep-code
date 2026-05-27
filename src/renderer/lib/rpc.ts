import type {
	AgentSessionEvent,
	RpcCommand,
	RpcResponse,
} from "@earendil-works/pi-coding-agent";

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
		open: (opts: {
			workspaceId: string;
			sessionFile?: string;
		}) => Promise<OpenSessionResult>;
		close: (sessionId: string) => Promise<void>;
		delete: (args: {
			workspaceId: string;
			sessionPath: string;
		}) => Promise<void>;
	};
	rpc: {
		send: <C extends RpcCommand>(
			sessionId: string,
			command: C,
		) => Promise<RpcResponse>;
		subscribe: (
			sessionId: string,
			cb: (event: AgentSessionEvent) => void,
		) => () => void;
	};
	theme: {
		setSource: (source: "system" | "light" | "dark") => Promise<"light" | "dark">;
		get: () => Promise<{ source: string; shouldUseDark: boolean }>;
		onUpdate: (
			cb: (info: { source: string; shouldUseDark: boolean }) => void,
		) => () => void;
	};
	auth: {
		list: () => Promise<ProviderEntry[]>;
		knownProviders: () => Promise<string[]>;
		setKey: (provider: string, key: string) => Promise<void>;
		remove: (provider: string) => Promise<void>;
	};
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
