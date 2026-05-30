import {
	ChevronRight,
	Copy,
	FilePen,
	FilePlus,
	FileText,
	GitFork,
	RotateCcw,
	Search,
	Sparkles,
	Terminal,
	Wrench,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { t as translate, useI18n } from "@/lib/i18n";
import { pi } from "@/lib/rpc";
import { emitToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
	type ChatMessage,
	type PendingSubmission,
	type ToolExecutionState,
	useSessions,
} from "@/stores/session-state";

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

type ActivityKind = "thinking" | "command" | "edit" | "write" | "read" | "search" | "other";
type ActivityStatus = "pending" | "running" | "done" | "error";

interface ActivityItem {
	id: string;
	kind: ActivityKind;
	label: string;
	status: ActivityStatus;
	toolName?: string;
	action?: "read" | "write" | "edit" | "run" | "search" | "think" | "process";
	diffStat?: string;
}

interface ActivityGroup {
	kind: ActivityKind;
	items: ActivityItem[];
	status: ActivityStatus;
}

type TimelineItem =
	| {
			type: "user";
			key: string;
			message: Extract<ChatMessage, { role: "user" }>;
			userIndex: number;
	  }
	| {
			type: "assistantTurn";
			key: string;
			messages: Array<Extract<ChatMessage, { role: "assistant" }>>;
			lastIndex: number;
	  }
	| {
			type: "toolResult";
			key: string;
			message: Extract<ChatMessage, { role: "toolResult" }>;
	  }
	| { type: "custom"; key: string; message: Extract<ChatMessage, { role: "custom" }> };

export function MessageTimeline({ sessionId }: Props) {
	const { t } = useI18n();
	const slice = useSessions((s) => s.bySession[sessionId]);
	const messages = slice?.messages ?? [];
	const isStreaming = slice?.isStreaming ?? false;
	const activeTools = slice?.activeTools ?? {};
	const pendingSubmissions = slice?.pendingSubmissions ?? [];
	const hydrate = useSessions((s) => s.hydrate);

	// Fetch fork messages for "Fork from here" buttons
	const [forkMessages, setForkMessages] = useState<Array<{ entryId: string; text: string }>>([]);
	useEffect(() => {
		if (messages.length === 0) return;
		pi.rpc.send(sessionId, { type: "get_fork_messages" }).then((resp) => {
			if (resp.success && resp.command === "get_fork_messages") {
				setForkMessages(resp.data.messages);
			}
		});
	}, [sessionId, messages.length]);

	// Build a map of user message index -> entryId for fork buttons
	const forkEntryIds = useMemo(() => {
		let userIdx = 0;
		const map = new Map<number, string>();
		for (const msg of messages) {
			if (msg.role === "user") {
				const forkMsg = forkMessages[userIdx];
				if (forkMsg) map.set(userIdx, forkMsg.entryId);
				userIdx++;
			}
		}
		return map;
	}, [messages, forkMessages]);

	const handleFork = useCallback(
		async (entryId: string) => {
			try {
				const resp = await pi.rpc.send(sessionId, { type: "fork", entryId });
				if (resp.success && resp.command === "fork") {
					await hydrate(sessionId);
				} else if (!resp.success) {
					emitToast(resp.error);
				}
			} catch (e) {
				emitToast(
					translate("toast.forkFailed", { error: e instanceof Error ? e.message : String(e) }),
				);
			}
		},
		[sessionId, hydrate],
	);
	const queuedMessages = useMemo(
		() => [
			...((slice?.queue.steering ?? []).map((content, index) => ({
				content,
				index,
				type: "steering" as const,
			})) ?? []),
			...((slice?.queue.followUp ?? []).map((content, index) => ({
				content,
				index,
				type: "followUp" as const,
			})) ?? []),
		],
		[slice?.queue.steering, slice?.queue.followUp],
	);

	const { toolResults, claimed } = useMemo(() => {
		const map = new Map<string, ToolResultInfo>();
		const toolCallIds = new Set<string>();
		for (const m of messages) {
			if (m.role === "assistant") {
				for (const part of (m.content ?? []) as Part[]) {
					if (part?.type === "toolCall") toolCallIds.add(part.id);
				}
			}
			if (m.role === "toolResult") {
				map.set(m.toolCallId, {
					toolName: m.toolName,
					content: m.content,
					isError: m.isError,
					details: m.details,
					timestamp: m.timestamp,
				});
			}
		}
		return { toolResults: map, claimed: toolCallIds };
	}, [messages]);

	const lastAssistantIdx = useMemo(() => {
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === "assistant") return i;
		}
		return -1;
	}, [messages]);
	const timelineItems = useMemo(() => buildTimelineItems(messages, claimed), [messages, claimed]);

	// ── Search ──────────────────────────────────────────────────────────
	const [searchQuery, setSearchQuery] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);

	const searchMatches = useMemo(() => {
		if (!searchQuery.trim()) return new Set<string>();
		const q = searchQuery.toLowerCase();
		const matched = new Set<string>();
		for (const item of timelineItems) {
			if (item.type === "user") {
				const text = extractTextFromContent(item.message.content);
				if (text.toLowerCase().includes(q)) matched.add(item.key);
			} else if (item.type === "assistantTurn") {
				const text = item.messages
					.flatMap((m) => (m.content ?? []) as Part[])
					.filter((p): p is Part & { type: "text" } => p.type === "text" && !!p.text)
					.map((p) => p.text)
					.join(" ");
				if (text.toLowerCase().includes(q)) matched.add(item.key);
			} else if (item.type === "toolResult") {
				const text = (item.message.content as Part[])
					.filter((p): p is Part & { type: "text" } => p?.type === "text")
					.map((p) => p.text)
					.join(" ");
				if (text.toLowerCase().includes(q)) matched.add(item.key);
			}
		}
		return matched;
	}, [searchQuery, timelineItems]);

	const hasSearch = searchQuery.trim().length > 0;
	const visibleItems = hasSearch
		? timelineItems.filter((item) => searchMatches.has(item.key))
		: timelineItems;

	return (
		<Conversation>
			{/* Search bar */}
			{messages.length > 0 ? (
				<div className="relative px-4 pt-3">
					{searchOpen ? (
						<div className="flex items-center gap-2 rounded-[12px] border border-border/50 bg-card px-3 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
							<Search className="size-3.5 shrink-0 text-muted-foreground" />
							<input
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder={t("timeline.searchPlaceholder")}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										setSearchOpen(false);
										setSearchQuery("");
									}
								}}
								className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
							/>
							{searchQuery ? (
								<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
									{searchMatches.size} {t("timeline.matches")}
								</span>
							) : null}
							<button
								type="button"
								onClick={() => {
									setSearchOpen(false);
									setSearchQuery("");
								}}
								className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
							>
								<X className="size-3" />
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setSearchOpen(true)}
							className="flex items-center gap-1.5 rounded-[10px] px-2 py-1 text-[11px] font-medium text-muted-foreground/60 transition-colors hover:bg-foreground/[0.04] hover:text-muted-foreground"
						>
							<Search className="size-3" />
							{t("timeline.search")}
						</button>
					)}
				</div>
			) : null}
			<ConversationContent>
				{messages.length === 0 && queuedMessages.length === 0 && pendingSubmissions.length === 0 ? (
					<ConversationEmptyState
						icon={<Sparkles className="size-7" />}
						title={t("timeline.emptyTitle")}
						description={t("timeline.emptyDescription")}
					/>
				) : (
					<>
						{visibleItems.map((item) => (
							<TimelineRow
								key={item.key}
								item={item}
								toolResults={toolResults}
								activeTools={activeTools}
								isStreamingLast={
									isStreaming &&
									item.type === "assistantTurn" &&
									item.lastIndex === lastAssistantIdx
								}
								forkEntryIds={forkEntryIds}
								onFork={handleFork}
								sessionId={sessionId}
								isStreaming={isStreaming}
							/>
						))}
						{pendingSubmissions.map((submission) => (
							<PendingSubmissionTurn key={submission.id} submission={submission} />
						))}
						{queuedMessages.map((message) => (
							<QueuedMessageRow
								key={`${message.type}-${message.index}-${message.content}`}
								content={message.content}
								type={message.type}
							/>
						))}
					</>
				)}
			</ConversationContent>
			<ConversationScrollButton />
		</Conversation>
	);
}

