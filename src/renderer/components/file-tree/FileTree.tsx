import {
	ChevronRight,
	File,
	FileCode,
	FileJson,
	FileText,
	Folder,
	FolderOpen,
	PanelRightClose,
	PanelRightOpen,
	RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type FileTreeNode as FileTreeNodeData, pi } from "@/lib/rpc";
import { cn } from "@/lib/utils";

interface FileTreeProps {
	rootPath: string;
	onFileClick?: (path: string) => void;
}

interface DirState {
	children: FileTreeNodeData[];
	expanded: boolean;
	loading: boolean;
	loaded: boolean;
}

function fileIcon(name: string) {
	const ext = name.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "ts":
		case "tsx":
		case "js":
		case "jsx":
		case "py":
		case "go":
		case "rs":
		case "rb":
		case "java":
		case "c":
		case "cpp":
		case "h":
		case "swift":
		case "kt":
			return <FileCode className="size-3.5 text-blue-500/70" />;
		case "json":
		case "yaml":
		case "yml":
		case "toml":
			return <FileJson className="size-3.5 text-amber-500/70" />;
		case "md":
		case "txt":
		case "log":
			return <FileText className="size-3.5 text-muted-foreground" />;
		default:
			return <File className="size-3.5 text-muted-foreground/60" />;
	}
}

function TreeNode({
	node,
	level,
	onFileClick,
	dirStates,
	toggleDir,
}: {
	node: FileTreeNodeData;
	level: number;
	onFileClick?: (path: string) => void;
	dirStates: Record<string, DirState>;
	toggleDir: (path: string) => void;
}) {
	const isDir = node.type === "directory";
	const dirState = isDir ? dirStates[node.path] : undefined;
	const expanded = dirState?.expanded ?? false;
	const loading = dirState?.loading ?? false;

	const handleClick = () => {
		if (isDir) {
			toggleDir(node.path);
		} else {
			onFileClick?.(node.path);
		}
	};

	return (
		<div>
			<button
				type="button"
				onClick={handleClick}
				className={cn(
					"group flex w-full cursor-pointer items-center gap-1 rounded-[8px] px-1.5 py-1 text-left transition-colors duration-100",
					"hover:bg-foreground/[0.04]",
				)}
				style={{ paddingLeft: `${level * 12 + 4}px` }}
			>
				{isDir ? (
					<ChevronRight
						className={cn(
							"size-3 shrink-0 text-muted-foreground/50 transition-transform duration-150",
							expanded && "rotate-90",
						)}
					/>
				) : (
					<span className="w-3 shrink-0" />
				)}
				{isDir ? (
					expanded ? (
						<FolderOpen className="size-3.5 shrink-0 text-blue-500/70" />
					) : (
						<Folder className="size-3.5 shrink-0 text-blue-500/70" />
					)
				) : (
					fileIcon(node.name)
				)}
				<span className="truncate text-[12px] text-foreground/80">{node.name}</span>
			</button>
			{isDir && expanded ? (
				<div>
					{loading ? (
						<div
							className="truncate px-1.5 py-0.5 text-[11px] text-muted-foreground/50"
							style={{ paddingLeft: `${(level + 1) * 12 + 4}px` }}
						>
							Loading…
						</div>
					) : dirState?.children.length === 0 ? (
						<div
							className="truncate px-1.5 py-0.5 text-[11px] text-muted-foreground/40 italic"
							style={{ paddingLeft: `${(level + 1) * 12 + 4}px` }}
						>
							Empty
						</div>
					) : (
						dirState?.children.map((child) => (
							<TreeNode
								key={child.path}
								node={child}
								level={level + 1}
								onFileClick={onFileClick}
								dirStates={dirStates}
								toggleDir={toggleDir}
							/>
						))
					)}
				</div>
			) : null}
		</div>
	);
}

export function FileTree({ rootPath, onFileClick }: FileTreeProps) {
	const [rootChildren, setRootChildren] = useState<FileTreeNodeData[]>([]);
	const [loading, setLoading] = useState(true);
	const [dirStates, setDirStates] = useState<Record<string, DirState>>({});
	const [open, setOpen] = useState(false);

	const loadDir = useCallback(async (path: string): Promise<FileTreeNodeData[]> => {
		try {
			return await pi.fileTree.list(path);
		} catch {
			return [];
		}
	}, []);

	const loadRoot = useCallback(async () => {
		setLoading(true);
		const children = await loadDir(rootPath);
		setRootChildren(children);
		setLoading(false);
	}, [rootPath, loadDir]);

	useEffect(() => {
		if (open) void loadRoot();
	}, [open, loadRoot]);

	const toggleDir = useCallback(
		async (path: string) => {
			const current = dirStates[path];

			if (current?.expanded) {
				// Collapse
				setDirStates((prev) => ({
					...prev,
					[path]: { ...prev[path], expanded: false },
				}));
				return;
			}

			if (current?.loaded) {
				// Already loaded, just expand
				setDirStates((prev) => ({
					...prev,
					[path]: { ...prev[path], expanded: true },
				}));
				return;
			}

			// Load and expand
			setDirStates((prev) => ({
				...prev,
				[path]: { children: [], expanded: true, loading: true, loaded: false },
			}));

			const children = await loadDir(path);

			setDirStates((prev) => ({
				...prev,
				[path]: { children, expanded: true, loading: false, loaded: true },
			}));
		},
		[dirStates, loadDir],
	);

	if (!open) {
		return (
			<Button
				size="icon"
				variant="ghost"
				onClick={() => setOpen(true)}
				aria-label="Toggle file tree"
				title="File tree"
			>
				<PanelRightOpen className="size-4" />
			</Button>
		);
	}

	return (
		<div className="flex h-full w-[240px] shrink-0 flex-col border-l border-border/30 bg-card/50">
			{/* Header */}
			<div className="flex shrink-0 items-center justify-between border-b border-border/30 px-3 py-2">
				<span className="select-none text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					Files
				</span>
				<div className="flex items-center gap-0.5">
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={() => {
							setDirStates({});
							void loadRoot();
						}}
						aria-label="Refresh"
						className="size-6 rounded-[8px]"
					>
						<RefreshCw className={cn("size-3", loading && "animate-spin")} />
					</Button>
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={() => setOpen(false)}
						aria-label="Close file tree"
						className="size-6 rounded-[8px]"
					>
						<PanelRightClose className="size-3" />
					</Button>
				</div>
			</div>
			{/* Tree */}
			<ScrollArea className="flex-1 px-1 py-1">
				{loading ? (
					<div className="px-3 py-4 text-center text-[11px] text-muted-foreground">Loading…</div>
				) : rootChildren.length === 0 ? (
					<div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
						No files found
					</div>
				) : (
					rootChildren.map((node) => (
						<TreeNode
							key={node.path}
							node={node}
							level={0}
							onFileClick={onFileClick}
							dirStates={dirStates}
							toggleDir={toggleDir}
						/>
					))
				)}
			</ScrollArea>
		</div>
	);
}
