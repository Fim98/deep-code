import { describe, expect, it } from "vitest";
import {
	formatStatus,
	formatWidgetData,
	handleClear,
	handleInit,
	handleStatus,
	handleUpdate,
	reconstructFromBranch,
} from "./plan-tracker-core";

describe("plan-tracker-core", () => {
	// ─── handleInit ────────────────────────────────────────────────────
	describe("handleInit", () => {
		it("creates tasks from names", () => {
			const result = handleInit(["task A", "task B", "task C"]);
			expect(result.tasks).toHaveLength(3);
			expect(result.tasks[0]).toEqual({ name: "task A", status: "pending" });
			expect(result.tasks[1]).toEqual({ name: "task B", status: "pending" });
			expect(result.tasks[2]).toEqual({ name: "task C", status: "pending" });
			expect(result.error).toBeUndefined();
		});

		it("returns error for empty array", () => {
			const result = handleInit([]);
			expect(result.error).toBeDefined();
			expect(result.tasks).toHaveLength(0);
		});

		it("returns error for undefined", () => {
			const result = handleInit(undefined);
			expect(result.error).toBeDefined();
		});
	});

	// ─── handleUpdate ──────────────────────────────────────────────────
	describe("handleUpdate", () => {
		const tasks = [
			{ name: "A", status: "pending" as const },
			{ name: "B", status: "pending" as const },
		];

		it("updates task status by index", () => {
			const result = handleUpdate(tasks, 0, "complete");
			expect(result.tasks[0].status).toBe("complete");
			expect(result.tasks[1].status).toBe("pending");
		});

		it("returns error for out of range index", () => {
			const result = handleUpdate(tasks, 5, "complete");
			expect(result.error).toContain("out of range");
		});

		it("returns error for negative index", () => {
			const result = handleUpdate(tasks, -1, "complete");
			expect(result.error).toContain("out of range");
		});

		it("returns error for empty tasks", () => {
			const result = handleUpdate([], 0, "complete");
			expect(result.error).toContain("no plan active");
		});

		it("returns error when index is undefined", () => {
			const result = handleUpdate(tasks, undefined, "complete");
			expect(result.error).toContain("required");
		});

		it("returns error when status is undefined", () => {
			const result = handleUpdate(tasks, 0, undefined);
			expect(result.error).toContain("required");
		});

		it("does not mutate original tasks", () => {
			handleUpdate(tasks, 0, "complete");
			expect(tasks[0].status).toBe("pending");
		});
	});

	// ─── handleStatus ──────────────────────────────────────────────────
	describe("handleStatus", () => {
		it("returns formatted status text", () => {
			const tasks = [
				{ name: "A", status: "complete" as const },
				{ name: "B", status: "in_progress" as const },
				{ name: "C", status: "pending" as const },
			];
			const result = handleStatus(tasks);
			expect(result.text).toContain("1/3 complete");
			expect(result.tasks).toHaveLength(3);
		});

		it("returns defensive copy of tasks", () => {
			const tasks = [{ name: "A", status: "pending" as const }];
			const result = handleStatus(tasks);
			expect(result.tasks).not.toBe(tasks);
		});
	});

	// ─── handleClear ───────────────────────────────────────────────────
	describe("handleClear", () => {
		it("clears all tasks", () => {
			const tasks = [
				{ name: "A", status: "pending" as const },
				{ name: "B", status: "complete" as const },
			];
			const result = handleClear(tasks);
			expect(result.tasks).toHaveLength(0);
			expect(result.text).toContain("2 tasks removed");
		});

		it("reports no plan when empty", () => {
			const result = handleClear([]);
			expect(result.text).toContain("No plan");
		});
	});

	// ─── formatStatus ──────────────────────────────────────────────────
	describe("formatStatus", () => {
		it("shows 'No plan active' for empty", () => {
			expect(formatStatus([])).toBe("No plan active.");
		});

		it("shows checkmark for complete tasks", () => {
			const result = formatStatus([{ name: "done", status: "complete" }]);
			expect(result).toContain("✓");
		});

		it("shows arrow for in_progress tasks", () => {
			const result = formatStatus([{ name: "working", status: "in_progress" }]);
			expect(result).toContain("→");
		});

		it("shows circle for pending tasks", () => {
			const result = formatStatus([{ name: "waiting", status: "pending" }]);
			expect(result).toContain("○");
		});
	});

	// ─── reconstructFromBranch ─────────────────────────────────────────
	describe("reconstructFromBranch", () => {
		it("returns empty for no entries", () => {
			expect(reconstructFromBranch([])).toEqual([]);
		});

		it("reconstructs tasks from plan_tracker tool results", () => {
			const entries = [
				{
					type: "message",
					message: {
						role: "toolResult",
						toolName: "plan_tracker",
						details: {
							action: "init" as const,
							tasks: [
								{ name: "A", status: "complete" as const },
								{ name: "B", status: "pending" as const },
							],
						},
					},
				},
			];
			const tasks = reconstructFromBranch(entries);
			expect(tasks).toHaveLength(2);
			expect(tasks[0].name).toBe("A");
		});

		it("uses the latest plan_tracker result", () => {
			const entries = [
				{
					type: "message",
					message: {
						role: "toolResult",
						toolName: "plan_tracker",
						details: {
							action: "init" as const,
							tasks: [{ name: "first", status: "pending" as const }],
						},
					},
				},
				{
					type: "message",
					message: {
						role: "toolResult",
						toolName: "plan_tracker",
						details: {
							action: "update" as const,
							tasks: [
								{ name: "first", status: "complete" as const },
								{ name: "second", status: "pending" as const },
							],
						},
					},
				},
			];
			const tasks = reconstructFromBranch(entries);
			expect(tasks).toHaveLength(2);
			expect(tasks[0].status).toBe("complete");
		});

		it("ignores non-plan_tracker entries", () => {
			const entries = [
				{
					type: "message",
					message: { role: "toolResult", toolName: "bash" },
				},
				{ type: "thinking_level_change" },
			];
			expect(reconstructFromBranch(entries)).toEqual([]);
		});

		it("skips entries with errors", () => {
			const entries = [
				{
					type: "message",
					message: {
						role: "toolResult",
						toolName: "plan_tracker",
						details: {
							action: "init" as const,
							tasks: [],
							error: "something failed",
						},
					},
				},
			];
			expect(reconstructFromBranch(entries)).toEqual([]);
		});
	});

	// ─── formatWidgetData ──────────────────────────────────────────────
	describe("formatWidgetData", () => {
		it("returns empty for no tasks", () => {
			const data = formatWidgetData([]);
			expect(data.icons).toEqual([]);
			expect(data.complete).toBe(0);
			expect(data.total).toBe(0);
			expect(data.currentName).toBe("");
		});

		it("computes progress correctly", () => {
			const tasks = [
				{ name: "A", status: "complete" as const },
				{ name: "B", status: "in_progress" as const },
				{ name: "C", status: "pending" as const },
			];
			const data = formatWidgetData(tasks);
			expect(data.total).toBe(3);
			expect(data.complete).toBe(1);
			expect(data.icons).toEqual(["✓", "→", "○"]);
			expect(data.currentName).toBe("B");
		});

		it("returns first pending when no in_progress", () => {
			const tasks = [
				{ name: "A", status: "complete" as const },
				{ name: "B", status: "pending" as const },
			];
			const data = formatWidgetData(tasks);
			expect(data.currentName).toBe("B");
		});

		it("returns empty currentName when all complete", () => {
			const tasks = [
				{ name: "A", status: "complete" as const },
				{ name: "B", status: "complete" as const },
			];
			const data = formatWidgetData(tasks);
			expect(data.complete).toBe(2);
			expect(data.currentName).toBe("");
		});
	});
});
