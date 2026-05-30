import {
	Check,
	ClipboardCopy,
	ExternalLink,
	File,
	FileCode,
	FileJson,
	FileText,
	Image,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface FileReadResult {
	content: string | null;
	size: number;
	reason?: "binary" | "too-large" | "not-found" | "read-error";
	reasonDetail?: string;
}

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

/** Image extensions we try to preview inline */
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif"]);

/**
 * Read file content via preload IPC bridge.
 * `window.pi.fileTree.read` is exposed in preload/index.ts.
 */
async function readFileByPath(filePath: string): Promise<FileReadResult> {
	const ext = (filePath.split(".").pop() ?? "").toLowerCase();
	if (BINARY_EXTS.has(ext) && !IMAGE_EXTS.has(ext)) {
		return { content: null, size: 0, reason: "binary", reasonDetail: `Binary file (.${ext})` };
	}

	const bridge = window.pi?.fileTree?.read;
	if (typeof bridge !== "function") {
		return {
			content: null,
			size: 0,
			reason: "read-error",
			reasonDetail: "File reader bridge not available. Please restart the app.",
		};
	}

	return bridge(filePath);
}

interface Props {
	filePath: string;
	onClose: () => void;
}

/** Map file extensions to markdown code fence language identifiers */
function extToLang(ext: string): string {
	const map: Record<string, string> = {
		ts: "typescript",
		mts: "typescript",
		cts: "typescript",
		tsx: "tsx",
		js: "javascript",
		mjs: "javascript",
		cjs: "javascript",
		jsx: "jsx",
		json: "json",
		jsonc: "json",
		css: "css",
		scss: "scss",
		less: "less",
		html: "html",
		htm: "html",
		xml: "xml",
		svg: "xml",
		yaml: "yaml",
		yml: "yaml",
		toml: "toml",
		sql: "sql",
		sh: "bash",
		bash: "bash",
		zsh: "bash",
		fish: "bash",
		py: "python",
		rb: "ruby",
		go: "go",
		rs: "rust",
		java: "java",
		c: "c",
		h: "c",
		cpp: "cpp",
		cc: "cpp",
		hpp: "cpp",
		cs: "csharp",
		swift: "swift",
		kt: "kotlin",
		kts: "kotlin",
		lua: "lua",
		r: "r",
		php: "php",
		vue: "vue",
		svelte: "svelte",
		astro: "astro",
		graphql: "graphql",
		gql: "graphql",
		prisma: "prisma",
		dockerfile: "dockerfile",
		makefile: "makefile",
		ini: "ini",
		tex: "latex",
		diff: "diff",
		patch: "diff",
		env: "dotenv",
		tf: "hcl",
		proto: "protobuf",
	};
	const lower = ext.toLowerCase();
	if (lower === "dockerfile") return "dockerfile";
	if (lower === "makefile" || lower === "gnumakefile") return "makefile";
	return map[lower] ?? "text";
}

/** Whether this is a markdown file that should render natively */
function isMarkdown(ext: string): boolean {
	return ["md", "mdx"].includes(ext.toLowerCase());
}

export function FilePreview({ filePath, onClose }: Props) {
	const [result, setResult] = useState<FileReadResult | null>(null);
	const [loading, setLoading] = useState(true);
	const [copied, setCopied] = useState(false);
	const abortRef = useRef<string | null>(null);

	const fileName = useMemo(() => filePath.split("/").pop() ?? filePath, [filePath]);
	const ext = useMemo(() => {
		const parts = fileName.split(".");
		return parts.length > 1 ? (parts.pop() ?? "") : "";
	}, [fileName]);
	const lang = useMemo(() => extToLang(ext || fileName), [ext, fileName]);

	const load = useCallback(async () => {
		setLoading(true);
		setResult(null);
		abortRef.current = filePath;

		// Images: just mark as loaded (content not needed for image preview)
		if (IMAGE_EXTS.has(ext.toLowerCase())) {
			setResult({ content: null, size: 0, reason: undefined });
			setLoading(false);
			return;
		}

		try {
			const res = await readFileByPath(filePath);
			if (abortRef.current !== filePath) return;
			setResult(res);
		} catch (e) {
			if (abortRef.current === filePath) {
				setResult({
					content: null,
					size: 0,
					reason: "read-error",
					reasonDetail: e instanceof Error ? e.message : String(e),
				});
			}
		} finally {
			setLoading(false);
		}
	}, [filePath, ext]);

	useEffect(() => {
		void load();
		return () => {
			abortRef.current = null;
		};
	}, [load]);

	async function handleCopy() {
		if (!result?.content) return;
		await navigator.clipboard.writeText(result.content);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	async function handleOpenExternal() {
		await window.pi?.shell?.openPath(filePath);
	}

	// Build the markdown string for streamdown
	const markdownContent = useMemo(() => {
		if (!result?.content) return null;
		if (isMarkdown(ext)) {
			// Render markdown natively
			return result.content;
		}
		// Wrap code in a fenced code block
		return `\`\`\`${lang}\n${result.content}\n\`\`\``;
	}, [result?.content, ext, lang]);

	const lineCount = result?.content ? result.content.split("\n").length : 0;
	const sizeDisplay = result ? formatSize(result.size) : "";
	const FileIcon = iconForExt(ext);
	const isImage = IMAGE_EXTS.has(ext.toLowerCase());

	return (
		<div className="flex h-full min-w-0 flex-col">
			{/* Header bar */}
			<div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-3 py-2">
				<FileIcon className={cn("size-3.5 shrink-0", langColor(ext))} />
				<div className="min-w-0 flex-1">
					<div className="truncate text-[12px] font-medium text-foreground">{fileName}</div>
					<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
						<span>{isImage ? ext : lang}</span>
						{sizeDisplay ? (
							<>
								<span className="text-muted-foreground/40">·</span>
								<span>{sizeDisplay}</span>
							</>
						) : null}
						{lineCount > 0 && !isImage ? (
							<>
								<span className="text-muted-foreground/40">·</span>
								<span>
									{lineCount} {lineCount === 1 ? "line" : "lines"}
								</span>
							</>
						) : null}
					</div>
				</div>
				<div className="flex items-center gap-0.5">
					{result?.content ? (
						<Button
							size="icon-sm"
							variant="ghost"
							onClick={handleCopy}
							aria-label="Copy"
							title="Copy content"
							className="size-7"
						>
							{copied ? (
								<Check className="size-3 text-emerald-500" />
							) : (
								<ClipboardCopy className="size-3" />
							)}
						</Button>
					) : null}
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={handleOpenExternal}
						aria-label="Open externally"
						title="Open in default app"
						className="size-7"
					>
						<ExternalLink className="size-3" />
					</Button>
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={onClose}
						aria-label="Close preview"
						title="Close"
						className="size-7"
					>
						<X className="size-3" />
					</Button>
				</div>
			</div>

			{/* Content area */}
			<div className="min-h-0 flex-1 overflow-hidden">
				{loading ? (
					<LoadingState />
				) : isImage ? (
					<ImagePreview filePath={filePath} onFallback={handleOpenExternal} />
				) : !result?.content ? (
					<PlaceholderState result={result} onOpenExternal={handleOpenExternal} />
				) : markdownContent ? (
					<ScrollArea className="h-full">
						<div className="min-w-full px-4 py-4">
							<MessageResponse parseIncompleteMarkdown={false}>{markdownContent}</MessageResponse>
						</div>
						<ScrollBar orientation="horizontal" />
					</ScrollArea>
				) : null}
			</div>
		</div>
	);
}

/* ─── Image preview ─── */

function ImagePreview({ filePath, onFallback }: { filePath: string; onFallback: () => void }) {
	const [error, setError] = useState(false);
	const src = `file://${filePath}`;

	if (error) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
				<div className="flex size-12 items-center justify-center rounded-[16px] bg-foreground/[0.04]">
					<Image className="size-5 text-muted-foreground/40" />
				</div>
				<div>
					<div className="text-[13px] font-medium text-foreground">Cannot preview image</div>
					<div className="mt-1 text-[12px] text-muted-foreground">
						Open with default application
					</div>
				</div>
				<Button size="sm" variant="secondary" onClick={onFallback} className="rounded-full">
					<ExternalLink className="size-3.5" />
					Open externally
				</Button>
			</div>
		);
	}

	return (
		<ScrollArea className="h-full">
			<div className="flex items-center justify-center p-6">
				<img
					src={src}
					alt={filePath.split("/").pop()}
					className="max-h-full max-w-full rounded-[12px] object-contain shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
					onError={() => setError(true)}
				/>
			</div>
		</ScrollArea>
	);
}

