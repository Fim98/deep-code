import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export interface FileTreeNode {
	name: string;
	path: string;
	type: "file" | "directory";
	/** File size in bytes (files only). */
	size?: number;
}

// Common directories / files to always skip for performance
const SKIP_DIRS = new Set([
	"node_modules",
	".git",
	".hg",
	".svn",
	"__pycache__",
	".DS_Store",
	"dist",
	"build",
	".next",
	".nuxt",
	"coverage",
	".cache",
	".turbo",
	".vercel",
	".output",
]);

const MAX_ENTRIES = 2000;

/**
 * List the immediate children of a directory.
 * Returns a flat array of FileTreeNode objects (not recursive).
 * The renderer calls this on-demand when a directory is expanded.
 */
export async function listDirectory(dirPath: string): Promise<FileTreeNode[]> {
	const entries = await readdir(dirPath, { withFileTypes: true });

	const nodes: FileTreeNode[] = [];
	const dirs: FileTreeNode[] = [];

	for (const entry of entries) {
		if (SKIP_DIRS.has(entry.name)) continue;
		if (entry.name.startsWith(".") && entry.name !== ".env") continue;

		const fullPath = join(dirPath, entry.name);
		const node: FileTreeNode = {
			name: entry.name,
			path: fullPath,
			type: entry.isDirectory() ? "directory" : "file",
		};

		if (entry.isDirectory()) {
			dirs.push(node);
		} else {
			nodes.push(node);
		}

		if (dirs.length + nodes.length >= MAX_ENTRIES) break;
	}

	// Directories first, then files, both sorted alphabetically
	dirs.sort((a, b) => a.name.localeCompare(b.name));
	nodes.sort((a, b) => a.name.localeCompare(b.name));

	return [...dirs, ...nodes];
}

/**
 * Get file size for a single path.
 */
export async function getFileSize(filePath: string): Promise<number> {
	try {
		const s = await stat(filePath);
		return s.size;
	} catch {
		return 0;
	}
}
