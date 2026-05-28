import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessions } from "./session-state";

// Access the mock pi bridge from window
const mockPi = (window as any).pi;

describe("session-state store", () => {
	beforeEach(() => {
		// Reset store state between tests
		useSessions.setState({ bySession: {}, currentSessionId: null });
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("setCurrent", () => {
		it("sets the current session id", () => {
			useSessions.getState().setCurrent("session-1");
			expect(useSessions.getState().currentSessionId).toBe("session-1");
		});

		it("can be set to null", () => {
			useSessions.getState().setCurrent("session-1");
			useSessions.getState().setCurrent(null);
			expect(useSessions.getState().currentSessionId).toBeNull();
		});
	});

	describe("hydrate", () => {
		it("populates session slice from RPC responses", async () => {
			const messages = [
				{ role: "user", content: "hello", timestamp: 1 },
				{ role: "assistant", content: [{ type: "text", text: "hi" }], timestamp: 2 },
			];
			const state = {
				model: "claude-sonnet-4-20250514",
				thinkingLevel: "off",
				isStreaming: false,
				isCompacting: false,
				steeringMode: "off",
				followUpMode: "off",
				sessionFile: "/tmp/s.json",
				sessionId: "pi-id",
				sessionName: "Test",
				autoCompactionEnabled: true,
				messageCount: 2,
				pendingMessageCount: 0,
			};

			mockPi.rpc.send.mockImplementation((_sid: string, cmd: { type: string }) => {
				if (cmd.type === "get_messages") {
					return Promise.resolve({ success: true, command: "get_messages", data: { messages } });
				}
				if (cmd.type === "get_state") {
					return Promise.resolve({ success: true, command: "get_state", data: state });
				}
				return Promise.resolve({ success: true });
			});

			await useSessions.getState().hydrate("session-1");

			const slice = useSessions.getState().bySession["session-1"];
			expect(slice).toBeDefined();
			expect(slice.messages).toHaveLength(2);
			expect(slice.state?.model).toBe("claude-sonnet-4-20250514");
			expect(slice.isStreaming).toBe(false);
		});

		it("handles failed RPC gracefully", async () => {
			mockPi.rpc.send.mockResolvedValue({ success: false, command: "get_messages", error: "err" });

			await useSessions.getState().hydrate("session-fail");

			const slice = useSessions.getState().bySession["session-fail"];
			expect(slice).toBeDefined();
			expect(slice.messages).toEqual([]);
			expect(slice.state).toBeNull();
		});
	});

	describe("attach", () => {
		it("subscribes to pi events and returns unsubscribe function", () => {
			const unsub = vi.fn();
			mockPi.rpc.subscribe.mockReturnValue(unsub);

			const cleanup = useSessions.getState().attach("session-1");
			expect(mockPi.rpc.subscribe).toHaveBeenCalledWith("session-1", expect.any(Function));
			cleanup();
			expect(unsub).toHaveBeenCalled();
		});
	});

	describe("addPendingSubmission / removePendingSubmission", () => {
		it("adds and removes pending submissions", () => {
			const { addPendingSubmission, removePendingSubmission } = useSessions.getState();

			// Need to ensure the session slice exists
			useSessions.setState({
				bySession: {
					s1: {
						messages: [],
						state: null,
						isStreaming: false,
						activeTools: {},
						pendingSubmissions: [],
						queue: { steering: [], followUp: [] },
					},
				},
			});

			addPendingSubmission("s1", { id: "p1", content: "hello", kind: "prompt" });

			let slice = useSessions.getState().bySession.s1;
			expect(slice.pendingSubmissions).toHaveLength(1);
			expect(slice.pendingSubmissions[0].content).toBe("hello");
			expect(slice.pendingSubmissions[0].createdAt).toBeGreaterThan(0);

			removePendingSubmission("s1", "p1");
			slice = useSessions.getState().bySession.s1;
			expect(slice.pendingSubmissions).toHaveLength(0);
		});

		it("creates session slice if it does not exist", () => {
			useSessions.getState().addPendingSubmission("new-session", {
				id: "p1",
				content: "test",
				kind: "prompt",
			});
			const slice = useSessions.getState().bySession["new-session"];
			expect(slice).toBeDefined();
			expect(slice.pendingSubmissions).toHaveLength(1);
		});
	});

	describe("event processing via attach callback", () => {
		it("processes agent_start event", () => {
			let eventHandler: ((ev: any) => void) | undefined;
			mockPi.rpc.subscribe.mockImplementation((_sid: string, cb: (ev: any) => void) => {
				eventHandler = cb;
				return vi.fn();
			});

			useSessions.setState({
				bySession: {
					s1: {
						messages: [],
						state: null,
						isStreaming: false,
						activeTools: {},
						pendingSubmissions: [],
						queue: { steering: [], followUp: [] },
					},
				},
			});

			useSessions.getState().attach("s1");
			expect(eventHandler).toBeDefined();

			// Simulate agent_start event
			eventHandler!({ type: "agent_start" });

			const slice = useSessions.getState().bySession.s1;
			expect(slice.isStreaming).toBe(true);
		});

		it("processes agent_end event", () => {
			let eventHandler: ((ev: any) => void) | undefined;
			mockPi.rpc.subscribe.mockImplementation((_sid: string, cb: (ev: any) => void) => {
				eventHandler = cb;
				return vi.fn();
			});

			useSessions.setState({
				bySession: {
					s1: {
						messages: [],
						state: null,
						isStreaming: true,
						activeTools: {},
						pendingSubmissions: [],
						queue: { steering: [], followUp: [] },
					},
				},
			});

			useSessions.getState().attach("s1");

			eventHandler!({
				type: "agent_end",
				messages: [{ role: "assistant", content: [{ type: "text", text: "done" }], timestamp: 1 }],
				willRetry: false,
			});

			const slice = useSessions.getState().bySession.s1;
			expect(slice.isStreaming).toBe(false);
			expect(slice.messages).toHaveLength(1);
		});

		it("keeps streaming when agent_end has willRetry=true", () => {
			let eventHandler: ((ev: any) => void) | undefined;
			mockPi.rpc.subscribe.mockImplementation((_sid: string, cb: (ev: any) => void) => {
				eventHandler = cb;
				return vi.fn();
			});

			useSessions.setState({
				bySession: {
					s1: {
						messages: [],
						state: null,
						isStreaming: true,
						activeTools: {},
						pendingSubmissions: [],
						queue: { steering: [], followUp: [] },
					},
				},
			});

			useSessions.getState().attach("s1");

			eventHandler!({
				type: "agent_end",
				messages: [],
				willRetry: true,
			});

			const slice = useSessions.getState().bySession.s1;
			expect(slice.isStreaming).toBe(true);
		});

		it("processes tool_execution_start event", () => {
			let eventHandler: ((ev: any) => void) | undefined;
			mockPi.rpc.subscribe.mockImplementation((_sid: string, cb: (ev: any) => void) => {
				eventHandler = cb;
				return vi.fn();
			});

			useSessions.setState({
				bySession: {
					s1: {
						messages: [],
						state: null,
						isStreaming: true,
						activeTools: {},
						pendingSubmissions: [],
						queue: { steering: [], followUp: [] },
					},
				},
			});

			useSessions.getState().attach("s1");

			eventHandler!({
				type: "tool_execution_start",
				toolCallId: "tc-1",
				toolName: "read",
				args: { path: "/test.txt" },
			});

			const slice = useSessions.getState().bySession.s1;
			expect(slice.activeTools["tc-1"]).toBeDefined();
			expect(slice.activeTools["tc-1"].toolName).toBe("read");
			expect(slice.activeTools["tc-1"].status).toBe("running");
		});

		it("processes tool_execution_end event", () => {
			let eventHandler: ((ev: any) => void) | undefined;
			mockPi.rpc.subscribe.mockImplementation((_sid: string, cb: (ev: any) => void) => {
				eventHandler = cb;
				return vi.fn();
			});

			useSessions.setState({
				bySession: {
					s1: {
						messages: [],
						state: null,
						isStreaming: true,
						activeTools: {
							"tc-1": {
								toolCallId: "tc-1",
								toolName: "read",
								args: {},
								status: "running" as const,
								updatedAt: Date.now(),
							},
						},
						pendingSubmissions: [],
						queue: { steering: [], followUp: [] },
					},
				},
			});

			useSessions.getState().attach("s1");

			eventHandler!({
				type: "tool_execution_end",
				toolCallId: "tc-1",
				toolName: "read",
				isError: false,
				result: { content: [{ type: "text", text: "file contents" }] },
			});

			const slice = useSessions.getState().bySession.s1;
			expect(slice.activeTools["tc-1"].status).toBe("done");
		});

		it("processes queue_update event", () => {
			let eventHandler: ((ev: any) => void) | undefined;
			mockPi.rpc.subscribe.mockImplementation((_sid: string, cb: (ev: any) => void) => {
				eventHandler = cb;
				return vi.fn();
			});

			useSessions.setState({
				bySession: {
					s1: {
						messages: [],
						state: null,
						isStreaming: true,
						activeTools: {},
						pendingSubmissions: [
							{ id: "p1", content: "queued msg", kind: "steer" as const, createdAt: 1 },
						],
						queue: { steering: [], followUp: [] },
					},
				},
			});

			useSessions.getState().attach("s1");

			eventHandler!({
				type: "queue_update",
				steering: ["queued msg"],
				followUp: [],
			});

			const slice = useSessions.getState().bySession.s1;
			// pending submission matching queued content should be removed
			expect(slice.pendingSubmissions).toHaveLength(0);
			expect(slice.queue.steering).toEqual(["queued msg"]);
		});
	});
});
