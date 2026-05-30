import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock shared-services before importing the module under test
vi.mock("./shared-services.js", () => ({
	getSharedServices: () => ({ agentDir: __testAgentDir }),
}));

let __testAgentDir: string;

// Dynamic import after mock
async function importModule() {
	const mod = await import("./session-stats.js");
	return mod.getSessionStats;
}

describe("session-stats", () => {
	beforeEach(() => {
		__testAgentDir = mkdtempSync(join(tmpdir(), "deepcode-stats-"));
		mkdirSync(join(__testAgentDir, "sessions", "--test-workspace--"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(__testAgentDir)) rmSync(__testAgentDir, { recursive: true });
	});

	it("returns empty result when no sessions exist", async () => {
		const getSessionStats = await importModule();
		const result = getSessionStats();
		expect(result.days).toEqual([]);
		expect(result.totalCost).toBe(0);
		expect(result.totalTokens).toBe(0);
		expect(result.totalRequests).toBe(0);
		expect(result.sessionCount).toBe(0);
	});

	it("aggregates token usage from session JSONL files", async () => {
		const sessionDir = join(__testAgentDir, "sessions", "--test-workspace--");
		const sessionFile = join(sessionDir, "2026-05-28T10-00-00-000Z_test.jsonl");

		const lines = [
			JSON.stringify({
				type: "session",
				version: 3,
				id: "test-session",
				timestamp: "2026-05-28T10:00:00.000Z",
				cwd: "/test/workspace",
			}),
			JSON.stringify({
				type: "message",
				id: "msg1",
				timestamp: "2026-05-28T10:01:00.000Z",
				message: {
					role: "user",
					content: "hello",
					timestamp: Date.now(),
				},
			}),
			JSON.stringify({
				type: "message",
				id: "msg2",
				timestamp: "2026-05-28T10:02:00.000Z",
				message: {
					role: "assistant",
					content: [{ type: "text", text: "hi there" }],
					model: "test-model",
					usage: {
						input: 100,
						output: 50,
						cacheRead: 200,
						cacheWrite: 0,
						totalTokens: 350,
						cost: { input: 0.01, output: 0.005, cacheRead: 0.002, cacheWrite: 0, total: 0.017 },
					},
				},
			}),
			JSON.stringify({
				type: "message",
				id: "msg3",
				timestamp: "2026-05-28T10:03:00.000Z",
				message: {
					role: "assistant",
					content: [{ type: "text", text: "more output" }],
					model: "test-model",
					usage: {
						input: 50,
						output: 30,
						cacheRead: 100,
						cacheWrite: 10,
						totalTokens: 190,
						cost: {
							input: 0.005,
							output: 0.003,
							cacheRead: 0.001,
							cacheWrite: 0.0001,
							total: 0.0091,
						},
					},
				},
			}),
		];

		writeFileSync(sessionFile, lines.join("\n"));

		const getSessionStats = await importModule();
		const result = getSessionStats();

		expect(result.sessionCount).toBe(1);
		expect(result.totalRequests).toBe(2);
		expect(result.totalTokens).toBe(350 + 190);
		expect(result.totalInputTokens).toBe(100 + 50);
		expect(result.totalOutputTokens).toBe(50 + 30);
		expect(result.totalCacheReadTokens).toBe(200 + 100);
		expect(result.totalCacheWriteTokens).toBe(0 + 10);
		expect(result.totalCost).toBeCloseTo(0.017 + 0.0091, 6);

		expect(result.days).toHaveLength(1);
		expect(result.days[0].date).toBe("2026-05-28");
		expect(result.days[0].requests).toBe(2);
		expect(result.days[0].totalTokens).toBe(350 + 190);

		expect(result.workspaces).toContain("/test/workspace");
		expect(result.models["test-model"]).toBeDefined();
		expect(result.models["test-model"].requests).toBe(2);
	});

	it("skips user messages and zero-token assistant messages", async () => {
		const sessionDir = join(__testAgentDir, "sessions", "--test-workspace--");
		const sessionFile = join(sessionDir, "2026-05-28T10-00-00-000Z_test.jsonl");

		const lines = [
			JSON.stringify({
				type: "session",
				id: "test",
				timestamp: "2026-05-28T10:00:00.000Z",
				cwd: "/test",
			}),
			JSON.stringify({
				type: "message",
				id: "u1",
				timestamp: "2026-05-28T10:01:00.000Z",
				message: { role: "user", content: "hello" },
			}),
			JSON.stringify({
				type: "message",
				id: "a1",
				timestamp: "2026-05-28T10:02:00.000Z",
				message: {
					role: "assistant",
					content: [],
					usage: {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
				},
			}),
		];

		writeFileSync(sessionFile, lines.join("\n"));

		const getSessionStats = await importModule();
		const result = getSessionStats();

		expect(result.totalRequests).toBe(0);
		expect(result.totalTokens).toBe(0);
	});

	it("aggregates across multiple days", async () => {
		const sessionDir = join(__testAgentDir, "sessions", "--test-workspace--");

		const file1 = join(sessionDir, "2026-05-27T10-00-00-000Z_s1.jsonl");
		const file2 = join(sessionDir, "2026-05-28T10-00-00-000Z_s2.jsonl");

		writeFileSync(
			file1,
			[
				JSON.stringify({
					type: "session",
					id: "s1",
					timestamp: "2026-05-27T10:00:00.000Z",
					cwd: "/test",
				}),
				JSON.stringify({
					type: "message",
					id: "m1",
					timestamp: "2026-05-27T10:01:00.000Z",
					message: {
						role: "assistant",
						content: [],
						model: "m1",
						usage: {
							input: 100,
							output: 50,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 150,
							cost: { input: 0.01, output: 0.005, cacheRead: 0, cacheWrite: 0, total: 0.015 },
						},
					},
				}),
			].join("\n"),
		);

		writeFileSync(
			file2,
			[
				JSON.stringify({
					type: "session",
					id: "s2",
					timestamp: "2026-05-28T10:00:00.000Z",
					cwd: "/test",
				}),
				JSON.stringify({
					type: "message",
					id: "m2",
					timestamp: "2026-05-28T10:01:00.000Z",
					message: {
						role: "assistant",
						content: [],
						model: "m1",
						usage: {
							input: 200,
							output: 100,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 300,
							cost: { input: 0.02, output: 0.01, cacheRead: 0, cacheWrite: 0, total: 0.03 },
						},
					},
				}),
			].join("\n"),
		);

		const getSessionStats = await importModule();
		const result = getSessionStats();

		expect(result.days).toHaveLength(2);
		// Sorted newest first
		expect(result.days[0].date).toBe("2026-05-28");
		expect(result.days[1].date).toBe("2026-05-27");

		expect(result.totalRequests).toBe(2);
		expect(result.totalTokens).toBe(150 + 300);
		expect(result.totalCost).toBeCloseTo(0.015 + 0.03, 6);
		expect(result.sessionCount).toBe(2);
	});
});
