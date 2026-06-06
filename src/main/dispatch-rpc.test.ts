import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSession } from "../test/mock-session";
import { dispatchRpc } from "./dispatch-rpc";

describe("dispatchRpc", () => {
	let session: ReturnType<typeof createMockSession>;

	beforeEach(() => {
		session = createMockSession();
	});

	// ── prompt ──────────────────────────────────────────────────────────────
	describe("prompt", () => {
		it("calls session.prompt and returns success", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "1",
				type: "prompt",
				message: "hello",
			});
			expect(session.prompt).toHaveBeenCalledWith("hello", {
				images: undefined,
				streamingBehavior: undefined,
				source: "rpc",
				preflightResult: expect.any(Function),
			});
			expect(resp.success).toBe(true);
			expect(resp.command).toBe("prompt");
			expect(resp.id).toBe("1");
		});

		it("returns an error when session.prompt rejects before preflight succeeds", async () => {
			session.prompt.mockRejectedValue(new Error("boom"));
			const resp = await dispatchRpc(session as any, {
				id: "2",
				type: "prompt",
				message: "fail",
			});
			expect(resp.success).toBe(false);
			if (!resp.success) expect(resp.error).toBe("boom");
		});

		it("returns success after preflight even if the background prompt later rejects", async () => {
			session.prompt.mockImplementation(
				(_message: string, options: { preflightResult: (success: boolean) => void }) => {
					options.preflightResult(true);
					return Promise.reject(new Error("late boom"));
				},
			);
			const resp = await dispatchRpc(session as any, {
				id: "2b",
				type: "prompt",
				message: "fail later",
			});
			expect(resp.success).toBe(true);
		});
	});

	// ── steer / follow_up ───────────────────────────────────────────────────
	describe("steer", () => {
		it("calls session.steer and returns success", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "3",
				type: "steer",
				message: "go left",
			});
			expect(session.steer).toHaveBeenCalledWith("go left", undefined);
			expect(resp.success).toBe(true);
		});
	});

	describe("follow_up", () => {
		it("calls session.followUp", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "4",
				type: "follow_up",
				message: "continue",
			});
			expect(session.followUp).toHaveBeenCalledWith("continue", undefined);
			expect(resp.success).toBe(true);
		});
	});

	// ── abort ───────────────────────────────────────────────────────────────
	describe("abort", () => {
		it("calls session.abort", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "5",
				type: "abort",
			});
			expect(session.abort).toHaveBeenCalled();
			expect(resp.success).toBe(true);
		});
	});

	// ── get_state ───────────────────────────────────────────────────────────
	describe("get_state", () => {
		it("returns current session state", async () => {
			session.model = "gpt-4o";
			session.thinkingLevel = "high";
			session.isStreaming = true;
			session.sessionName = "My Session";
			session.messages = [{}, {}, {}] as any;

			const resp = await dispatchRpc(session as any, {
				id: "6",
				type: "get_state",
			});
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "get_state") {
				expect(resp.data.model).toBe("gpt-4o");
				expect(resp.data.thinkingLevel).toBe("high");
				expect(resp.data.isStreaming).toBe(true);
				expect(resp.data.sessionName).toBe("My Session");
				expect(resp.data.messageCount).toBe(3);
			}
		});
	});

	// ── set_model ───────────────────────────────────────────────────────────
	describe("set_model", () => {
		it("sets the model when found", async () => {
			session.modelRegistry.getAvailable.mockResolvedValue([
				{ id: "claude-sonnet-4-20250514", provider: "anthropic", name: "Claude Sonnet" },
			]);
			const resp = await dispatchRpc(session as any, {
				id: "7",
				type: "set_model",
				provider: "anthropic",
				modelId: "claude-sonnet-4-20250514",
			});
			expect(resp.success).toBe(true);
			expect(session.setModel).toHaveBeenCalled();
		});

		it("fails when model not found", async () => {
			session.modelRegistry.getAvailable.mockResolvedValue([]);
			const resp = await dispatchRpc(session as any, {
				id: "8",
				type: "set_model",
				provider: "anthropic",
				modelId: "nonexistent",
			});
			expect(resp.success).toBe(false);
			if (!resp.success) {
				expect(resp.error).toContain("Model not found");
			}
		});
	});

	// ── cycle_model ─────────────────────────────────────────────────────────
	describe("cycle_model", () => {
		it("returns result from session.cycleModel", async () => {
			session.cycleModel.mockResolvedValue({ id: "gpt-4o", provider: "openai" });
			const resp = await dispatchRpc(session as any, {
				id: "9",
				type: "cycle_model",
			});
			expect(resp.success).toBe(true);
			expect(resp.command).toBe("cycle_model");
			if (resp.success && resp.command === "cycle_model") {
				expect(resp.data).not.toBeNull();
			}
		});
	});

	// ── get_available_models ────────────────────────────────────────────────
	describe("get_available_models", () => {
		it("returns models list", async () => {
			const models = [
				{ id: "m1", provider: "p1" },
				{ id: "m2", provider: "p2" },
			];
			session.modelRegistry.getAvailable.mockResolvedValue(models);
			const resp = await dispatchRpc(session as any, {
				id: "10",
				type: "get_available_models",
			});
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "get_available_models") {
				expect(resp.data.models).toEqual(models);
			}
		});
	});

	// ── set_thinking_level / cycle_thinking_level ───────────────────────────
	describe("set_thinking_level", () => {
		it("sets the thinking level", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "11",
				type: "set_thinking_level",
				level: "high",
			});
			expect(session.setThinkingLevel).toHaveBeenCalledWith("high");
			expect(resp.success).toBe(true);
		});
	});

	describe("cycle_thinking_level", () => {
		it("returns cycled level", async () => {
			session.cycleThinkingLevel.mockReturnValue("medium");
			const resp = await dispatchRpc(session as any, {
				id: "12",
				type: "cycle_thinking_level",
			});
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "cycle_thinking_level") {
				expect(resp.data).not.toBeNull();
				expect(resp.data!.level).toBe("medium");
			}
		});
	});

	// ── set_steering_mode / set_follow_up_mode ──────────────────────────────
	describe("set_steering_mode", () => {
		it("sets the steering mode", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "13",
				type: "set_steering_mode",
				mode: "all",
			});
			expect(session.setSteeringMode).toHaveBeenCalledWith("all");
			expect(resp.success).toBe(true);
		});
	});

	describe("set_follow_up_mode", () => {
		it("sets the follow-up mode", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "14",
				type: "set_follow_up_mode",
				mode: "all",
			});
			expect(session.setFollowUpMode).toHaveBeenCalledWith("all");
			expect(resp.success).toBe(true);
		});
	});

	// ── compact / set_auto_compaction / set_auto_retry / abort_retry ────────
	describe("compact", () => {
		it("calls session.compact", async () => {
			session.compact.mockResolvedValue({ compacted: true });
			const resp = await dispatchRpc(session as any, {
				id: "15",
				type: "compact",
			});
			expect(resp.success).toBe(true);
		});
	});

	describe("set_auto_compaction", () => {
		it("sets auto-compaction", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "16",
				type: "set_auto_compaction",
				enabled: false,
			});
			expect(session.setAutoCompactionEnabled).toHaveBeenCalledWith(false);
			expect(resp.success).toBe(true);
		});
	});

	describe("set_auto_retry", () => {
		it("sets auto-retry", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "17",
				type: "set_auto_retry",
				enabled: true,
			});
			expect(session.setAutoRetryEnabled).toHaveBeenCalledWith(true);
			expect(resp.success).toBe(true);
		});
	});

	describe("abort_retry", () => {
		it("calls session.abortRetry", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "18",
				type: "abort_retry",
			});
			expect(session.abortRetry).toHaveBeenCalled();
			expect(resp.success).toBe(true);
		});
	});

	// ── bash / abort_bash ───────────────────────────────────────────────────
	describe("bash", () => {
		it("executes a bash command", async () => {
			session.executeBash.mockResolvedValue({ output: "hello\n", exitCode: 0 });
			const resp = await dispatchRpc(session as any, {
				id: "19",
				type: "bash",
				command: "echo hello",
			});
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "bash") {
				expect(resp.data.output).toBe("hello\n");
			}
		});
	});

	describe("abort_bash", () => {
		it("aborts running bash", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "20",
				type: "abort_bash",
			});
			expect(session.abortBash).toHaveBeenCalled();
			expect(resp.success).toBe(true);
		});
	});

	// ── get_session_stats / export_html / get_last_assistant_text ───────────
	describe("get_session_stats", () => {
		it("returns stats", async () => {
			session.getSessionStats.mockReturnValue({
				sessionFile: "/tmp/test.json",
				sessionId: "sid",
				userMessages: 5,
				assistantMessages: 3,
				toolCalls: 2,
				toolResults: 2,
				totalMessages: 8,
				tokens: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, total: 150 },
				cost: 0.01,
			});
			const resp = await dispatchRpc(session as any, {
				id: "21",
				type: "get_session_stats",
			});
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "get_session_stats") {
				expect(resp.data.tokens.total).toBe(150);
			}
		});
	});

	describe("export_html", () => {
		it("exports to HTML", async () => {
			session.exportToHtml.mockResolvedValue("/tmp/out.html");
			const resp = await dispatchRpc(session as any, {
				id: "22",
				type: "export_html",
				outputPath: "/tmp/out.html",
			});
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "export_html") {
				expect(resp.data.path).toBe("/tmp/out.html");
			}
		});
	});

	describe("get_last_assistant_text", () => {
		it("returns last assistant text", async () => {
			session.getLastAssistantText.mockReturnValue("Hello world");
			const resp = await dispatchRpc(session as any, {
				id: "23",
				type: "get_last_assistant_text",
			});
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "get_last_assistant_text") {
				expect(resp.data.text).toBe("Hello world");
			}
		});
	});

	// ── set_session_name ────────────────────────────────────────────────────
	describe("set_session_name", () => {
		it("sets the name", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "24",
				type: "set_session_name",
				name: "New Name",
			});
			expect(session.setSessionName).toHaveBeenCalledWith("New Name");
			expect(resp.success).toBe(true);
		});

		it("rejects empty name", async () => {
			const resp = await dispatchRpc(session as any, {
				id: "25",
				type: "set_session_name",
				name: "   ",
			});
			expect(resp.success).toBe(false);
			if (!resp.success) {
				expect(resp.error).toContain("empty");
			}
		});
	});

	// ── get_messages / get_fork_messages ────────────────────────────────────
	describe("get_messages", () => {
		it("returns session messages", async () => {
			session.messages = [{ role: "user", content: "hi" }] as any;
			const resp = await dispatchRpc(session as any, {
				id: "26",
				type: "get_messages",
			});
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "get_messages") {
				expect(resp.data.messages).toHaveLength(1);
			}
		});
	});

	describe("get_fork_messages", () => {
		it("returns fork-eligible messages", async () => {
			session.getUserMessagesForForking.mockReturnValue([{ role: "user", content: "fork me" }]);
			const resp = await dispatchRpc(session as any, {
				id: "27",
				type: "get_fork_messages",
			});
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "get_fork_messages") {
				expect(resp.data.messages).toHaveLength(1);
			}
		});
	});

	// ── session replacement commands ──────────────────────────────────────
	describe("session replacement commands (no runtime)", () => {
		it("new_session fails without runtime", async () => {
			const resp = await dispatchRpc(session as any, { id: "28", type: "new_session" } as any);
			expect(resp.success).toBe(false);
			if (!resp.success) expect(resp.error).toContain("Runtime not available");
		});

		it("switch_session fails without runtime", async () => {
			const resp = await dispatchRpc(
				session as any,
				{ id: "28", type: "switch_session", sessionPath: "/tmp/x.json" } as any,
			);
			expect(resp.success).toBe(false);
			if (!resp.success) expect(resp.error).toContain("Runtime not available");
		});

		it("fork fails without runtime", async () => {
			const resp = await dispatchRpc(
				session as any,
				{ id: "28", type: "fork", entryId: "e1" } as any,
			);
			expect(resp.success).toBe(false);
			if (!resp.success) expect(resp.error).toContain("Runtime not available");
		});

		it("clone fails without runtime", async () => {
			const resp = await dispatchRpc(session as any, { id: "28", type: "clone" } as any);
			expect(resp.success).toBe(false);
			if (!resp.success) expect(resp.error).toContain("Runtime not available");
		});
	});

	describe("session replacement commands (with runtime)", () => {
		let mockRuntime: {
			newSession: ReturnType<typeof vi.fn>;
			switchSession: ReturnType<typeof vi.fn>;
			fork: ReturnType<typeof vi.fn>;
			dispose: ReturnType<typeof vi.fn>;
		};

		beforeEach(() => {
			mockRuntime = {
				newSession: vi.fn().mockResolvedValue({ cancelled: false }),
				switchSession: vi.fn().mockResolvedValue({ cancelled: false }),
				fork: vi.fn().mockResolvedValue({ cancelled: false, selectedText: "forked text" }),
				dispose: vi.fn(),
			};
		});

		it("new_session delegates to runtime.newSession", async () => {
			const resp = await dispatchRpc(
				session as any,
				{ id: "30", type: "new_session" } as any,
				mockRuntime as any,
			);
			expect(mockRuntime.newSession).toHaveBeenCalled();
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "new_session") {
				expect(resp.data.cancelled).toBe(false);
			}
		});

		it("new_session passes parentSession option", async () => {
			const resp = await dispatchRpc(
				session as any,
				{ id: "31", type: "new_session", parentSession: "/tmp/parent.json" } as any,
				mockRuntime as any,
			);
			expect(mockRuntime.newSession).toHaveBeenCalledWith({ parentSession: "/tmp/parent.json" });
			expect(resp.success).toBe(true);
		});

		it("switch_session delegates to runtime.switchSession", async () => {
			const resp = await dispatchRpc(
				session as any,
				{ id: "32", type: "switch_session", sessionPath: "/tmp/other.json" } as any,
				mockRuntime as any,
			);
			expect(mockRuntime.switchSession).toHaveBeenCalledWith("/tmp/other.json");
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "switch_session") {
				expect(resp.data.cancelled).toBe(false);
			}
		});

		it("fork delegates to runtime.fork and returns text", async () => {
			const resp = await dispatchRpc(
				session as any,
				{ id: "33", type: "fork", entryId: "entry-42" } as any,
				mockRuntime as any,
			);
			expect(mockRuntime.fork).toHaveBeenCalledWith("entry-42");
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "fork") {
				expect(resp.data.text).toBe("forked text");
				expect(resp.data.cancelled).toBe(false);
			}
		});

		it("clone uses getLeafId + runtime.fork at position 'at'", async () => {
			session.sessionManager = { getLeafId: vi.fn().mockReturnValue("leaf-99") } as any;
			const resp = await dispatchRpc(
				session as any,
				{ id: "34", type: "clone" } as any,
				mockRuntime as any,
			);
			expect(mockRuntime.fork).toHaveBeenCalledWith("leaf-99", { position: "at" });
			expect(resp.success).toBe(true);
		});

		it("clone fails when no leaf id", async () => {
			session.sessionManager = { getLeafId: vi.fn().mockReturnValue(null) } as any;
			const resp = await dispatchRpc(
				session as any,
				{ id: "35", type: "clone" } as any,
				mockRuntime as any,
			);
			expect(resp.success).toBe(false);
			if (!resp.success) expect(resp.error).toContain("no current entry");
		});
	});

	// ── get_commands ────────────────────────────────────────────────────────
	describe("get_commands", () => {
		it("returns registered extension commands, prompt templates, and skills", async () => {
			session.extensionRunner = {
				getRegisteredCommands: vi
					.fn()
					.mockReturnValue([
						{ invocationName: "help", description: "Show help", sourceInfo: { path: "ext1" } },
					]),
			} as any;
			session.promptTemplates = [
				{ name: "review", description: "Code review", sourceInfo: { path: "pt1" } },
			] as any;
			session.resourceLoader = {
				getSkills: vi.fn().mockReturnValue({
					skills: [{ name: "debug", description: "Debug helper", sourceInfo: { path: "sk1" } }],
				}),
			} as any;

			const resp = await dispatchRpc(session as any, { id: "36", type: "get_commands" });
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "get_commands") {
				expect(resp.data.commands).toHaveLength(3);
				expect(resp.data.commands[0].name).toBe("help");
				expect(resp.data.commands[0].source).toBe("extension");
				expect(resp.data.commands[1].name).toBe("review");
				expect(resp.data.commands[1].source).toBe("prompt");
				expect(resp.data.commands[2].name).toBe("skill:debug");
				expect(resp.data.commands[2].source).toBe("skill");
			}
		});

		it("returns empty commands when nothing registered", async () => {
			session.extensionRunner = { getRegisteredCommands: vi.fn().mockReturnValue([]) } as any;
			session.promptTemplates = [];
			session.resourceLoader = { getSkills: vi.fn().mockReturnValue({ skills: [] }) } as any;

			const resp = await dispatchRpc(session as any, { id: "37", type: "get_commands" });
			expect(resp.success).toBe(true);
			if (resp.success && resp.command === "get_commands") {
				expect(resp.data.commands).toHaveLength(0);
			}
		});
	});

	// ── unknown command ─────────────────────────────────────────────────────
	it("returns failure for unknown command type", async () => {
		const resp = await dispatchRpc(session as any, {
			id: "29",
			type: "totally_unknown" as any,
		});
		expect(resp.success).toBe(false);
		if (!resp.success) {
			expect(resp.error).toContain("Unknown command");
		}
	});

	// ── error handling ──────────────────────────────────────────────────────
	it("catches thrown errors and returns failure", async () => {
		session.steer.mockRejectedValue(new Error("steer exploded"));
		const resp = await dispatchRpc(session as any, {
			id: "30",
			type: "steer",
			message: "crash",
		});
		expect(resp.success).toBe(false);
		if (!resp.success) {
			expect(resp.error).toBe("steer exploded");
		}
	});
});