function TimelineRow({
	item,
	toolResults,
	activeTools,
	isStreamingLast,
	forkEntryIds,
	onFork,
	sessionId,
	isStreaming,
}: {
	item: TimelineItem;
	toolResults: Map<string, ToolResultInfo>;
	activeTools: Record<string, ToolExecutionState>;
	isStreamingLast: boolean;
	forkEntryIds: Map<number, string>;
	onFork: (entryId: string) => void;
	sessionId: string;
	isStreaming: boolean;
}) {
	if (item.type === "user") {
		const entryId = forkEntryIds.get(item.userIndex);
		return <UserRow content={item.message.content} forkEntryId={entryId} onFork={onFork} />;
	}
	if (item.type === "assistantTurn") {
		// Find the preceding user message for regeneration
		const lastAssistantTs = item.messages[0]?.timestamp ?? 0;
		const allMessages = useSessions.getState().bySession[sessionId]?.messages ?? [];
		let precedingUserText: string | undefined;
		for (let i = allMessages.length - 1; i >= 0; i--) {
			const m = allMessages[i];
			if (m.timestamp >= lastAssistantTs) continue;
			if (m.role === "user") {
				precedingUserText =
					typeof m.content === "string"
						? m.content
						: (m.content as Part[])
								.filter((p): p is Part & { type: "text" } => p?.type === "text")
								.map((p) => p.text)
								.join("\n");
				break;
			}
		}
		return (
			<AssistantRow
				messages={item.messages}
				toolResults={toolResults}
				activeTools={activeTools}
				isStreaming={isStreamingLast}
				sessionId={sessionId}
				globalStreaming={isStreaming}
				precedingUserText={precedingUserText}
			/>
		);
	}
	if (item.type === "toolResult") {
		return (
			<OrphanToolResult
				toolName={item.message.toolName}
				content={item.message.content}
				isError={item.message.isError}
			/>
		);
	}
	if (item.type === "custom") return <CustomRow data={item.message} />;
	return null;
}