/* ─── Loading state ─── */

function LoadingState() {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="flex items-center gap-2 text-[12px] text-muted-foreground">
				<div className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary/60" />
				Loading…
			</div>
		</div>
	);
}

/* ─── Placeholder for binary / too-large / error ─── */

function PlaceholderState({
	result,
	onOpenExternal,
}: {
	result: FileReadResult | null;
	onOpenExternal: () => void;
}) {
	const reason = result?.reason;
	const detail = result?.reasonDetail;

	const title =
		reason === "binary"
			? "Binary file"
			: reason === "too-large"
				? "File too large"
				: reason === "not-found"
					? "File not found"
					: "Cannot preview";

	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
			<div className="flex size-12 items-center justify-center rounded-[16px] bg-foreground/[0.04]">
				{reason === "binary" ? (
					<Image className="size-5 text-muted-foreground/40" />
				) : (
					<File className="size-5 text-muted-foreground/40" />
				)}
			</div>
			<div>
				<div className="text-[13px] font-medium text-foreground">{title}</div>
				{detail ? <div className="mt-1 text-[12px] text-muted-foreground">{detail}</div> : null}
			</div>
			<Button size="sm" variant="secondary" onClick={onOpenExternal} className="rounded-full">
				<ExternalLink className="size-3.5" />
				Open externally
			</Button>
		</div>
	);
}

