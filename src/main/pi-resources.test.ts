import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPiResource, ensurePiResourceDir, getPiResourcePaths } from "./pi-resources";

vi.mock("./shared-services.js", () => ({
	getSharedServices: () => ({
		agentDir: "/tmp/antcode-test-agent",
	}),
}));

describe("pi-resources", () => {
	let cwd: string;

	beforeEach(async () => {
		cwd = await mkdtemp(join(tmpdir(), "antcode-pi-resources-"));
	});

	afterEach(async () => {
		await rm(cwd, { recursive: true, force: true });
		await rm("/tmp/antcode-test-agent", { recursive: true, force: true });
	});

	it("returns pi global and project resource paths", () => {
		expect(getPiResourcePaths(cwd)).toEqual({
			global: {
				prompts: "/tmp/antcode-test-agent/prompts",
				skills: "/tmp/antcode-test-agent/skills",
			},
			project: {
				prompts: join(cwd, ".pi", "prompts"),
				skills: join(cwd, ".pi", "skills"),
			},
		});
	});

	it("ensures resource directories", () => {
		const path = ensurePiResourceDir(cwd, "project", "prompts");
		expect(path).toBe(join(cwd, ".pi", "prompts"));
		expect(existsSync(path)).toBe(true);
	});

	it("creates pi-native prompt templates", () => {
		const path = createPiResource({
			cwd,
			scope: "project",
			kind: "prompts",
			name: "Review Code!",
			description: "Review changed files",
		});

		expect(path).toBe(join(cwd, ".pi", "prompts", "review-code.md"));
		const content = readFileSync(path, "utf-8");
		expect(content).toContain('description: "Review changed files"');
		expect(content).toContain('argument-hint: "[instructions]"');
		expect(content).toContain("# /review-code");
		expect(content).toContain("$ARGUMENTS");
	});

	it("creates pi-native skill templates", () => {
		const path = createPiResource({
			cwd,
			scope: "project",
			kind: "skills",
			name: "TypeScript Review",
			description: "Use when reviewing TypeScript code",
		});

		expect(path).toBe(join(cwd, ".pi", "skills", "typescript-review", "SKILL.md"));
		const content = readFileSync(path, "utf-8");
		expect(content).toContain("name: typescript-review");
		expect(content).toContain('description: "Use when reviewing TypeScript code"');
		expect(content).toContain("# TypeScript Review");
		expect(content).toContain("## When to use");
		expect(content).toContain("User: /skill:typescript-review <task details>");
	});

	it("rejects empty names", () => {
		expect(() => createPiResource({ cwd, scope: "project", kind: "prompts", name: "!!!" })).toThrow(
			"Resource name cannot be empty",
		);
	});

	it("rejects duplicate prompts and skills", () => {
		createPiResource({ cwd, scope: "project", kind: "prompts", name: "review" });
		expect(() =>
			createPiResource({ cwd, scope: "project", kind: "prompts", name: "review" }),
		).toThrow("Prompt already exists");

		createPiResource({ cwd, scope: "project", kind: "skills", name: "review" });
		expect(() =>
			createPiResource({ cwd, scope: "project", kind: "skills", name: "review" }),
		).toThrow("Skill already exists");
	});
});
