import { useState } from "react";
import {
	ChevronRight,
	FileText,
	FilePen,
	FilePlus,
	Folder,
	FolderSearch,
	Search,
	Terminal,
	Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DiffViewer } from "@/components/chat/DiffViewer";

interface ToolCallPart {
	type: "toolCall";
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

interface ToolResult {
	toolName: string;
	content: unknown[];
	isError: boolean;
	details?: unknown;
}

interface Props {
	call: ToolCallPart;
	result?: ToolResult;
}

export function ToolCallCard({ call, result }: Props) {
	const [open, setOpen] = useState(false);
	const Icon = iconFor(call.name);
	const summary = summarizeArgs(call.name, call.arguments);
	const resultText = result ? extractText(result.content) : null;
	const errored = !!result?.isError;
	const running = !result;
	const diffPatch = pickDiffPatch(call, result);

	return (
		<div
			className={cn(
				"overflow-hidden rounded-xl border bg-card/40 text-[12px] backdrop-blur",
				errored
					? "border-destructive/40"
					: running
						? "border-primary/30"
						: "border-border/40",
			)}
		>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03]"
			>
				<ChevronRight
					className={cn(
						"size-3 shrink-0 transition-transform",
						open && "rotate-90",
					)}
				/>
				<Icon
					className={cn(
						"size-3.5 shrink-0",
						errored
							? "text-destructive"
							: running
								? "text-primary"
								: "text-muted-foreground/80",
					)}
				/>
				<span className="font-medium text-foreground/90">{call.name}</span>
				{summary ? (
					<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground/70">
						{summary}
					</span>
				) : (
					<span className="flex-1" />
				)}
				<span
					className={cn(
						"shrink-0 text-[10px] tracking-wider",
						errored
							? "text-destructive"
							: running
								? "text-primary"
								: "text-muted-foreground/60",
					)}
				>
					{errored ? "ERROR" : running ? "RUNNING" : "DONE"}
				</span>
			</button>
			{open ? (
				<div className="space-y-2 border-t border-border/30 bg-background/30 px-3 py-2.5">
					<div>
						<div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
							Input
						</div>
						<pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-foreground/85">
							{prettyArgs(call.arguments)}
						</pre>
					</div>
					{diffPatch ? (
						<div>
							<div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
								Diff
							</div>
							<DiffViewer patch={diffPatch} className="max-h-72" />
						</div>
					) : null}
					{result ? (
						<div>
							<div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
								{errored ? "Error" : "Output"}
							</div>
							<pre
								className={cn(
									"max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[11px]",
									errored ? "text-destructive" : "text-foreground/85",
								)}
							>
								{resultText || "(no output)"}
							</pre>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function iconFor(name: string) {
	const n = name.toLowerCase();
	if (n.includes("bash") || n.includes("shell") || n.includes("exec")) return Terminal;
	if (n.includes("read") || n.includes("view") || n.includes("cat")) return FileText;
	if (n.includes("edit") || n.includes("patch") || n.includes("apply")) return FilePen;
	if (n.includes("write") || n.includes("create")) return FilePlus;
	if (n.includes("grep") || n.includes("search")) return Search;
	if (n.includes("find") || n.includes("ls") || n.includes("list")) {
		return n.includes("find") ? FolderSearch : Folder;
	}
	return Wrench;
}

function summarizeArgs(toolName: string, args: Record<string, unknown>): string {
	if (!args || typeof args !== "object") return "";
	const n = toolName.toLowerCase();
	// Common conventions
	if ("command" in args) return String(args.command).split("\n")[0];
	if ("path" in args) {
		const p = String(args.path);
		if ("pattern" in args) return `${p}  ‹${args.pattern}›`;
		return p;
	}
	if ("file" in args) return String(args.file);
	if ("pattern" in args) return String(args.pattern);
	if ("query" in args) return String(args.query);
	if (n.includes("grep") || n.includes("find")) {
		const v = Object.values(args)[0];
		return v == null ? "" : String(v);
	}
	const first = Object.entries(args).find(
		([, v]) => typeof v === "string" || typeof v === "number",
	);
	return first ? `${first[0]}=${first[1]}` : "";
}

function prettyArgs(args: Record<string, unknown>): string {
	try {
		return JSON.stringify(args, null, 2);
	} catch {
		return String(args);
	}
}

function extractText(content: unknown[]): string {
	return (content as Array<{ type: string; text?: string }>)
		.filter((p) => p?.type === "text")
		.map((p) => p.text ?? "")
		.join("\n");
}

function pickDiffPatch(call: ToolCallPart, result?: ToolResult): string | null {
	const details = result?.details as { patch?: string; diff?: string } | undefined;
	if (details?.patch) return details.patch;
	if (details?.diff) return details.diff;
	const n = call.name.toLowerCase();
	if (n.includes("write") && typeof call.arguments.content === "string") {
		const path = String(call.arguments.path ?? "(new file)");
		const lines = String(call.arguments.content).split("\n");
		return [
			`--- /dev/null`,
			`+++ ${path}`,
			`@@ +1,${lines.length} @@`,
			...lines.map((l) => `+${l}`),
		].join("\n");
	}
	return null;
}
