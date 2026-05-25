import type {
	AgentSessionEvent,
	RpcCommand,
	RpcResponse,
} from "@earendil-works/pi-coding-agent";
import type { WorkspaceEntry } from "../../main/workspace-store.js";
import type { SessionListItem } from "../../main/session-fs.js";
import type { OpenSessionResult } from "../../main/session-registry.js";

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
}

declare global {
	interface Window {
		pi: PiBridge;
	}
}

export const pi: PiBridge = window.pi;