/* ─── Helpers ─── */

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForExt(ext: string) {
	const lower = ext.toLowerCase();
	if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(lower))
		return Image;
	if (["json", "jsonc", "yaml", "yml", "toml", "ini"].includes(lower)) return FileJson;
	if (
		[
			"ts",
			"tsx",
			"js",
			"jsx",
			"py",
			"go",
			"rs",
			"rb",
			"java",
			"c",
			"cpp",
			"h",
			"swift",
			"kt",
			"vue",
			"svelte",
		].includes(lower)
	)
		return FileCode;
	if (["md", "mdx", "txt", "log", "csv"].includes(lower)) return FileText;
	return File;
}

function langColor(ext: string): string {
	const colors: Record<string, string> = {
		ts: "text-blue-500",
		tsx: "text-blue-500",
		mts: "text-blue-500",
		cts: "text-blue-500",
		js: "text-yellow-500",
		jsx: "text-yellow-500",
		mjs: "text-yellow-500",
		py: "text-emerald-500",
		go: "text-cyan-500",
		rs: "text-orange-500",
		rb: "text-red-500",
		java: "text-red-600",
		css: "text-purple-500",
		scss: "text-pink-500",
		html: "text-orange-500",
		json: "text-amber-500",
		md: "text-sky-500",
		svg: "text-yellow-600",
		vue: "text-green-500",
		svelte: "text-orange-400",
		swift: "text-orange-500",
		kt: "text-purple-600",
	};
	return colors[ext.toLowerCase()] ?? "text-muted-foreground";
}
