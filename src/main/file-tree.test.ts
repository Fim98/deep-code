import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listDirectory } from "./file-tree";

describe("file-tree", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "antcode-filetree-"));
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("returns empty array for empty directory", async () => {
		const result = await listDirectory(testDir);
		expect(result).toEqual([]);
	});

	it("lists files and directories", async () => {
		await mkdir(join(testDir, "src"));
		await writeFile(join(testDir, "README.md"), "# Hello");
		await writeFile(join(testDir, "package.json"), "{}");

		const result = await listDirectory(testDir);

		expect(result).toHaveLength(3);
		// Directories first
		expect(result[0].name).toBe("src");
		expect(result[0].type).toBe("directory");
		// Then files alphabetically
		expect(result[1].name).toBe("package.json");
		expect(result[1].type).toBe("file");
		expect(result[2].name).toBe("README.md");
		expect(result[2].type).toBe("file");
	});

	it("skips node_modules and .git", async () => {
		await mkdir(join(testDir, "node_modules"));
		await mkdir(join(testDir, ".git"));
		await mkdir(join(testDir, "src"));
		await writeFile(join(testDir, "index.ts"), "");

		const result = await listDirectory(testDir);
		const names = result.map((n) => n.name);
		expect(names).not.toContain("node_modules");
		expect(names).not.toContain(".git");
		expect(names).toContain("src");
		expect(names).toContain("index.ts");
	});

	it("skips hidden files except .env", async () => {
		await writeFile(join(testDir, ".env"), "SECRET=1");
		await writeFile(join(testDir, ".hidden"), "hidden");
		await writeFile(join(testDir, "visible.ts"), "");

		const result = await listDirectory(testDir);
		const names = result.map((n) => n.name);
		expect(names).toContain(".env");
		expect(names).not.toContain(".hidden");
		expect(names).toContain("visible.ts");
	});

	it("returns absolute paths", async () => {
		await writeFile(join(testDir, "test.txt"), "hello");
		const result = await listDirectory(testDir);
		expect(result[0].path).toBe(join(testDir, "test.txt"));
	});

	it("sorts directories before files", async () => {
		await mkdir(join(testDir, "aaa-dir"));
		await writeFile(join(testDir, "bbb.txt"), "");
		await mkdir(join(testDir, "ccc-dir"));
		await writeFile(join(testDir, "ddd.ts"), "");

		const result = await listDirectory(testDir);
		const types = result.map((r) => r.type);
		// All directories come first
		const firstFile = types.indexOf("file");
		const lastDir = types.lastIndexOf("directory");
		if (lastDir !== -1 && firstFile !== -1) {
			expect(lastDir).toBeLessThan(firstFile);
		}
	});
});
