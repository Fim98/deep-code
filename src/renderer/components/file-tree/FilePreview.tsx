import {
	Check,
	ClipboardCopy,
	ExternalLink,
	File,
	FileCode,
	FileJson,
	FileText,
	Image,
	Music,
	Video,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CodePreview } from "./CodePreview";
import { CsvPreview } from "./CsvPreview";
import {
	shouldRenderSvgInline,
	shouldUseCsvTable,
	shouldUseImagePreview,
	shouldUseMarkdown,
	shouldUseMediaPlayer,
} from "./lang-map";
import { MediaPreview } from "./MediaPreview";
import { SvgPreview } from "./SvgPreview";

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
	"m4a",
	"mov",
	"avi",
	"mkv",
	"webm",
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

/** Media extensions handled by native player */
const MEDIA_EXTS = new Set([
	"mp3",
	"wav",
	"ogg",
	"flac",
	"m4a",
	"aac",
	"mp4",
	"mov",
	"webm",
	"avi",
	"mkv",
	"m4v",
]);

/**
 * Read file content via preload IPC bridge.
 * `window.pi.fileTree.read` is exposed in preload/index.ts.
 */
async function readFileByPath(filePath: string): Promise<FileReadResult> {
	const ext = (filePath.split(".").pop() ?? "").toLowerCase();
	// Allow reading SVG, CSV/TSV, and media through the bridge too
	const textAllowed = IMAGE_EXTS.has(ext) ? false : !BINARY_EXTS.has(ext);

	if (!textAllowed && !MEDIA_EXTS.has(ext)) {
		return { content: null, size: 0, reason: "binary", reasonDetail: `Binary file (.${ext})` };
	}

	// Media files: no text content needed, just show player
	if (MEDIA_EXTS.has(ext)) {
		return { content: null, size: 0, reason: undefined };
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
	onBack?: () => void;
}

/** Map file extensions to a display language label */
function extToLangLabel(ext: string, fileName: string): string {
	const lower = ext.toLowerCase();
	const lowerName = fileName.toLowerCase();
	if (lowerName === "dockerfile") return "Dockerfile";
	if (lowerName === "makefile" || lowerName === "gnumakefile") return "Makefile";

	const map: Record<string, string> = {
		ts: "TypeScript",
		tsx: "TSX",
		mts: "TypeScript",
		cts: "TypeScript",
		js: "JavaScript",
		jsx: "JSX",
		mjs: "JavaScript",
		json: "JSON",
		jsonc: "JSON",
		css: "CSS",
		scss: "SCSS",
		html: "HTML",
		xml: "XML",
		svg: "SVG",
		yaml: "YAML",
		yml: "YAML",
		toml: "TOML",
		sql: "SQL",
		sh: "Shell",
		py: "Python",
		rb: "Ruby",
		go: "Go",
		rs: "Rust",
		java: "Java",
		c: "C",
		cpp: "C++",
		cs: "C#",
		swift: "Swift",
		kt: "Kotlin",
		lua: "Lua",
		php: "PHP",
		vue: "Vue",
		md: "Markdown",
		csv: "CSV",
		tsv: "TSV",
		diff: "Diff",
		patch: "Patch",
	};
	return map[lower] ?? lower.toUpperCase();
}

export function FilePreview({ filePath, onClose, onBack }: Props) {
	const [result, setResult] = useState<FileReadResult | null>(null);
	const [loading, setLoading] = useState(true);
	const [copied, setCopied] = useState(false);
	const abortRef = useRef<string | null>(null);

	const fileName = useMemo(() => filePath.split("/").pop() ?? filePath, [filePath]);
	const ext = useMemo(() => {
		const parts = fileName.split(".");
		return parts.length > 1 ? (parts.pop() ?? "") : "";
	}, [fileName]);
	const langLabel = useMemo(() => extToLangLabel(ext || fileName, fileName), [ext, fileName]);

	// Determine preview mode
	const previewMode = useMemo(() => {
		const lower = ext.toLowerCase();
		if (shouldUseMediaPlayer(lower)) return "media" as const;
		if (shouldUseImagePreview(lower)) return "image" as const;
		if (shouldRenderSvgInline(lower)) return "svg" as const;
		if (shouldUseMarkdown(lower)) return "markdown" as const;
		if (shouldUseCsvTable(lower)) return "csv" as const;
		// All other text files → CodeMirror
		return "code" as const;
	}, [ext]);

	const load = useCallback(async () => {
		setLoading(true);
		setResult(null);
		abortRef.current = filePath;

		// Images & media: content not needed
		if (IMAGE_EXTS.has(ext.toLowerCase()) || MEDIA_EXTS.has(ext.toLowerCase())) {
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

	const lineCount = result?.content ? result.content.split("\n").length : 0;
	const sizeDisplay = result ? formatSize(result.size) : "";
	const FileIcon = iconForExt(ext);
	const isImage = shouldUseImagePreview(ext.toLowerCase());
	const isMedia = shouldUseMediaPlayer(ext.toLowerCase());

	return (
		<div className="flex h-full min-w-0 flex-col">
			{/* Header bar */}
			<div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-3 py-2">
				{onBack ? (
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={onBack}
						aria-label="Back to file tree"
						title="Back to files"
						className="size-7"
					>
						<Check className="hidden" /> {/* just standard import checks */}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="size-3.5"
							role="img"
							aria-label="Back to file tree"
						>
							<path d="m15 18-6-6 6-6" />
						</svg>
					</Button>
				) : null}
				<FileIcon className={cn("size-3.5 shrink-0", langColor(ext))} />
				<div className="min-w-0 flex-1">
					<div className="truncate text-[12px] font-medium text-foreground">{fileName}</div>
					<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
						<span>{langLabel}</span>
						{sizeDisplay ? (
							<>
								<span className="text-muted-foreground/40">·</span>
								<span>{sizeDisplay}</span>
							</>
						) : null}
						{lineCount > 0 && !isImage && !isMedia ? (
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

			{/* Content area — routed by preview mode */}
			<div className="min-h-0 flex-1 overflow-hidden">
				{loading ? (
					<LoadingState />
				) : previewMode === "image" ? (
					<ImagePreview filePath={filePath} onFallback={handleOpenExternal} />
				) : previewMode === "media" ? (
					<MediaPreview filePath={filePath} ext={ext} onOpenExternal={handleOpenExternal} />
				) : !result?.content ? (
					<PlaceholderState result={result} onOpenExternal={handleOpenExternal} />
				) : previewMode === "svg" ? (
					<SvgPreview
						content={result.content}
						filePath={filePath}
						onOpenExternal={handleOpenExternal}
						className="h-full"
					/>
				) : previewMode === "markdown" ? (
					<ScrollArea className="h-full">
						<div className="min-w-full px-4 py-4">
							<MessageResponse parseIncompleteMarkdown={false}>{result.content}</MessageResponse>
						</div>
						<ScrollBar orientation="horizontal" />
					</ScrollArea>
				) : previewMode === "csv" ? (
					<CsvPreview content={result.content} ext={ext} className="h-full" />
				) : previewMode === "code" ? (
					<CodePreview content={result.content} ext={ext} fileName={fileName} className="h-full" />
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
	if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif"].includes(lower)) return Image;
	if (lower === "svg") return Image;
	if (["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(lower)) return Music;
	if (["mp4", "mov", "webm", "avi", "mkv", "m4v"].includes(lower)) return Video;
	if (["json", "jsonc", "yaml", "yml", "toml", "ini"].includes(lower)) return FileJson;
	if (["csv", "tsv"].includes(lower)) return FileText;
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
	if (["md", "mdx", "txt", "log"].includes(lower)) return FileText;
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
		csv: "text-teal-500",
		tsv: "text-teal-500",
	};
	return colors[ext.toLowerCase()] ?? "text-muted-foreground";
}
