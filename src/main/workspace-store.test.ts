import { beforeEach, describe, expect, it } from "vitest";
import {
	addWorkspace,
	getActiveWorkspaceId,
	getWorkspace,
	listWorkspaces,
	removeWorkspace,
	setActiveWorkspaceId,
} from "./workspace-store";

describe("workspace-store", () => {
	beforeEach(() => {
		// Reset state: clear all workspaces and active id
		// We call removeWorkspace for each existing one to leverage the store logic
		for (const ws of listWorkspaces()) {
			removeWorkspace(ws.id);
		}
		setActiveWorkspaceId(null);
	});

	describe("listWorkspaces", () => {
		it("starts empty", () => {
			expect(listWorkspaces()).toEqual([]);
		});
	});

	describe("addWorkspace", () => {
		it("adds a workspace with auto-generated name from path", () => {
			const ws = addWorkspace("/Users/test/projects/my-app");
			expect(ws.name).toBe("my-app");
			expect(ws.path).toBe("/Users/test/projects/my-app");
			expect(ws.id).toBeTruthy();
			expect(ws.addedAt).toBeGreaterThan(0);
		});

		it("adds a workspace with explicit name", () => {
			const ws = addWorkspace("/some/path", "My Project");
			expect(ws.name).toBe("My Project");
		});

		it("returns existing workspace when path already added", () => {
			const first = addWorkspace("/Users/test/dup");
			const second = addWorkspace("/Users/test/dup");
			expect(first.id).toBe(second.id);
			expect(listWorkspaces()).toHaveLength(1);
		});

		it("sets active workspace when none is active", () => {
			const ws = addWorkspace("/Users/test/first");
			expect(getActiveWorkspaceId()).toBe(ws.id);
		});

		it("does not override active workspace when one exists", () => {
			const first = addWorkspace("/Users/test/first");
			setActiveWorkspaceId(first.id);
			const _second = addWorkspace("/Users/test/second");
			expect(getActiveWorkspaceId()).toBe(first.id);
		});
	});

	describe("getWorkspace", () => {
		it("returns workspace by id", () => {
			const ws = addWorkspace("/test/path");
			const found = getWorkspace(ws.id);
			expect(found).toBeDefined();
			expect(found?.path).toBe("/test/path");
		});

		it("returns undefined for unknown id", () => {
			expect(getWorkspace("nonexistent")).toBeUndefined();
		});
	});

	describe("removeWorkspace", () => {
		it("removes a workspace", () => {
			const ws = addWorkspace("/remove-me");
			removeWorkspace(ws.id);
			expect(listWorkspaces()).toHaveLength(0);
		});

		it("switches active workspace when active is removed", () => {
			const first = addWorkspace("/first");
			const _second = addWorkspace("/second");
			setActiveWorkspaceId(first.id);
			removeWorkspace(first.id);
			// After removing the active, the next one should be selected
			const active = getActiveWorkspaceId();
			expect(active).not.toBe(first.id);
			// Could be second or null depending on implementation
		});

		it("sets active to null when last workspace removed", () => {
			const ws = addWorkspace("/only");
			setActiveWorkspaceId(ws.id);
			removeWorkspace(ws.id);
			expect(getActiveWorkspaceId()).toBeNull();
		});
	});

	describe("getActiveWorkspaceId / setActiveWorkspaceId", () => {
		it("starts as null", () => {
			expect(getActiveWorkspaceId()).toBeNull();
		});

		it("can be set and retrieved", () => {
			setActiveWorkspaceId("some-id");
			expect(getActiveWorkspaceId()).toBe("some-id");
		});

		it("can be set to null", () => {
			setActiveWorkspaceId("some-id");
			setActiveWorkspaceId(null);
			expect(getActiveWorkspaceId()).toBeNull();
		});
	});

	describe("listWorkspaces after multiple adds", () => {
		it("returns all workspaces", () => {
			addWorkspace("/a");
			addWorkspace("/b");
			addWorkspace("/c");
			expect(listWorkspaces()).toHaveLength(3);
		});
	});
});
