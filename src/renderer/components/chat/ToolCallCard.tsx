import {
	FilePen,
	FilePlus,
	FileText,
	Folder,
	FolderSearch,
	Search,
	Terminal,
	Wrench,
} from "lucide-react";
import { useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
	type ToolState,
} from "@/components/ai-elements/tool";
import { DiffViewer } from "@/components/chat/DiffViewer";
import { cn } from "@/lib/utils";
import type { ToolExecutionState } from "@/stores/session-state";

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
	execution?: ToolExecutionState;
}

export function ToolCallCard({ call, result, execution }: Props) {
	const [open, setOpen] = useState(() => !result);
	const Icon = iconFor(call.name);
	const summary = summarizeArgs(call.name, call.arguments);
	const liveResult = result ?? executionToResult(execution);
	const resultText = liveResult ? extractText(liveResult.content) : null;
	const errored = !!liveResult?.isError || execution?.status === "error";
	const running = !result && (execution?.status === "running" || execution?.status === "pending");
	const diffPatch = pickDiffPatch(call, result);
	const state: ToolState = errored
		? "output-error"
		: result || liveResult || execution?.status === "done"
			? "output-available"
			: running
				? "input-available"
				: "input-streaming";

	return (
		<Tool
			open={open}
			onOpenChange={setOpen}
			className={cn(errored ? "border-destructive/30" : running ? "border-primary/30" : undefined)}
		>
			<ToolHeader toolType={`tool-${call.name}`} state={state} title={call.name}>
				<Icon
					className={cn(
						"size-3.5 shrink-0",
						errored ? "text-destructive" : running ? "text-primary" : "text-muted-foreground",
					)}
				/>
				{summary ? (
					<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
						{summary}
					</span>
				) : (
					<span className="flex-1" />
				)}
			</ToolHeader>
			<ToolContent>
				<ToolInput input={call.arguments} />
				{diffPatch ? (
					<div>
						<div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
							Diff
						</div>
						<DiffViewer patch={diffPatch} className="max-h-72" />
					</div>
				) : null}
				{liveResult ? (
					<ToolOutput
						errorText={liveResult.isError ? resultText || "Tool failed" : undefined}
						output={
							<MessageResponse className="text-[12px] leading-6">
								{resultText || "(no output)"}
							</MessageResponse>
						}
					/>
				) : null}
			</ToolContent>
		</Tool>
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

function executionToResult(execution?: ToolExecutionState): ToolResult | undefined {
	if (!execution) return undefined;
	const payload = execution.result ?? execution.partialResult;
	if (!payload?.content) return undefined;
	return {
		toolName: execution.toolName,
		content: payload.content,
		isError: execution.status === "error" || !!payload.isError,
		details: payload.details,
	};
}