function PendingSubmissionTurn({ submission }: { submission: PendingSubmission }) {
	return (
		<>
			<UserRow content={submission.content} forkEntryId={undefined} onFork={undefined} />
			<Message from="assistant">
				<MessageContent className="flex flex-col gap-3.5">
					<ActivityPanel activities={[]} elapsed="0s" isStreaming hasFinalText={false} />
				</MessageContent>
			</Message>
		</>
	);
}

function QueuedMessageRow({ content, type }: { content: string; type: "steering" | "followUp" }) {
	const { t } = useI18n();
	return (
		<Message from="user">
			<div className="flex min-w-0 w-fit max-w-[76%] flex-col gap-2 rounded-[22px] rounded-br-[10px] border border-primary/15 bg-card/90 px-4 py-3 text-[14px] leading-6 text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl">
				<div className="flex items-center gap-2 text-[11px] font-medium text-primary/70">
					<span className="size-1.5 rounded-full bg-primary/50" />
					{type === "steering" ? t("timeline.queuedSteer") : t("timeline.queuedFollowUp")}
				</div>
				<div className="min-w-0 whitespace-pre-wrap break-words text-foreground/85 [overflow-wrap:anywhere]">
					{content}
				</div>
			</div>
		</Message>
	);
}

function UserRow({
	content,
	forkEntryId,
	onFork,
}: {
	content: string | unknown[];
	forkEntryId?: string;
	onFork?: (entryId: string) => void;
}) {
	const { t } = useI18n();
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
			: (content as Part[]).filter((p): p is Part & { type: "image" } => p?.type === "image");
	return (
		<Message from="user" className="group/user">
			<div className="relative">
				<MessageContent className="flex flex-col items-stretch gap-3">
					{images.map((img, i) => (
						<img
							key={i}
							alt=""
							src={`data:${img.mimeType};base64,${img.data}`}
							className="max-h-72 self-end rounded-[18px] border border-white/25 object-contain"
						/>
					))}
					{text ? (
						<div className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
							{text}
						</div>
					) : null}
				</MessageContent>
				{/* Action buttons — copy + fork */}
				<div
					className={cn(
						"absolute -right-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1",
						"opacity-0 transition-opacity duration-150",
						"group-hover/user:opacity-100",
						"focus-within:opacity-100",
					)}
				>
					{text ? (
						<button
							type="button"
							onClick={() => {
								void navigator.clipboard.writeText(text);
								emitToast(t("timeline.copied"), "info");
							}}
							className={cn(
								"flex items-center gap-1 rounded-full",
								"bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground",
								"border border-border/40 shadow-sm",
								"hover:text-foreground",
							)}
							title={t("timeline.copyMessage")}
						>
							<Copy className="size-3" />
						</button>
					) : null}
					{forkEntryId && onFork ? (
						<button
							type="button"
							onClick={() => onFork(forkEntryId)}
							className={cn(
								"flex items-center gap-1 rounded-full",
								"bg-card px-2 py-1 text-[10px] font-medium text-primary/70",
								"border border-primary/20 shadow-sm",
								"hover:text-primary",
							)}
							title={t("timeline.forkFromHere")}
						>
							<GitFork className="size-3" />
							{t("branches.forkLabel")}
						</button>
					) : null}
				</div>
			</div>
		</Message>
	);
}

