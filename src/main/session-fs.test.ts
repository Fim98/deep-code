import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock SessionManager from pi SDK
vi.mock("@earendil-works/pi-coding-agent", () => ({
	SessionManager: {
		list: vi.fn(),
	},
}));

// Mock node:fs/promises.rm
vi.mock("node:fs/promises", () => ({
	rm: vi.fn().mockResolvedValue(undefined),
}));

import { rm } from "node:fs/promises";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { deleteSessionFile, listSessionsForCwd } from "./session-fs";

describe("session-fs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("listSessionsForCwd", () => {
		it("returns sorted sessions (most recent first)", async () => {
			const mockSessions = [
				{
					path: "/a/old.json",
					id: "old",
					cwd: "/a",
					name: "Old",
					parentSessionPath: undefined,
					created: new Date("2025-01-01"),
					modified: new Date("2025-01-01"),
					messageCount: 5,
					firstMessage: "hello old",
				},
				{
					path: "/a/new.json",
					id: "new",
					cwd: "/a",
					name: "New",
					parentSessionPath: undefined,
					created: new Date("2025-06-01"),
					modified: new Date("2025-06-01"),
					messageCount: 10,
					firstMessage: "hello new",
				},
				{
					path: "/a/mid.json",
					id: "mid",
					cwd: "/a",
					name: undefined,
					parentSessionPath: undefined,
					created: new Date("2025-03-01"),
					modified: new Date("2025-03-01"),
					messageCount: 2,
					firstMessage: "hello mid",
				},
			];
			vi.mocked(SessionManager.list).mockResolvedValue(mockSessions as any);

			const result = await listSessionsForCwd("/a");

			expect(SessionManager.list).toHaveBeenCalledWith("/a");
			expect(result).toHaveLength(3);
			// Most recent first
			expect(result[0].id).toBe("new");
			expect(result[1].id).toBe("mid");
			expect(result[2].id).toBe("old");
		});

		it("converts Date fields to timestamps", async () => {
			const date = new Date("2025-06-15T12:00:00Z");
			vi.mocked(SessionManager.list).mockResolvedValue([
				{
					path: "/x.json",
					id: "x",
					cwd: "/x",
					created: date,
					modified: date,
					messageCount: 0,
					firstMessage: "",
				},
			] as any);

			const result = await listSessionsForCwd("/x");
			expect(result[0].created).toBe(date.getTime());
			expect(result[0].modified).toBe(date.getTime());
		});

		it("filters out sessions from other working directories", async () => {
			vi.mocked(SessionManager.list).mockResolvedValue([
				{
					path: "/a/root.json",
					id: "root",
					cwd: "/a",
					created: new Date("2025-06-01"),
					modified: new Date("2025-06-01"),
					messageCount: 1,
					firstMessage: "root",
				},
				{
					path: "/a/nested/child.json",
					id: "child",
					cwd: "/a/nested",
					created: new Date("2025-06-02"),
					modified: new Date("2025-06-02"),
					messageCount: 1,
					firstMessage: "child",
				},
			] as any);
			const result = await listSessionsForCwd("/a");
			expect(result.map((item) => item.id)).toEqual(["root"]);
		});

		it("returns empty array for no sessions", async () => {
			vi.mocked(SessionManager.list).mockResolvedValue([]);
			const result = await listSessionsForCwd("/empty");
			expect(result).toEqual([]);
		});
	});

	describe("deleteSessionFile", () => {
		it("calls rm with force flag", async () => {
			await deleteSessionFile("/tmp/session.json");
			expect(rm).toHaveBeenCalledWith("/tmp/session.json", { force: true });
		});

		it("throws on empty path", async () => {
			await expect(deleteSessionFile("")).rejects.toThrow("empty");
			await expect(deleteSessionFile("   ")).rejects.toThrow("empty");
		});

		it("does not call rm when path is empty", async () => {
			await expect(deleteSessionFile("")).rejects.toThrow();
			expect(rm).not.toHaveBeenCalled();
		});
	});
});
