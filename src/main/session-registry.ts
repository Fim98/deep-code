import { randomUUID } from "node:crypto";
import {
	type AgentSession,
	type AgentSessionEvent,
	createAgentSession,
	SessionManager,
} from "@earendil-works/pi-coding-agent";
import { getSharedServices } from "./shared-services.js";
import { getWorkspace } from "./workspace-store.js";

export interface OpenSessionOptions {
	workspaceId: string;
	/** Existing session file to resume. If omitted, a fresh session is created. */
	sessionFile?: string;
}

export interface OpenSessionResult {
	sessionId: string;
	workspaceId: string;
	sessionFile: string | undefined;
	piSessionId: string;
}

type Listener = (event: AgentSessionEvent) => void;

interface Entry {
	session: AgentSession;
	workspaceId: string;
	unsubscribe: () => void;
	listeners: Set<Listener>;
}

class SessionRegistryImpl {
	private entries = new Map<string, Entry>();

	async open(opts: OpenSessionOptions): Promise<OpenSessionResult> {
		const ws = getWorkspace(opts.workspaceId);
		if (!ws) throw new Error(`Unknown workspaceId: ${opts.workspaceId}`);
		const { authStorage, modelRegistry } = getSharedServices();
		const sessionManager = opts.sessionFile
			? SessionManager.open(opts.sessionFile, undefined, ws.path)
			: SessionManager.create(ws.path);
		const { session } = await createAgentSession({
			cwd: ws.path,
			authStorage,
			modelRegistry,
			sessionManager,
		});
		const sessionId = randomUUID();
		const listeners = new Set<Listener>();
		const unsubscribe = session.subscribe((event) => {
			for (const l of listeners) l(event);
		});
		this.entries.set(sessionId, {
			session,
			workspaceId: opts.workspaceId,
			unsubscribe,
			listeners,
		});
		return {
			sessionId,
			workspaceId: opts.workspaceId,
			sessionFile: session.sessionFile,
			piSessionId: session.sessionId,
		};
	}

	get(sessionId: string): AgentSession {
		const entry = this.entries.get(sessionId);
		if (!entry) throw new Error(`Unknown session: ${sessionId}`);
		return entry.session;
	}

	tryGet(sessionId: string): AgentSession | undefined {
		return this.entries.get(sessionId)?.session;
	}

	addListener(sessionId: string, listener: Listener): () => void {
		const entry = this.entries.get(sessionId);
		if (!entry) throw new Error(`Unknown session: ${sessionId}`);
		entry.listeners.add(listener);
		return () => entry.listeners.delete(listener);
	}

	async close(sessionId: string): Promise<void> {
		const entry = this.entries.get(sessionId);
		if (!entry) return;
		entry.unsubscribe();
		entry.listeners.clear();
		this.entries.delete(sessionId);
	}

	listOpen(): Array<{ sessionId: string; workspaceId: string }> {
		return Array.from(this.entries.entries()).map(([id, e]) => ({
			sessionId: id,
			workspaceId: e.workspaceId,
		}));
	}
}

export const sessionRegistry = new SessionRegistryImpl();
