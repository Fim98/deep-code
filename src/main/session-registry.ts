import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
	type AgentSession,
	type AgentSessionEvent,
	type AgentSessionRuntime,
	type CreateAgentSessionRuntimeFactory,
	type CreateAgentSessionRuntimeResult,
	createAgentSessionFromServices,
	createAgentSessionRuntime,
	createAgentSessionServices,
	type ExtensionError,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { ExtensionUIBridge } from "./extension-ui-bridge.js";
import { createPlanTrackerTool } from "./plan-tracker-tool.js";
import {
	hasProjectTrustInputs,
	type ProjectTrustDecision,
	ProjectTrustStore,
} from "./project-trust.js";
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
	/** True when the workspace path did not exist and we fell back to process.cwd(). */
	cwdFallback?: boolean;
	/** Whether this workspace has project-local pi inputs such as AGENTS.md or .pi/. */
	projectHasTrustInputs: boolean;
	/** Saved trust decision from ~/.pi/agent/trust.json. */
	projectTrustDecision: ProjectTrustDecision;
	/** Effective trust used for this session. */
	projectTrusted: boolean;
}

type DesktopSessionEvent =
	| AgentSessionEvent
	| {
			type: "extension_error";
			extensionPath: string;
			event: string;
			error: string;
			stack?: string;
	  };

type Listener = (event: DesktopSessionEvent) => void;

interface Entry {
	runtime: AgentSessionRuntime;
	workspaceId: string;
	/** Mutable ref — updated on each rebind after session replacement. */
	unsubRef: { current: () => void };
	listeners: Set<Listener>;
	extensionBridge: ExtensionUIBridge;
}

function emitToListeners(listeners: Set<Listener>, event: DesktopSessionEvent): void {
	for (const listener of listeners) listener(event);
}

function toExtensionErrorEvent(err: ExtensionError): DesktopSessionEvent {
	return {
		type: "extension_error",
		extensionPath: err.extensionPath,
		event: err.event,
		error: err.error,
		stack: err.stack,
	};
}

async function bindRuntimeExtensions(
	runtime: AgentSessionRuntime,
	extensionBridge: ExtensionUIBridge,
	emit: (event: DesktopSessionEvent) => void,
): Promise<void> {
	await runtime.session.bindExtensions({
		uiContext: extensionBridge.createUIContext(),
		commandContextActions: {
			waitForIdle: () => runtime.session.agent.waitForIdle(),
			newSession: async (options) => runtime.newSession(options),
			fork: async (entryId, forkOptions) => {
				const result = await runtime.fork(entryId, forkOptions);
				return { cancelled: result.cancelled };
			},
			navigateTree: async (targetId, navigateOptions) => {
				const result = await runtime.session.navigateTree(targetId, {
					summarize: navigateOptions?.summarize,
					customInstructions: navigateOptions?.customInstructions,
					replaceInstructions: navigateOptions?.replaceInstructions,
					label: navigateOptions?.label,
				});
				return { cancelled: result.cancelled };
			},
			switchSession: async (sessionPath, switchOptions) =>
				runtime.switchSession(sessionPath, switchOptions),
			reload: async () => {
				await runtime.session.reload();
			},
		},
		onError: (err) => {
			emit(toExtensionErrorEvent(err));
		},
	});
}

class SessionRegistryImpl {
	private entries = new Map<string, Entry>();

	async open(opts: OpenSessionOptions): Promise<OpenSessionResult> {
		const ws = getWorkspace(opts.workspaceId);
		if (!ws) throw new Error(`Unknown workspaceId: ${opts.workspaceId}`);

		// If the workspace path no longer exists, fall back to process.cwd()
		// rather than letting tool calls fail silently later.
		let cwd = ws.path;
		if (!existsSync(cwd)) {
			cwd = process.cwd();
		}

		const { authStorage, modelRegistry, agentDir } = getSharedServices();
		const trustStore = new ProjectTrustStore(agentDir);
		const projectHasTrustInputs = hasProjectTrustInputs(cwd);
		const projectTrustDecision = projectHasTrustInputs ? trustStore.get(cwd) : null;
		const projectTrusted = !projectHasTrustInputs || projectTrustDecision === true;

		const sessionManager = opts.sessionFile
			? SessionManager.open(opts.sessionFile, undefined, cwd)
			: SessionManager.create(cwd);

		const createRuntime: CreateAgentSessionRuntimeFactory = async (
			options,
		): Promise<CreateAgentSessionRuntimeResult> => {
			const settingsManager = SettingsManager.create(options.cwd, options.agentDir);
			const maybeTrustAwareSettings = settingsManager as SettingsManager & {
				setProjectTrusted?: (trusted: boolean) => void;
			};
			maybeTrustAwareSettings.setProjectTrusted?.(projectTrusted);

			const services = await createAgentSessionServices({
				cwd: options.cwd,
				agentDir: options.agentDir,
				authStorage,
				modelRegistry,
				settingsManager,
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
			cwd,
			agentDir,
			sessionManager,
		});

		const sessionId = randomUUID();
		const listeners = new Set<Listener>();
		const emit = (event: DesktopSessionEvent) => emitToListeners(listeners, event);

		// Create extension UI bridge for this session
		const extensionBridge = new ExtensionUIBridge();
		await bindRuntimeExtensions(runtime, extensionBridge, emit);

		// Subscribe to the current session's events
		const unsubRef: { current: () => void } = {
			current: runtime.session.subscribe((event) => {
				emit(event);
			}),
		};

		// Tell the runtime how to rebind after session replacement (new/fork/switch)
		runtime.setRebindSession(async () => {
			unsubRef.current();
			unsubRef.current = runtime.session.subscribe((event) => {
				emit(event);
			});
			await bindRuntimeExtensions(runtime, extensionBridge, emit);
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
			cwdFallback: cwd !== ws.path ? true : undefined,
			projectHasTrustInputs,
			projectTrustDecision,
			projectTrusted,
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
