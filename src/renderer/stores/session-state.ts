import { create } from "zustand";
import type {
	AgentSessionEvent,
	RpcSessionState,
} from "@earendil-works/pi-coding-agent";
import { pi } from "@/lib/rpc";

export type ChatMessage =
	| { role: "user"; content: string | unknown[]; timestamp: number }
	| {
			role: "assistant";
			content: unknown[];
			model?: string;
			timestamp: number;
			usage?: unknown;
			stopReason?: string;
	  }
	| {
			role: "toolResult";
			toolCallId: string;
			toolName: string;
			content: unknown[];
			isError: boolean;
			timestamp: number;
			details?: unknown;
	  }
	| {
			role: "custom";
			subtype: string;
			data: unknown;
			timestamp: number;
	  };

export interface ToolExecutionState {
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
	status: "pending" | "running" | "done" | "error";
	partialResult?: {
		content?: unknown[];
		isError?: boolean;
		details?: unknown;
	};
	result?: {
		content?: unknown[];
		isError?: boolean;
		details?: unknown;
	};
	updatedAt: number;
}

export interface PendingSubmission {
	id: string;
	content: string;
	kind: "prompt" | "steer";
	createdAt: number;
}

interface SessionSlice {
	messages: ChatMessage[];
	state: RpcSessionState | null;
	isStreaming: boolean;
	activeTools: Record<string, ToolExecutionState>;
	pendingSubmissions: PendingSubmission[];
	queue: {
		steering: string[];
		followUp: string[];
	};
}

interface Store {
	bySession: Record<string, SessionSlice>;
	currentSessionId: string | null;
	setCurrent: (sid: string | null) => void;
	hydrate: (sid: string) => Promise<void>;
	attach: (sid: string) => () => void;
	addPendingSubmission: (
		sid: string,
		submission: Omit<PendingSubmission, "createdAt">,
	) => void;
	removePendingSubmission: (sid: string, id: string) => void;
}

const emptySlice = (): SessionSlice => ({
	messages: [],
	state: null,
	isStreaming: false,
	activeTools: {},
	pendingSubmissions: [],
	queue: { steering: [], followUp: [] },
});

function toChatMessage(m: any): ChatMessage {
	if (!m || typeof m !== "object") {
		return { role: "custom", subtype: "unknown", data: m, timestamp: Date.now() };
	}
	if (m.role === "user" || m.role === "assistant" || m.role === "toolResult") {
		return m as ChatMessage;
	}
	return {
		role: "custom",
		subtype: m.type ?? m.subtype ?? "custom",
		data: m,
		timestamp: m.timestamp ?? Date.now(),
	};
}

function updateMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
	const idx = list.findIndex(
		(m) => m.role === incoming.role && m.timestamp === incoming.timestamp,
	);
	if (idx === -1) return [...list, incoming];
	const next = list.slice();
	next[idx] = incoming;
	return next;
}

export const useSessions = create<Store>((set, get) => ({
	bySession: {},
	currentSessionId: null,
	setCurrent: (sid) => set({ currentSessionId: sid }),

	hydrate: async (sid: string) => {
		const [messagesResp, stateResp] = await Promise.all([
			pi.rpc.send(sid, { type: "get_messages" }),
			pi.rpc.send(sid, { type: "get_state" }),
		]);
		const messages =
			messagesResp.success && messagesResp.command === "get_messages"
				? (messagesResp.data.messages as any[]).map(toChatMessage)
				: [];
		const state =
			stateResp.success && stateResp.command === "get_state"
				? (stateResp.data as RpcSessionState)
				: null;
		set((s) => ({
			bySession: {
				...s.bySession,
				[sid]: {
					messages,
					state,
					isStreaming: state?.isStreaming ?? false,
					activeTools: {},
					pendingSubmissions: [],
					queue: { steering: [], followUp: [] },
				},
			},
		}));
	},

	attach: (sid: string) => {
		const unsub = pi.rpc.subscribe(sid, (ev) => applyEvent(set, get, sid, ev));
		return unsub;
	},

	addPendingSubmission: (sid, submission) => {
		set((s) => {
			const slice = s.bySession[sid] ?? emptySlice();
			return {
				bySession: {
					...s.bySession,
					[sid]: {
						...slice,
						pendingSubmissions: [
							...slice.pendingSubmissions,
							{ ...submission, createdAt: Date.now() },
						],
					},
				},
			};
		});
	},

	removePendingSubmission: (sid, id) => {
		set((s) => {
			const slice = s.bySession[sid] ?? emptySlice();
			return {
				bySession: {
					...s.bySession,
					[sid]: {
						...slice,
						pendingSubmissions: slice.pendingSubmissions.filter(
							(item) => item.id !== id,
						),
					},
				},
			};
		});
	},
}));