function buildTimelineItems(
	messages: ChatMessage[],
	claimedToolResultIds: Set<string>,
): TimelineItem[] {
	const items: TimelineItem[] = [];
	let userIndex = 0;
	for (let index = 0; index < messages.length; index++) {
		const message = messages[index];
		if (message.role === "user") {
			items.push({
				type: "user",
				key: `user-${message.timestamp}-${index}`,
				message,
				userIndex,
			});
			userIndex++;
			continue;
		}
		if (message.role === "assistant") {
			const last = items[items.length - 1];
			if (last?.type === "assistantTurn") {
				last.messages.push(message);
				last.lastIndex = index;
			} else {
				items.push({
					type: "assistantTurn",
					key: `assistant-${message.timestamp}-${index}`,
					messages: [message],
					lastIndex: index,
				});
			}
			continue;
		}
		if (message.role === "toolResult") {
			if (!claimedToolResultIds.has(message.toolCallId)) {
				items.push({
					type: "toolResult",
					key: `tool-${message.toolCallId}-${message.timestamp}-${index}`,
					message,
				});
			}
			continue;
		}
		if (message.role === "custom") {
			items.push({
				type: "custom",
				key: `custom-${message.subtype}-${message.timestamp}-${index}`,
				message,
			});
		}
	}
	return items;
}

function AssistantRow({
	messages,
	toolResults,
	activeTools,
	isStreaming,
	sessionId,
	globalStreaming,
	precedingUserText,
}: {
	messages: Array<Extract<ChatMessage, { role: "assistant" }>>;
	toolResults: Map<string, ToolResultInfo>;
	activeTools: Record<string, ToolExecutionState>;
	isStreaming: boolean;
	sessionId: string;
	globalStreaming: boolean;
	precedingUserText?: string;
}) {
	const { t } = useI18n();
	const parts = messages.flatMap((message) => (message.content ?? []) as Part[]);
	const text = parts
		.filter((p): p is Part & { type: "text" } => p.type === "text" && !!p.text)
		.map((p) => p.text)
		.join("\n\n");
	const activities = buildActivities(parts, toolResults, activeTools, isStreaming);
	const hasFinalText = text.trim().length > 0;
	const hasContent = hasFinalText || activities.length > 0;
	if (!hasContent) return null;

	const firstMessage = messages[0];
	const lastMessage = messages[messages.length - 1];
	const startedAt = firstMessage?.timestamp ?? Date.now();
	const endedAt = latestActivityTimestamp(
		activities,
		toolResults,
		lastMessage?.timestamp ?? startedAt,
	);
	const elapsed = formatDuration(Math.max(0, (isStreaming ? Date.now() : endedAt) - startedAt));
	const model = lastMessage?.model;
	const stopReason = lastMessage?.stopReason;

	async function handleCopy() {
		if (!text) return;
		await navigator.clipboard.writeText(text);
		emitToast(t("timeline.copied"), "info");
	}

	async function handleRegenerate() {
		if (globalStreaming || !precedingUserText) return;
		try {
			// Re-send the preceding user message to get a fresh response
			await pi.rpc.send(sessionId, {
				type: "prompt",
				message: precedingUserText,
			} as any);
		} catch (e) {
			emitToast(
				translate("toast.forkFailed", { error: e instanceof Error ? e.message : String(e) }),
			);
		}
	}

	return (
		<Message from="assistant">
			<div className="group/assistant relative min-w-0 max-w-full">
				<MessageContent className="flex flex-col gap-3.5">
					<ActivityPanel
						activities={activities}
						elapsed={elapsed}
						isStreaming={isStreaming}
						hasFinalText={hasFinalText}
					/>
					{hasFinalText ? <MessageResponse>{text}</MessageResponse> : null}
					{model || stopReason ? (
						<div className="text-[11px] font-medium text-muted-foreground/55">
							{model ?? ""}
							{stopReason && stopReason !== "stop" ? ` · ${stopReason}` : ""}
						</div>
					) : null}
				</MessageContent>
				{/* Action buttons — appear on hover when not streaming */}
				{!isStreaming && hasFinalText ? (
					<div
						className={cn(
							"absolute -right-1 bottom-1 z-10 flex items-center gap-1",
							"opacity-0 transition-opacity duration-150",
							"group-hover/assistant:opacity-100",
							"focus-within:opacity-100",
						)}
					>
						<button
							type="button"
							onClick={handleCopy}
							className={cn(
								"flex items-center gap-1 rounded-full",
								"bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground",
								"border border-border/40 shadow-sm",
								"hover:text-foreground",
							)}
							title={t("timeline.copyMessage")}
						>
							<Copy className="size-3" />
						</button>
						<button
							type="button"
							onClick={handleRegenerate}
							disabled={globalStreaming || !precedingUserText}
							className={cn(
								"flex items-center gap-1 rounded-full",
								"bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground",
								"border border-border/40 shadow-sm",
								"hover:text-foreground",
								"disabled:opacity-40 disabled:pointer-events-none",
							)}
							title={t("timeline.regenerate")}
						>
							<RotateCcw className="size-3" />
						</button>
					</div>
				) : null}
			</div>
		</Message>
	);
}

