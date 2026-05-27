import { useEffect, useMemo, useState } from "react";
import {
	ChevronRight,
	FilePen,
	FileText,
	Search,
	Sparkles,
	Terminal,
	Wrench,
} from "lucide-react";
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
	useSessions,
	type ChatMessage,
	type ToolExecutionState,
} from "@/stores/session-state";
import { cn } from "@/lib/utils";

interface Props {
	sessionId: string;
}

interface ToolCallPart {
	type: "toolCall";
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

interface ToolResultInfo {
	toolName: string;
	content: unknown[];
	isError: boolean;
	details?: unknown;
	timestamp?: number;
}

type Part =
	| { type: "text"; text: string }
	| { type: "thinking"; thinking: string; redacted?: boolean }
	| ToolCallPart
	| { type: "image"; data: string; mimeType: string };

type ActivityKind = "thinking" | "command" | "edit" | "read" | "search" | "other";
type ActivityStatus = "pending" | "running" | "done" | "error";

interface ActivityItem {
	id: string;
	kind: ActivityKind;
	label: string;
	status: ActivityStatus;
	toolName?: string;
}

interface ActivityGroup {
	kind: ActivityKind;
	items: ActivityItem[];
	status: ActivityStatus;
}

export function MessageTimeline({ sessionId }: Props) {
	const slice = useSessions((s) => s.bySession[sessionId]);
	const messages = slice?.messages ?? [];
	const isStreaming = slice?.isStreaming ?? false;
	const activeTools = slice?.activeTools ?? {};

	const { toolResults, claimed } = useMemo(() => {
		const map = new Map<string, ToolResultInfo>();
		const claimedIds = new Set<string>();
		for (const m of messages) {
			if (m.role === "toolResult") {
				map.set(m.toolCallId, {
					toolName: m.toolName,
					content: m.content,
					isError: m.isError,
					details: m.details,
					timestamp: m.timestamp,
				});
				claimedIds.add(m.toolCallId);
			}
		}
		return { toolResults: map, claimed: claimedIds };
	}, [messages]);

	const lastAssistantIdx = useMemo(() => {
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === "assistant") return i;
		}
		return -1;
	}, [messages]);

	return (
		<Conversation>
			<ConversationContent>
				{messages.length === 0 ? (
					<ConversationEmptyState
						icon={<Sparkles className="size-7" />}
						title="Send a message to begin"
						description="Ask pi to read, edit, search, or run anything in this workspace."
					/>
				) : (
					messages.map((m, i) => (
						<Row
							key={i}
							m={m}
							toolResults={toolResults}
							activeTools={activeTools}
							claimed={claimed}
							isStreamingLast={isStreaming && i === lastAssistantIdx}
						/>
					))
				)}
			</ConversationContent>
			<ConversationScrollButton />
		</Conversation>
	);
}

function Row({
	m,
	toolResults,
	activeTools,
	claimed,
	isStreamingLast,
}: {
	m: ChatMessage;
	toolResults: Map<string, ToolResultInfo>;
	activeTools: Record<string, ToolExecutionState>;
	claimed: Set<string>;
	isStreamingLast: boolean;
}) {
	if (m.role === "user") return <UserRow content={m.content} />;
	if (m.role === "assistant") {
		return (
			<AssistantRow
				message={m}
				toolResults={toolResults}
				activeTools={activeTools}
				isStreaming={isStreamingLast}
			/>
		);
	}
	if (m.role === "toolResult") {
		if (claimed.has(m.toolCallId)) return null;
		return (
			<OrphanToolResult
				toolName={m.toolName}
				content={m.content}
				isError={m.isError}
			/>
		);
	}
	if (m.role === "custom") return <CustomRow data={m} />;
	return null;
}

function UserRow({ content }: { content: string | unknown[] }) {
	const text =
		typeof content === "string"
			? content
			: (content as Part[])
					.filter((p): p is Part & { type: "text" } => p?.type === "text")
					.map((p) => p.text)
					.join("\n");
	const images =
		typeof content === "string"
			? []
			: (content as Part[]).filter(
					(p): p is Part & { type: "image" } => p?.type === "image",
				);
	return (
		<Message from="user">
			<MessageContent className="flex flex-col items-stretch gap-3">
				{images.map((img, i) => (
					<img
						key={i}
						alt=""
						src={`data:${img.mimeType};base64,${img.data}`}
						className="max-h-72 self-end rounded-[18px] border border-white/25 object-contain"
					/>
				))}
				{text ? <div className="whitespace-pre-wrap">{text}</div> : null}
			</MessageContent>
		</Message>
	);
}