function applyEvent(
	set: (fn: (s: Store) => Partial<Store>) => void,
	_get: () => Store,
	sid: string,
	event: AgentSessionEvent,
) {
	set((s) => {
		const slice = s.bySession[sid] ?? emptySlice();
		let next: SessionSlice = slice;
		switch (event.type) {
			case "queue_update": {
				const queued = new Set([...event.steering, ...event.followUp]);
				next = {
					...slice,
					pendingSubmissions: slice.pendingSubmissions.filter(
						(item) => !queued.has(item.content),
					),
					queue: {
						steering: [...event.steering],
						followUp: [...event.followUp],
					},
				};
				break;
			}
			case "agent_start": {
				next = { ...slice, isStreaming: true };
				break;
			}
			case "agent_end": {
				const messages = event.messages
					.map(toChatMessage)
					.reduce(updateMessage, slice.messages);
				next = { ...slice, messages, isStreaming: false, activeTools: {} };
				break;
			}
			case "message_start":
			case "message_update":
			case "message_end": {
				const incoming = toChatMessage(event.message);
				next = {
					...slice,
					messages: updateMessage(slice.messages, incoming),
				};
				if (incoming.role === "user") {
					next.pendingSubmissions = removeMatchingPending(
						slice.pendingSubmissions,
						incoming.content,
					);
				}
				if (event.type === "message_end" && incoming.role === "assistant") {
					next.isStreaming = false;
				}
				if (event.type === "message_start" && incoming.role === "assistant") {
					next.isStreaming = true;
				}
				break;
			}
			case "turn_end": {
				const incoming = toChatMessage(event.message);
				next = {
					...slice,
					messages: updateMessage(slice.messages, incoming),
				};
				if (incoming.role === "user") {
					next.pendingSubmissions = removeMatchingPending(
						slice.pendingSubmissions,
						incoming.content,
					);
				}
				if (event.toolResults?.length) {
					let withResults = next.messages;
					for (const r of event.toolResults) {
						withResults = updateMessage(withResults, toChatMessage(r));
					}
					next.messages = withResults;
				}
				break;
			}
			case "tool_execution_start":
			case "tool_execution_update":
			case "tool_execution_end": {
				next = {
					...slice,
					activeTools: updateToolState(slice.activeTools ?? {}, event),
				};
				break;
			}
			default: {
				// Other AgentEvent / custom event types: ignore for now.
				break;
			}
		}
		return { bySession: { ...s.bySession, [sid]: next } };
	});
}

function removeMatchingPending(
	pending: PendingSubmission[],
	content: string | unknown[],
): PendingSubmission[] {
	const text = userMessageText(content);
	if (!text) return pending;
	const index = pending.findIndex((item) => item.content === text);
	if (index === -1) return pending;
	return pending.filter((_, itemIndex) => itemIndex !== index);
}

function userMessageText(content: string | unknown[]): string {
	if (typeof content === "string") return content;
	return content
		.filter(
			(part): part is { type: "text"; text: string } =>
				!!part &&
				typeof part === "object" &&
				(part as { type?: unknown }).type === "text" &&
				typeof (part as { text?: unknown }).text === "string",
		)
		.map((part) => part.text)
		.join("\n");
}

function updateToolState(
	tools: Record<string, ToolExecutionState>,
	event: AgentSessionEvent,
): Record<string, ToolExecutionState> {
	const ev = event as Extract<
		AgentSessionEvent,
		{
			type:
				| "tool_execution_start"
				| "tool_execution_update"
				| "tool_execution_end";
		}
	>;
	if (
		ev.type !== "tool_execution_start" &&
		ev.type !== "tool_execution_update" &&
		ev.type !== "tool_execution_end"
	) {
		return tools;
	}
	const current = tools[ev.toolCallId];
	const now = Date.now();
	if (ev.type === "tool_execution_start") {
		return {
			...tools,
			[ev.toolCallId]: {
				toolCallId: ev.toolCallId,
				toolName: ev.toolName,
				args: (ev.args ?? {}) as Record<string, unknown>,
				status: "running",
				updatedAt: now,
			},
		};
	}
	if (ev.type === "tool_execution_update") {
		if (!current) return tools;
		return {
			...tools,
			[ev.toolCallId]: {
				...current,
				status: "running",
				partialResult: ev.partialResult as ToolExecutionState["partialResult"],
				updatedAt: now,
			},
		};
	}
	if (!current) return tools;
	return {
		...tools,
		[ev.toolCallId]: {
			...current,
			status: ev.isError ? "error" : "done",
			result: {
				...(ev.result as ToolExecutionState["result"]),
				isError: ev.isError,
			},
			updatedAt: now,
		},
	};
}
