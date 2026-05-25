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

interface SessionSlice {
	messages: ChatMessage[];
	state: RpcSessionState | null;
	isStreaming: boolean;
}

interface Store {
	bySession: Record<string, SessionSlice>;
	currentSessionId: string | null;
	setCurrent: (sid: string | null) => void;
	hydrate: (sid: string) => Promise<void>;
	attach: (sid: string) => () => void;
}

const emptySlice = (): SessionSlice => ({
	messages: [],
	state: null,
	isStreaming: false,
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
				},
			},
		}));
	},

	attach: (sid: string) => {
		const unsub = pi.rpc.subscribe(sid, (ev) => applyEvent(set, get, sid, ev));
		return unsub;
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
			case "agent_start": {
				next = { ...slice, isStreaming: true };
				break;
			}
			case "agent_end": {
				const messages = event.messages.map(toChatMessage);
				next = { ...slice, messages, isStreaming: false };
				break;
			}
			case "message_start":
			case "message_update":
			case "message_end": {
				const incoming = toChatMessage(event.message);
				next = { ...slice, messages: updateMessage(slice.messages, incoming) };
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
				next = { ...slice, messages: updateMessage(slice.messages, incoming) };
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
				// Tool execution intermediate updates land in the next message_update;
				// no separate state needed for MVP.
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