function ActivityPanel({
	activities,
	elapsed,
	isStreaming,
	hasFinalText,
}: {
	activities: ActivityItem[];
	elapsed: string;
	isStreaming: boolean;
	hasFinalText: boolean;
}) {
	const { t } = useI18n();
	const [manualOpen, setManualOpen] = useState<boolean | null>(null);
	const groups = useMemo(() => groupActivities(activities), [activities]);
	const autoOpen = isStreaming || !hasFinalText;
	const open = manualOpen ?? autoOpen;

	useEffect(() => {
		if (isStreaming) setManualOpen(null);
	}, [isStreaming]);

	if (activities.length === 0 && !isStreaming) return null;

	const label = isStreaming
		? t("activity.processing", { elapsed })
		: t("activity.processed", { elapsed });

	return (
		<div className="w-full text-muted-foreground">
			<button
				type="button"
				onClick={() => setManualOpen((value) => !(value ?? autoOpen))}
				className="group flex w-full cursor-pointer items-center gap-2 border-b border-border/60 pb-2.5 text-left text-[13px] font-medium transition-colors hover:text-foreground"
			>
				<span className="min-w-0">{label}</span>
				<ChevronRight
					className={cn("size-4 shrink-0 transition-transform duration-200", open && "rotate-90")}
				/>
			</button>
			{open ? (
				<div className="space-y-3 border-b border-border/60 py-3">
					{groups.length === 0 && isStreaming ? (
						<ActivityGroupRow
							group={{
								kind: "thinking",
								status: "running",
								items: [
									{
										id: "working",
										kind: "thinking",
										label: translate("timeline.preparingNextStep"),
										status: "running",
									},
								],
							}}
						/>
					) : (
						groups.map((group, index) => (
							<ActivityGroupRow key={`${group.kind}-${index}`} group={group} />
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
	const running = group.status === "running" || group.status === "pending";
	const title = running ? runningGroupTitle(group) : groupTitle(group);
	return (
		<div className="text-[12.5px]">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				className="group flex w-full cursor-pointer items-center gap-2 text-left transition-colors hover:text-foreground"
			>
				<Icon
					className={cn("size-4 shrink-0", running ? "text-primary" : "text-muted-foreground")}
				/>
				<span className="min-w-0 flex-1 truncate">
					{running ? <Shimmer>{title}</Shimmer> : title}
				</span>
				<ChevronRight
					className={cn("size-3.5 shrink-0 transition-transform duration-200", open && "rotate-90")}
				/>
			</button>
			{running ? (
				<div className="mt-1.5 space-y-1 pl-6">
					{group.items.map((item) => (
						<ActivityItemRow key={item.id} item={item} />
					))}
				</div>
			) : open ? (
				<div className="mt-1.5 space-y-1 pl-6">
					{group.items.map((item) => (
						<ActivityItemRow key={item.id} item={item} />
					))}
				</div>
			) : null}
		</div>
	);
}

function ActivityItemRow({ item }: { item: ActivityItem }) {
	const label = formatItemLabel(item);
	return (
		<div
			className={cn(
				"truncate font-mono text-[11.5px] leading-5",
				item.status === "error" ? "text-destructive" : "text-muted-foreground",
			)}
			title={label}
		>
			{label}
		</div>
	);
}

function CustomRow({ data }: { data: ChatMessage & { role: "custom" } }) {
	return (
		<Message from="assistant">
			<MessageContent className="rounded-[18px] border border-border/40 bg-card/50 px-4 py-3 text-[12px] text-muted-foreground shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-xl">
				<div className="font-medium uppercase tracking-[0.08em] opacity-70">{data.subtype}</div>
				<pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 [overflow-wrap:anywhere]">
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
	const { t } = useI18n();
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
					<span>{isError ? t("timeline.error") : t("timeline.result")}</span>
				</div>
				<pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 [overflow-wrap:anywhere]">
					{text || t("timeline.noOutput")}
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
			action: "think",
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
			action: actionForTool(part.name, part.arguments),
			diffStat: diffStatForTool(
				part.name,
				part.arguments,
				result ?? execution?.result ?? execution?.partialResult,
			),
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
				action: actionForTool(execution.toolName, execution.args),
				diffStat: diffStatForTool(
					execution.toolName,
					execution.args,
					execution.result ?? execution.partialResult,
				),
			});
		}
	}
	return activities;
}

function groupActivities(items: ActivityItem[]): ActivityGroup[] {
	const groups: ActivityGroup[] = [];
	for (const item of items) {
		const last = groups.at(-1);
		if (last?.kind === item.kind) {
			last.items.push(item);
			last.status = aggregateStatus(last.items);
			continue;
		}
		groups.push({
			kind: item.kind,
			items: [item],
			status: item.status,
		});
	}
	return groups;
}

function aggregateStatus(items: ActivityItem[]): ActivityStatus {
	if (items.some((item) => item.status === "error")) return "error";
	if (items.some((item) => item.status === "running")) return "running";
	if (items.some((item) => item.status === "pending")) return "pending";
	return "done";
}

function groupTitle(group: ActivityGroup): string {
	const count = group.items.length;
	const failed = group.items.filter((item) => item.status === "error").length;
	const running = group.status === "running" || group.status === "pending";
	const prefix = running ? runningGroupTitle(group) : donePrefix(group.kind);
	const unit = unitForKind(group.kind);
	const failureText = failed > 0 ? translate("activity.group.failed", { count: failed, unit }) : "";
	return `${prefix} ${count} ${unit}${failureText}`;
}

function runningGroupTitle(group: ActivityGroup): string {
	const current =
		group.items.find((item) => item.status === "running") ??
		group.items.find((item) => item.status === "pending") ??
		group.items[0];
	if (!current) return groupTitle(group);
	if (group.items.length === 1) return formatItemLabel(current, true);
	return `${formatItemLabel(current, true)} ${translate("activity.group.etc", { count: group.items.length })}`;
}

function formatItemLabel(item: ActivityItem, withAction = false) {
	const label = item.diffStat ? `${item.label} ${item.diffStat}` : item.label;
	if (!withAction) return label;
	switch (item.action ?? item.kind) {
		case "think":
		case "thinking":
			return translate("activity.running.thinking");
		case "write":
			return translate("activity.running.write", { label });
		case "edit":
			return translate("activity.running.edit", { label });
		case "run":
		case "command":
			return translate("activity.running.run", { label });
		case "read":
			return translate("activity.running.read", { label });
		case "search":
			return translate("activity.running.search", { label });
		default:
			return translate("activity.running.process", { label });
	}
}

function _runningPrefix(kind: ActivityKind) {
	const keyMap: Record<ActivityKind, string> = {
		thinking: "activity.group.thinking.running",
		command: "activity.group.command.running",
		edit: "activity.group.edit.running",
		write: "activity.group.write.running",
		read: "activity.group.read.running",
		search: "activity.group.search.running",
		other: "activity.group.other.running",
	};
	return translate(keyMap[kind]);
}

function donePrefix(kind: ActivityKind) {
	const keyMap: Record<ActivityKind, string> = {
		thinking: "activity.group.thinking.done",
		command: "activity.group.command.done",
		edit: "activity.group.edit.done",
		write: "activity.group.write.done",
		read: "activity.group.read.done",
		search: "activity.group.search.done",
		other: "activity.group.other.done",
	};
	return translate(keyMap[kind]);
}

function unitForKind(kind: ActivityKind) {
	const keyMap: Record<ActivityKind, string> = {
		thinking: "activity.unit.thinking",
		command: "activity.unit.command",
		edit: "activity.unit.file",
		write: "activity.unit.file",
		read: "activity.unit.file",
		search: "activity.unit.search",
		other: "activity.unit.other",
	};
	return translate(keyMap[kind]);
}

function kindForTool(name: string, _args: Record<string, unknown>): ActivityKind {
	switch (name) {
		case "bash":
			return "command";
		case "edit":
			return "edit";
		case "write":
			return "write";
		case "read":
		case "ls":
			return "read";
		case "grep":
		case "find":
			return "search";
		default:
			return "other";
	}
}

function actionForTool(name: string, _args: Record<string, unknown>): ActivityItem["action"] {
	switch (name) {
		case "bash":
			return "run";
		case "edit":
			return "edit";
		case "write":
			return "write";
		case "read":
		case "ls":
			return "read";
		case "grep":
		case "find":
			return "search";
		default:
			return "process";
	}
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
	const path = pathFromArgs(args);
	const compact = path ? compactPath(path) : null;
	switch (name) {
		case "write":
		case "edit":
		case "read":
		case "ls":
			return compact ?? "未指定路径";
		case "grep":
		case "find": {
			const pattern = stringArg(args, "pattern") ?? stringArg(args, "query");
			if (compact && pattern) return `${compact}  ‹${pattern}›`;
			return compact ?? pattern ?? name;
		}
		default:
			break;
	}
	if (compact) {
		if ("pattern" in args) return `${compact}  ‹${String(args.pattern)}›`;
		return compact;
	}
	if ("query" in args) return String(args.query);
	if ("pattern" in args) return String(args.pattern);
	const fallback = Object.entries(args).find(
		([key, value]) =>
			!isVerboseToolArg(key) && (typeof value === "string" || typeof value === "number"),
	);
	return fallback == null ? name : String(fallback[1]);
}

function pathFromArgs(args: Record<string, unknown>) {
	return (
		stringArg(args, "path") ??
		stringArg(args, "file_path") ??
		stringArg(args, "filePath") ??
		stringArg(args, "filepath") ??
		stringArg(args, "file")
	);
}

function stringArg(args: Record<string, unknown>, key: string) {
	const value = args[key];
	return typeof value === "string" && value.trim() ? value : null;
}

function isVerboseToolArg(key: string) {
	return [
		"content",
		"oldText",
		"newText",
		"old_text",
		"new_text",
		"old_string",
		"new_string",
		"patch",
		"diff",
		"edits",
	].includes(key);
}

function compactPath(path: string) {
	const parts = path.split(/[\\/]/).filter(Boolean);
	if (parts.length <= 2) return path;
	return parts.at(-1) ?? path;
}

function diffStatForTool(
	name: string,
	args: Record<string, unknown>,
	result?: { details?: unknown },
) {
	const details = result?.details as { patch?: string; diff?: string } | undefined;
	const patch = details?.patch ?? details?.diff;
	if (patch) return diffStatFromPatch(patch);
	const lower = name.toLowerCase();
	if ((lower.includes("write") || lower.includes("create")) && typeof args.content === "string") {
		const added = String(args.content).split("\n").length;
		return `+${added} -0`;
	}
	if (typeof args.patch === "string") return diffStatFromPatch(args.patch);
	if (typeof args.diff === "string") return diffStatFromPatch(args.diff);
	return undefined;
}

function diffStatFromPatch(patch: string) {
	let added = 0;
	let removed = 0;
	for (const line of patch.split("\n")) {
		if (line.startsWith("+++") || line.startsWith("---")) continue;
		if (line.startsWith("+")) added++;
		if (line.startsWith("-")) removed++;
	}
	if (added === 0 && removed === 0) return undefined;
	return `+${added} -${removed}`;
}

function iconForKind(kind: ActivityKind) {
	switch (kind) {
		case "thinking":
			return Sparkles;
		case "command":
			return Terminal;
		case "edit":
			return FilePen;
		case "write":
			return FilePlus;
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

function extractTextFromContent(content: string | unknown[]): string {
	if (typeof content === "string") return content;
	return (content as Part[])
		.filter((p): p is Part & { type: "text" } => p?.type === "text")
		.map((p) => p.text)
		.join("\n");
}
