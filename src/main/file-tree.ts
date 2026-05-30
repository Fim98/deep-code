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

/** Max file size for inline preview (1 MB) */
const MAX_PREVIEW_BYTES = 1 * 1024 * 1024;

/** Binary file extensions that cannot be previewed as text */
const BINARY_EXTS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"bmp",
	"ico",
	"tiff",
	"tif",
	"avif",
	"mp3",
	"mp4",
	"wav",
	"ogg",
	"flac",
	"mov",
	"avi",
	"mkv",
	"pdf",
	"doc",
	"docx",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
	"zip",
	"tar",
	"gz",
	"bz2",
	"7z",
	"rar",
	"xz",
	"woff",
	"woff2",
	"ttf",
	"otf",
	"eot",
	"exe",
	"dll",
	"so",
	"dylib",
	"bin",
	"sqlite",
	"db",
	"wasm",
]);

export interface FileReadResult {
	/** File content (UTF-8) or null if binary/too large */
	content: string | null;
	/** Size in bytes */
	size: number;
	/** MIME-like reason when content is null */
	reason?: "binary" | "too-large" | "not-found" | "read-error";
	/** Human-readable reason */
	reasonDetail?: string;
}

/**
 * Read file content for inline preview.
 * Returns null content for binary or oversized files.
 */
export async function readFileContent(filePath: string): Promise<FileReadResult> {
	try {
		const s = await stat(filePath);
		if (!s.isFile()) {
			return { content: null, size: 0, reason: "read-error", reasonDetail: "Not a file" };
		}
		if (s.size > MAX_PREVIEW_BYTES) {
			return {
				content: null,
				size: s.size,
				reason: "too-large",
				reasonDetail: `File is ${(s.size / 1024 / 1024).toFixed(1)} MB (max 1 MB)`,
			};
		}
		const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
		if (BINARY_EXTS.has(ext)) {
			return {
				content: null,
				size: s.size,
				reason: "binary",
				reasonDetail: `Binary file (.${ext})`,
			};
		}
		const { readFile } = await import("node:fs/promises");
		const buf = await readFile(filePath);
		// Check for null bytes (heuristic for binary)
		for (let i = 0; i < Math.min(buf.length, 8192); i++) {
			if (buf[i] === 0) {
				return {
					content: null,
					size: s.size,
					reason: "binary",
					reasonDetail: "Contains binary data",
				};
			}
		}
		return { content: buf.toString("utf-8"), size: s.size };
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === "ENOENT") {
			return { content: null, size: 0, reason: "not-found", reasonDetail: "File not found" };
		}
		return { content: null, size: 0, reason: "read-error", reasonDetail: (e as Error).message };
	}
}
