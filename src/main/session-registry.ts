import { randomUUID } from "node:crypto";
import {
	type AgentSession,
	type AgentSessionEvent,
	type AgentSessionRuntime,
	type CreateAgentSessionRuntimeFactory,
	type CreateAgentSessionRuntimeResult,
	createAgentSessionFromServices,
	createAgentSessionRuntime,
	createAgentSessionServices,
	SessionManager,
} from "@earendil-works/pi-coding-agent";
import { ExtensionUIBridge } from "./extension-ui-bridge.js";
import { createPlanTrackerTool } from "./plan-tracker-tool.js";
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
	runtime: AgentSessionRuntime;
	workspaceId: string;
	/** Mutable ref — updated on each rebind after session replacement. */
	unsubRef: { current: () => void };
	listeners: Set<Listener>;
	extensionBridge: ExtensionUIBridge;
}

class SessionRegistryImpl {
	private entries = new Map<string, Entry>();

	async open(opts: OpenSessionOptions): Promise<OpenSessionResult> {
		const ws = getWorkspace(opts.workspaceId);
		if (!ws) throw new Error(`Unknown workspaceId: ${opts.workspaceId}`);
		const { authStorage, modelRegistry, agentDir } = getSharedServices();

		const sessionManager = opts.sessionFile
			? SessionManager.open(opts.sessionFile, undefined, ws.path)
			: SessionManager.create(ws.path);

		const createRuntime: CreateAgentSessionRuntimeFactory = async (
			options,
		): Promise<CreateAgentSessionRuntimeResult> => {
			const services = await createAgentSessionServices({
				cwd: options.cwd,
				agentDir: options.agentDir,
				authStorage,
				modelRegistry,
			});
			const result = await createAgentSessionFromServices({
				services,
				sessionManager: options.sessionManager,
				sessionStartEvent: options.sessionStartEvent,
				customTools: [createPlanTrackerTool()],
			});
			return { ...result, services, diagnostics: services.diagnostics };
		};

		const runtime = await createAgentSessionRuntime(createRuntime, {
			cwd: ws.path,
			agentDir,
			sessionManager,
		});

		const sessionId = randomUUID();
		const listeners = new Set<Listener>();

		// Create extension UI bridge for this session
		const extensionBridge = new ExtensionUIBridge();
		await runtime.session.bindExtensions({
			uiContext: extensionBridge.createUIContext(),
		});

		// Subscribe to the current session's events
		const unsubRef: { current: () => void } = {
			current: runtime.session.subscribe((event) => {
				for (const l of listeners) l(event);
			}),
		};

		// Tell the runtime how to rebind after session replacement (new/fork/switch)
		runtime.setRebindSession(async () => {
			unsubRef.current();
			unsubRef.current = runtime.session.subscribe((event) => {
				for (const l of listeners) l(event);
			});
			// Rebind extension UI context to the new session
			await runtime.session.bindExtensions({
				uiContext: extensionBridge.createUIContext(),
			});
		});

		this.entries.set(sessionId, {
			runtime,
			workspaceId: opts.workspaceId,
			unsubRef,
			listeners,
			extensionBridge,
		});

		return {
			sessionId,
			workspaceId: opts.workspaceId,
			sessionFile: runtime.session.sessionFile,
			piSessionId: runtime.session.sessionId,
		};
	}

	/** Get the current AgentSession for an entry (always the latest after replacement). */
	get(sessionId: string): AgentSession {
		const entry = this.entries.get(sessionId);
		if (!entry) throw new Error(`Unknown session: ${sessionId}`);
		return entry.runtime.session;
	}

	/** Get the AgentSessionRuntime for session replacement commands. */
	getRuntime(sessionId: string): AgentSessionRuntime {
		const entry = this.entries.get(sessionId);
		if (!entry) throw new Error(`Unknown session: ${sessionId}`);
		return entry.runtime;
	}

	/** Get the ExtensionUIBridge for a session. */
	getBridge(sessionId: string): ExtensionUIBridge {
		const entry = this.entries.get(sessionId);
		if (!entry) throw new Error(`Unknown session: ${sessionId}`);
		return entry.extensionBridge;
	}

	tryGet(sessionId: string): AgentSession | undefined {
		return this.entries.get(sessionId)?.runtime.session;
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
		entry.unsubRef.current();
		entry.listeners.clear();
		entry.extensionBridge.dispose();
		await entry.runtime.dispose();
		this.entries.delete(sessionId);
	}

	listOpen(): Array<{ sessionId: string; workspaceId: string }> {
		return Array.from(this.entries.entries()).map(([id, e]) => ({
			sessionId: id,
			workspaceId: e.workspaceId,
		}));
	}

	/** Bind all bridges to a window (for sending IPC to renderer). */
	bindWindowToAllBridges(win: import("electron").BrowserWindow): void {
		for (const [sid, entry] of this.entries) {
			entry.extensionBridge.bindWindow(win, sid);
		}
	}

	/** Bind a single bridge to a window. */
	bindWindowToBridge(sessionId: string, win: import("electron").BrowserWindow): void {
		const entry = this.entries.get(sessionId);
		if (entry) entry.extensionBridge.bindWindow(win, sessionId);
	}
}

export const sessionRegistry = new SessionRegistryImpl();