function AssistantRow({
	message,
	toolResults,
	activeTools,
	isStreaming,
}: {
	message: Extract<ChatMessage, { role: "assistant" }>;
	toolResults: Map<string, ToolResultInfo>;
	activeTools: Record<string, ToolExecutionState>;
	isStreaming: boolean;
}) {
	const parts = (message.content ?? []) as Part[];
	const text = parts
		.filter((p): p is Part & { type: "text" } => p.type === "text" && !!p.text)
		.map((p) => p.text)
		.join("\n\n");
	const activities = buildActivities(parts, toolResults, activeTools, isStreaming);
	const hasFinalText = text.trim().length > 0;
	const hasContent = hasFinalText || activities.length > 0;
	if (!hasContent) return null;

	const endedAt = latestActivityTimestamp(activities, toolResults, message.timestamp);
	const elapsed = formatDuration(
		Math.max(0, (isStreaming ? Date.now() : endedAt) - message.timestamp),
	);

	return (
		<Message from="assistant">
			<MessageContent className="flex flex-col gap-5">
				<ActivityPanel
					activities={activities}
					elapsed={elapsed}
					isStreaming={isStreaming}
					hasFinalText={hasFinalText}
					stopReason={message.stopReason}
				/>
				{hasFinalText ? <MessageResponse>{text}</MessageResponse> : null}
				{message.model || message.stopReason ? (
					<div className="text-[11px] font-medium text-muted-foreground/55">
						{message.model ?? ""}
						{message.stopReason && message.stopReason !== "stop"
							? ` · ${message.stopReason}`
							: ""}
					</div>
				) : null}
			</MessageContent>
		</Message>
	);
}

function ActivityPanel({
	activities,
	elapsed,
	isStreaming,
	hasFinalText,
	stopReason,
}: {
	activities: ActivityItem[];
	elapsed: string;
	isStreaming: boolean;
	hasFinalText: boolean;
	stopReason?: string;
}) {
	const [manualOpen, setManualOpen] = useState<boolean | null>(null);
	const groups = useMemo(() => groupActivities(activities), [activities]);
	const hasError =
		stopReason === "error" || activities.some((item) => item.status === "error");
	const isAborted = stopReason === "aborted";
	const autoOpen = isStreaming || hasError || isAborted || !hasFinalText;
	const open = manualOpen ?? autoOpen;

	useEffect(() => {
		if (isStreaming) setManualOpen(null);
	}, [isStreaming]);

	if (activities.length === 0 && !isStreaming) return null;

	const label = isStreaming
		? `正在处理 ${elapsed}`
		: isAborted
			? `已中断 ${elapsed}`
			: hasError
				? `处理失败 ${elapsed}`
				: `已处理 ${elapsed}`;

	return (
		<div className="w-full text-muted-foreground">
			<button
				type="button"
				onClick={() => setManualOpen((value) => !(value ?? autoOpen))}
				className="group flex w-full cursor-pointer items-center gap-2 border-b border-border/60 pb-3 text-left text-[14px] font-medium transition-colors hover:text-foreground"
			>
				<span className="min-w-0">
					{isStreaming ? <Shimmer>{label}</Shimmer> : label}
				</span>
				<ChevronRight
					className={cn(
						"size-4 shrink-0 transition-transform duration-200",
						open && "rotate-90",
					)}
				/>
			</button>
			{open ? (
				<div className="space-y-4 border-b border-border/60 py-4">
					{groups.length === 0 && isStreaming ? (
						<ActivityGroupRow
							group={{
								kind: "thinking",
								status: "running",
								items: [
									{
										id: "working",
										kind: "thinking",
										label: "Preparing next step",
										status: "running",
									},
								],
							}}
						/>
					) : (
						groups.map((group) => (
							<ActivityGroupRow
								key={group.kind}
								group={group}
							/>
						))
					)}
				</div>
			) : null}
		</div>
	);
}

function ActivityGroupRow({ group }: { group: ActivityGroup }) {
	const [open, setOpen] = useState(false);
	const Icon = iconForKind(group.kind);
	const title = groupTitle(group);
	const running = group.status === "running" || group.status === "pending";
	return (
		<div className="text-[13px]">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				className="group flex w-full cursor-pointer items-center gap-2 text-left transition-colors hover:text-foreground"
			>
				<Icon
					className={cn(
						"size-4 shrink-0",
						running ? "text-primary" : "text-muted-foreground",
					)}
				/>
				<span className="min-w-0 flex-1 truncate">
					{running ? <Shimmer>{title}</Shimmer> : title}
				</span>
				<ChevronRight
					className={cn(
						"size-3.5 shrink-0 transition-transform duration-200",
						open && "rotate-90",
					)}
				/>
			</button>
			{open ? (
				<div className="mt-2 space-y-1.5 pl-6">
					{group.items.map((item) => (
						<div
							key={item.id}
							className={cn(
								"truncate font-mono text-[12px] leading-5",
								item.status === "error"
									? "text-destructive"
									: "text-muted-foreground",
							)}
							title={item.label}
						>
							{item.label}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}

function CustomRow({ data }: { data: ChatMessage & { role: "custom" } }) {
	return (
		<Message from="assistant">
			<MessageContent className="rounded-[18px] border border-border/40 bg-card/50 px-4 py-3 text-[12px] text-muted-foreground shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-xl">
				<div className="font-medium uppercase tracking-[0.08em] opacity-70">
					{data.subtype}
				</div>
				<pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5">
					{summarize(data.data)}
				</pre>
			</MessageContent>
		</Message>
	);
}

function OrphanToolResult({
	toolName,
	content,
	isError,
}: {
	toolName: string;
	content: unknown[];
	isError: boolean;
}) {
	const text = (content as Part[])
		.filter((p): p is Part & { type: "text" } => p?.type === "text")
		.map((p) => p.text)
		.join("\n");

	return (
		<Message from="assistant">
			<MessageContent
				className={cn(
					"rounded-[18px] border px-4 py-3 text-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-xl",
					isError
						? "border-destructive/30 bg-destructive/5 text-destructive"
						: "border-border/40 bg-card/50 text-muted-foreground",
				)}
			>
				<div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em]">
					<span>{toolName}</span>
					<span className="opacity-50">·</span>
					<span>{isError ? "error" : "result"}</span>
				</div>
				<pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5">
					{text || "(no output)"}
				</pre>
			</MessageContent>
		</Message>
	);
}

function buildActivities(
	parts: Part[],
	toolResults: Map<string, ToolResultInfo>,
	activeTools: Record<string, ToolExecutionState>,
	includeActiveOrphans: boolean,
): ActivityItem[] {
	const activities: ActivityItem[] = [];
	const thinkingCount = parts.filter((p) => p.type === "thinking").length;
	if (thinkingCount > 0) {
		activities.push({
			id: "thinking",
			kind: "thinking",
			label: `${thinkingCount} reasoning ${thinkingCount === 1 ? "block" : "blocks"}`,
			status: "done",
		});
	}
	for (const part of parts) {
		if (part.type !== "toolCall") continue;
		const result = toolResults.get(part.id);
		const execution = activeTools[part.id];
		activities.push({
			id: part.id,
			kind: kindForTool(part.name, part.arguments),
			label: summarizeTool(part.name, part.arguments),
			status: statusForTool(result, execution),
			toolName: part.name,
		});
	}
	if (includeActiveOrphans) {
		const seen = new Set(activities.map((activity) => activity.id));
		for (const execution of Object.values(activeTools)) {
			if (seen.has(execution.toolCallId)) continue;
			activities.push({
				id: execution.toolCallId,
				kind: kindForTool(execution.toolName, execution.args),
				label: summarizeTool(execution.toolName, execution.args),
				status: statusForTool(undefined, execution),
				toolName: execution.toolName,
			});
		}
	}
	return activities;
}

function groupActivities(items: ActivityItem[]): ActivityGroup[] {
	const order: ActivityKind[] = ["thinking", "edit", "command", "read", "search", "other"];
	return order
		.map((kind) => {
			const groupItems = items.filter((item) => item.kind === kind);
			if (groupItems.length === 0) return null;
			return {
				kind,
				items: groupItems,
				status: aggregateStatus(groupItems),
			};
		})
		.filter((group): group is ActivityGroup => !!group);
}

function aggregateStatus(items: ActivityItem[]): ActivityStatus {
	if (items.some((item) => item.status === "error")) return "error";
	if (items.some((item) => item.status === "running")) return "running";
	if (items.some((item) => item.status === "pending")) return "pending";
	return "done";
}

function groupTitle(group: ActivityGroup) {
	const count = group.items.length;
	const failed = group.items.filter((item) => item.status === "error").length;
	const running = group.status === "running" || group.status === "pending";
	const prefix = running ? runningPrefix(group.kind) : donePrefix(group.kind);
	const unit = unitForKind(group.kind);
	const failureText = failed > 0 ? `，其中 ${failed} ${unit}失败` : "";
	return `${prefix} ${count} ${unit}${failureText}`;
}

function runningPrefix(kind: ActivityKind) {
	switch (kind) {
		case "thinking":
			return "正在引导";
		case "command":
			return "正在运行";
		case "edit":
			return "正在编辑";
		case "read":
			return "正在读取";
		case "search":
			return "正在搜索";
		default:
			return "正在处理";
	}
}

function donePrefix(kind: ActivityKind) {
	switch (kind) {
		case "thinking":
			return "已引导";
		case "command":
			return "已运行";
		case "edit":
			return "已编辑";
		case "read":
			return "已读取";
		case "search":
			return "已搜索";
		default:
			return "已处理";
	}
}

function unitForKind(kind: ActivityKind) {
	switch (kind) {
		case "thinking":
			return "段对话";
		case "command":
			return "条命令";
		case "edit":
		case "read":
			return "个文件";
		case "search":
			return "次搜索";
		default:
			return "项任务";
	}
}

function kindForTool(name: string, args: Record<string, unknown>): ActivityKind {
	const lower = name.toLowerCase();
	if ("command" in args || lower.includes("bash") || lower.includes("shell") || lower.includes("exec")) {
		return "command";
	}
	if (
		lower.includes("edit") ||
		lower.includes("patch") ||
		lower.includes("write") ||
		lower.includes("create") ||
		lower.includes("apply")
	) {
		return "edit";
	}
	if (
		lower.includes("grep") ||
		lower.includes("search") ||
		"query" in args ||
		"pattern" in args
	) {
		return "search";
	}
	if (
		lower.includes("read") ||
		lower.includes("view") ||
		lower.includes("cat") ||
		lower.includes("ls") ||
		lower.includes("list") ||
		"path" in args ||
		"file" in args
	) {
		return "read";
	}
	return "other";
}

function statusForTool(
	result: ToolResultInfo | undefined,
	execution: ToolExecutionState | undefined,
): ActivityStatus {
	if (result?.isError || execution?.status === "error") return "error";
	if (result || execution?.status === "done") return "done";
	if (execution?.status === "running") return "running";
	return "pending";
}

function summarizeTool(name: string, args: Record<string, unknown>) {
	if (!args || typeof args !== "object") return name;
	if ("command" in args) return String(args.command).split("\n")[0];
	if ("path" in args) {
		const path = String(args.path);
		if ("pattern" in args) return `${path}  ‹${String(args.pattern)}›`;
		return path;
	}
	if ("file" in args) return String(args.file);
	if ("query" in args) return String(args.query);
	if ("pattern" in args) return String(args.pattern);
	const first = Object.values(args).find(
		(value) => typeof value === "string" || typeof value === "number",
	);
	return first == null ? name : String(first);
}

function iconForKind(kind: ActivityKind) {
	switch (kind) {
		case "thinking":
			return Sparkles;
		case "command":
			return Terminal;
		case "edit":
			return FilePen;
		case "read":
			return FileText;
		case "search":
			return Search;
		default:
			return Wrench;
	}
}

function latestActivityTimestamp(
	activities: ActivityItem[],
	toolResults: Map<string, ToolResultInfo>,
	fallback: number,
) {
	let latest = fallback;
	for (const item of activities) {
		const timestamp = toolResults.get(item.id)?.timestamp;
		if (timestamp && timestamp > latest) latest = timestamp;
	}
	return latest;
}

function formatDuration(ms: number) {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes <= 0) return `${seconds}s`;
	return `${minutes}m ${seconds}s`;
}

function summarize(v: unknown): string {
	try {
		const s = JSON.stringify(v, null, 2);
		return s.length > 400 ? `${s.slice(0, 400)}...` : s;
	} catch {
		return String(v);
	}
}
