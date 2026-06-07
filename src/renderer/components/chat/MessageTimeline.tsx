import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	Copy,
	FilePen,
	FileText,
	GitFork,
	Info,
	RefreshCw,
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

type Part =
	| { type: "text"; text: string }
	| { type: "thinking"; thinking: string; redacted?: boolean }
	| ToolCallPart
	| { type: "image"; data: string; mimeType: string };

interface ToolResultInfo {
	toolCallId: string;
	toolName: string;
	content: unknown[];
	isError: boolean;
	details?: unknown;
	timestamp?: number;
}

type ToolStatus = "pending" | "running" | "done" | "error";

type TranscriptEntry =
	| {
			type: "user";
			key: string;
			message: Extract<ChatMessage, { role: "user" }>;
			userIndex: number;
	  }
	| {
			type: "assistantText";
			key: string;
			text: string;
			timestamp: number;
			model?: string;
			stopReason?: string;
			precedingUserText?: string;
	  }
	| {
			type: "thinking";
			key: string;
			text: string;
			redacted?: boolean;
			timestamp: number;
	  }
	| {
			type: "assistantImage";
			key: string;
			data: string;
			mimeType: string;
			timestamp: number;
	  }
	| {
			type: "toolCall";
			key: string;
			toolCallId: string;
			toolName: string;
			args: Record<string, unknown>;
			timestamp: number;
	  }
	| {
			type: "toolResult";
			key: string;
			message: Extract<ChatMessage, { role: "toolResult" }>;
	  }
	| {
			type: "assistantError";
			key: string;
			stopReason?: string;
			message?: string;
			timestamp: number;
	  }
	| { type: "custom"; key: string; message: Extract<ChatMessage, { role: "custom" }> }
	| { type: "liveTool"; key: string; execution: ToolExecutionState };

export function MessageTimeline({ sessionId }: Props) {
	const { t } = useI18n();
	const slice = useSessions((s) => s.bySession[sessionId]);
	const messages = slice?.messages ?? [];
	const isStreaming = slice?.isStreaming ?? false;
	const activeTools = slice?.activeTools ?? {};
	const pendingSubmissions = slice?.pendingSubmissions ?? [];
	const hydrate = useSessions((s) => s.hydrate);

	const [forkMessages, setForkMessages] = useState<Array<{ entryId: string; text: string }>>([]);
	useEffect(() => {
		if (messages.length === 0) return;
		pi.rpc.send(sessionId, { type: "get_fork_messages" }).then((resp) => {
			if (resp.success && resp.command === "get_fork_messages") {
				setForkMessages(resp.data.messages);
			}
		});
	}, [sessionId, messages.length]);

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

	const toolResults = useMemo(() => buildToolResultMap(messages), [messages]);
	const transcript = useMemo(() => buildTranscript(messages, activeTools), [messages, activeTools]);

	const [searchQuery, setSearchQuery] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const searchMatches = useMemo(() => {
		if (!searchQuery.trim()) return new Set<string>();
		const q = searchQuery.toLowerCase();
		return new Set(
			transcript
				.filter((entry) => transcriptSearchText(entry).toLowerCase().includes(q))
				.map((entry) => entry.key),
		);
	}, [searchQuery, transcript]);
	const hasSearch = searchQuery.trim().length > 0;
	const visibleEntries = hasSearch
		? transcript.filter((entry) => searchMatches.has(entry.key))
		: transcript;

	return (
		<Conversation>
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
						{visibleEntries.map((entry) => (
							<TranscriptRow
								key={entry.key}
								entry={entry}
								toolResults={toolResults}
								activeTools={activeTools}
								forkEntryIds={forkEntryIds}
								onFork={handleFork}
								sessionId={sessionId}
								globalStreaming={isStreaming}
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

function TranscriptRow({
	entry,
	toolResults,
	activeTools,
	forkEntryIds,
	onFork,
	sessionId,
	globalStreaming,
}: {
	entry: TranscriptEntry;
	toolResults: Map<string, ToolResultInfo>;
	activeTools: Record<string, ToolExecutionState>;
	forkEntryIds: Map<number, string>;
	onFork: (entryId: string) => void;
	sessionId: string;
	globalStreaming: boolean;
}) {
	switch (entry.type) {
		case "user":
			return (
				<UserRow
					content={entry.message.content}
					forkEntryId={forkEntryIds.get(entry.userIndex)}
					onFork={onFork}
				/>
			);
		case "assistantText":
			return (
				<AssistantTextRow entry={entry} sessionId={sessionId} globalStreaming={globalStreaming} />
			);
		case "thinking":
			return <ThinkingRow entry={entry} />;
		case "assistantImage":
			return <AssistantImageRow entry={entry} />;
		case "toolCall":
			return (
				<ToolCallRow
					toolName={entry.toolName}
					toolCallId={entry.toolCallId}
					args={entry.args}
					status={toolStatus(entry.toolCallId, toolResults, activeTools)}
				/>
			);
		case "toolResult":
			return <ToolResultRow message={entry.message} />;
		case "assistantError":
			return <AssistantErrorNotice stopReason={entry.stopReason} message={entry.message} />;
		case "custom":
			return <CustomRow data={entry.message} />;
		case "liveTool":
			return (
				<ToolCallRow
					toolName={entry.execution.toolName}
					toolCallId={entry.execution.toolCallId}
					args={entry.execution.args}
					status={entry.execution.status}
					live
				/>
			);
		default:
			return null;
	}
}

function PendingSubmissionTurn({ submission }: { submission: PendingSubmission }) {
	return (
		<>
			<UserRow content={submission.content} forkEntryId={undefined} onFork={undefined} />
			<Message from="assistant">
				<MessageContent className="w-full max-w-full">
					<div className="flex items-center gap-2 rounded-[18px] border border-border/40 bg-card/50 px-4 py-3 text-[13px] text-muted-foreground shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
						<Sparkles className="size-4 text-primary" />
						<Shimmer>{translate("timeline.preparingNextStep")}</Shimmer>
					</div>
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
	const text = extractTextFromContent(content);
	const images = extractImagesFromContent(content);
	return (
		<Message from="user" className="group/user">
			<div className="relative max-w-[80%]">
				<MessageContent className="flex flex-col items-stretch gap-3">
					{images.map((img, i) => (
						<img
							key={`${img.mimeType}-${i}`}
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
				<div
					className={cn(
						"absolute -right-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1",
						"opacity-0 transition-opacity duration-150 group-hover/user:opacity-100 focus-within:opacity-100",
					)}
				>
					{text ? (
						<button
							type="button"
							onClick={() => {
								void navigator.clipboard.writeText(text);
								emitToast(t("timeline.copied"), "info");
							}}
							className="flex items-center gap-1 rounded-full border border-border/40 bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm hover:text-foreground"
							title={t("timeline.copyMessage")}
						>
							<Copy className="size-3" />
						</button>
					) : null}
					{forkEntryId && onFork ? (
						<button
							type="button"
							onClick={() => onFork(forkEntryId)}
							className="flex items-center gap-1 rounded-full border border-primary/20 bg-card px-2 py-1 text-[10px] font-medium text-primary/70 shadow-sm hover:text-primary"
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

function AssistantTextRow({
	entry,
	sessionId,
	globalStreaming,
}: {
	entry: Extract<TranscriptEntry, { type: "assistantText" }>;
	sessionId: string;
	globalStreaming: boolean;
}) {
	const { t } = useI18n();
	const [regenerating, setRegenerating] = useState(false);

	async function handleCopy() {
		await navigator.clipboard.writeText(entry.text);
		emitToast(t("timeline.copied"), "info");
	}

	async function handleRegenerate() {
		if (globalStreaming || !entry.precedingUserText) return;
		setRegenerating(true);
		try {
			await pi.rpc.send(sessionId, {
				type: "prompt",
				message: entry.precedingUserText,
			} as any);
		} catch (e) {
			emitToast(
				translate("toast.forkFailed", { error: e instanceof Error ? e.message : String(e) }),
			);
		} finally {
			setRegenerating(false);
		}
	}

	return (
		<Message from="assistant">
			<div className="group/assistant relative min-w-0 max-w-full">
				<MessageContent className="w-full max-w-full py-1">
					<MessageResponse>{entry.text}</MessageResponse>
					{entry.model || entry.stopReason ? (
						<div className="mt-2 text-[11px] font-medium text-muted-foreground/55">
							{entry.model ?? ""}
							{entry.stopReason && entry.stopReason !== "stop" ? ` · ${entry.stopReason}` : ""}
						</div>
					) : null}
				</MessageContent>
				<div className="absolute -right-1 bottom-1 z-10 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/assistant:opacity-100 focus-within:opacity-100">
					<button
						type="button"
						onClick={handleCopy}
						className="flex items-center gap-1 rounded-full border border-border/40 bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm hover:text-foreground"
						title={t("timeline.copyMessage")}
					>
						<Copy className="size-3" />
					</button>
					<button
						type="button"
						onClick={handleRegenerate}
						disabled={globalStreaming || !entry.precedingUserText || regenerating}
						className="flex items-center gap-1 rounded-full border border-border/40 bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
						title={t("timeline.regenerate")}
					>
						<RotateCcw className={cn("size-3", regenerating && "animate-spin")} />
					</button>
				</div>
			</div>
		</Message>
	);
}

function ThinkingRow({ entry }: { entry: Extract<TranscriptEntry, { type: "thinking" }> }) {
	const [open, setOpen] = useState(false);
	return (
		<Message from="assistant">
			<MessageContent className="w-full max-w-full py-1">
				<div className="rounded-[18px] border border-border/40 bg-card/45 px-4 py-3 text-[13px] text-muted-foreground shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
					<button
						type="button"
						onClick={() => setOpen((value) => !value)}
						className="flex w-full items-center gap-2 text-left font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						<Sparkles className="size-3.5 text-primary/70" />
						<span>{entry.redacted ? "Thinking hidden" : "Thinking"}</span>
						<ChevronDown
							className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")}
						/>
					</button>
					{open ? (
						<div className="mt-3 border-t border-border/50 pt-3 italic leading-6 text-muted-foreground/85">
							<MessageResponse>{entry.text}</MessageResponse>
						</div>
					) : null}
				</div>
			</MessageContent>
		</Message>
	);
}

function AssistantImageRow({
	entry,
}: {
	entry: Extract<TranscriptEntry, { type: "assistantImage" }>;
}) {
	return (
		<Message from="assistant">
			<MessageContent className="w-full max-w-full py-1">
				<img
					alt=""
					src={`data:${entry.mimeType};base64,${entry.data}`}
					className="max-h-96 rounded-[18px] border border-border/50 object-contain shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
				/>
			</MessageContent>
		</Message>
	);
}

function ToolCallRow({
	toolName,
	toolCallId,
	args,
	status,
	live = false,
}: {
	toolName: string;
	toolCallId: string;
	args: Record<string, unknown>;
	status: ToolStatus;
	live?: boolean;
}) {
	const Icon = iconForTool(toolName);
	const summary = summarizeToolCall(toolName, args);
	const tone = statusTone(status);
	return (
		<Message from="assistant">
			<MessageContent className="w-full max-w-full py-1">
				<div
					className={cn(
						"rounded-[18px] border px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.025)]",
						tone.card,
					)}
				>
					<div className="flex min-w-0 items-start gap-3">
						<div
							className={cn(
								"flex size-8 shrink-0 items-center justify-center rounded-[12px]",
								tone.icon,
							)}
						>
							<Icon className="size-4" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex min-w-0 items-center gap-2">
								<div className="truncate text-[13px] font-medium text-foreground">{toolName}</div>
								<span
									className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", tone.badge)}
								>
									{live ? "live" : status}
								</span>
							</div>
							<div className="mt-1 truncate text-[12px] text-muted-foreground">{summary}</div>
							<ToolMetaChips toolName={toolName} args={args} />
							<ToolDetails title="Arguments" value={args} />
						</div>
						<div className="shrink-0 pt-0.5">
							{status === "running" || status === "pending" ? (
								<Sparkles className="size-4 animate-pulse text-primary" />
							) : status === "error" ? (
								<AlertCircle className="size-4 text-destructive" />
							) : (
								<CheckCircle2 className="size-4 text-emerald-600" />
							)}
						</div>
					</div>
					<div className="mt-2 truncate font-mono text-[10px] text-muted-foreground/50">
						{toolCallId}
					</div>
				</div>
			</MessageContent>
		</Message>
	);
}

function ToolResultRow({ message }: { message: Extract<ChatMessage, { role: "toolResult" }> }) {
	const text = extractTextFromContent(message.content);
	const images = extractImagesFromContent(message.content);
	const diff = diffFromDetails(message.details);
	const meta = toolResultMeta(message);
	const truncation = truncationSummary(message.details);
	return (
		<Message from="assistant">
			<MessageContent className="w-full max-w-full py-1">
				<div
					className={cn(
						"rounded-[18px] border px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.025)]",
						message.isError
							? "border-destructive/25 bg-destructive/[0.04]"
							: "border-border/50 bg-background/50",
					)}
				>
					<div className="mb-2 flex min-w-0 items-center gap-2">
						<span
							className={cn(
								"rounded-full px-2 py-0.5 text-[10px] font-medium",
								message.isError
									? "bg-destructive/10 text-destructive"
									: "bg-emerald-500/10 text-emerald-700",
							)}
						>
							{message.isError ? "error" : "result"}
						</span>
						<div className="truncate text-[13px] font-medium text-foreground">
							{message.toolName}
						</div>
						{meta.length > 0 ? (
							<div className="ml-auto hidden min-w-0 shrink-0 items-center gap-1.5 sm:flex">
								{meta.map((item) => (
									<span
										key={item}
										className="max-w-44 truncate rounded-full bg-foreground/[0.045] px-2 py-0.5 text-[10px] text-muted-foreground"
									>
										{item}
									</span>
								))}
							</div>
						) : null}
					</div>
					{images.length > 0 ? (
						<div className="mb-3 flex flex-wrap gap-2">
							{images.map((img, index) => (
								<img
									key={`${img.mimeType}-${index}`}
									alt=""
									src={`data:${img.mimeType};base64,${img.data}`}
									className="max-h-64 rounded-[14px] border border-border/50 object-contain"
								/>
							))}
						</div>
					) : null}
					{truncation ? <ToolNotice>{truncation}</ToolNotice> : null}
					{diff ? (
						<DiffPreview diff={diff} />
					) : text ? (
						<ResultText toolName={message.toolName} text={text} isError={message.isError} />
					) : (
						<div className="text-[12px] text-muted-foreground">
							{translate("timeline.noOutput")}
						</div>
					)}
					<ToolDetails title="Details" value={message.details} />
				</div>
			</MessageContent>
		</Message>
	);
}

function ToolMetaChips({ toolName, args }: { toolName: string; args: Record<string, unknown> }) {
	const chips: string[] = [];
	const path = pathFromArgs(args);
	const pattern = stringArg(args, "pattern") ?? stringArg(args, "query");
	const glob = stringArg(args, "glob");
	const timeout = typeof args.timeout === "number" ? `${args.timeout}ms` : undefined;
	const edits = Array.isArray(args.edits) ? `${args.edits.length} edits` : undefined;
	if (path) chips.push(compactPath(path));
	if (pattern && !path) chips.push(pattern);
	if (glob) chips.push(glob);
	if (edits) chips.push(edits);
	if (timeout && toolName === "bash") chips.push(timeout);
	if (chips.length === 0) return null;
	return (
		<div className="mt-2 flex flex-wrap gap-1.5">
			{chips.map((chip) => (
				<span
					key={chip}
					className="max-w-full truncate rounded-full bg-foreground/[0.045] px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
				>
					{chip}
				</span>
			))}
		</div>
	);
}

function ResultText({
	toolName,
	text,
	isError,
}: {
	toolName: string;
	text: string;
	isError: boolean;
}) {
	const compact = shouldCompactResult(toolName, text);
	return (
		<pre
			className={cn(
				"overflow-auto whitespace-pre-wrap break-words rounded-[14px] border px-3 py-2 font-mono text-[11.5px] leading-5 [overflow-wrap:anywhere]",
				compact ? "max-h-44" : "max-h-80",
				isError
					? "border-destructive/15 bg-destructive/[0.035] text-destructive"
					: "border-border/40 bg-card/45 text-muted-foreground",
			)}
		>
			{text}
		</pre>
	);
}

function DiffPreview({ diff }: { diff: string }) {
	const lines = diff.split("\n");
	const preview = lines.slice(0, 160);
	return (
		<div className="overflow-hidden rounded-[14px] border border-border/50 bg-card/45 font-mono text-[11.5px] leading-5">
			<div className="border-b border-border/40 px-3 py-2 text-[10px] font-medium text-muted-foreground">
				Diff · {diffStatFromPatch(diff) ?? "changes"}
			</div>
			<pre className="max-h-80 overflow-auto py-2">
				{preview.map((line, index) => (
					<div
						key={`${index}-${line}`}
						className={cn(
							"px-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
							line.startsWith("+") &&
								!line.startsWith("+++") &&
								"bg-emerald-500/[0.06] text-emerald-700",
							line.startsWith("-") &&
								!line.startsWith("---") &&
								"bg-destructive/[0.05] text-destructive",
							(line.startsWith("@@") || line.startsWith("diff ")) && "text-primary",
							!line.startsWith("+") &&
								!line.startsWith("-") &&
								!line.startsWith("@@") &&
								"text-muted-foreground",
						)}
					>
						{line || " "}
					</div>
				))}
				{lines.length > preview.length ? (
					<div className="px-3 pt-2 text-muted-foreground/70">
						… {lines.length - preview.length} more lines
					</div>
				) : null}
			</pre>
		</div>
	);
}

function ToolNotice({ children }: { children: React.ReactNode }) {
	return (
		<div className="mb-2 rounded-[12px] border border-amber-400/25 bg-amber-400/[0.055] px-3 py-2 text-[11px] text-amber-700">
			{children}
		</div>
	);
}

function ToolDetails({ title, value }: { title: string; value: unknown }) {
	if (value == null) return null;
	return (
		<details className="mt-2 rounded-[12px] bg-foreground/[0.035] px-3 py-2 text-[11px] text-muted-foreground">
			<summary className="cursor-pointer font-medium text-muted-foreground/85">{title}</summary>
			<pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono leading-5 [overflow-wrap:anywhere]">
				{summarize(value, 2000)}
			</pre>
		</details>
	);
}

function AssistantErrorNotice({ stopReason, message }: { stopReason?: string; message?: string }) {
	const { t } = useI18n();
	const aborted = stopReason === "aborted";
	const title = aborted ? t("timeline.requestAborted") : t("timeline.requestFailed");
	return (
		<Message from="assistant">
			<MessageContent className="w-full max-w-full py-1">
				<div
					className={cn(
						"flex min-w-0 items-start gap-3 rounded-[18px] border px-4 py-3 text-[13px] leading-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]",
						aborted
							? "border-warning/25 bg-warning/5 text-foreground"
							: "border-destructive/25 bg-destructive/5 text-destructive",
					)}
				>
					<AlertCircle className="mt-0.5 size-4 shrink-0" />
					<div className="min-w-0 flex-1">
						<div className="font-medium">{title}</div>
						{message ? (
							<pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11.5px] leading-5 [overflow-wrap:anywhere]">
								{message}
							</pre>
						) : null}
					</div>
				</div>
			</MessageContent>
		</Message>
	);
}

function CustomRow({ data }: { data: ChatMessage & { role: "custom" } }) {
	if (data.subtype === "runtime_event") {
		return <RuntimeEventRow event={data.data} />;
	}

	return (
		<Message from="assistant">
			<MessageContent className="w-full max-w-full py-1">
				<div className="rounded-[18px] border border-border/40 bg-card/50 px-4 py-3 text-[12px] text-muted-foreground shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-xl">
					<div className="font-medium uppercase tracking-[0.08em] opacity-70">{data.subtype}</div>
					<pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 [overflow-wrap:anywhere]">
						{summarize(data.data)}
					</pre>
				</div>
			</MessageContent>
		</Message>
	);
}

function RuntimeEventRow({ event }: { event: unknown }) {
	const { t } = useI18n();
	const display = describeRuntimeEvent(event, t);
	const Icon = display.icon === "retry" ? RefreshCw : display.icon === "error" ? AlertCircle : Info;
	return (
		<Message from="assistant">
			<MessageContent className="w-full max-w-full py-1">
				<div
					className={cn(
						"rounded-[18px] border px-4 py-3 text-[13px] leading-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-xl",
						display.severity === "error" &&
							"border-destructive/25 bg-destructive/5 text-destructive",
						display.severity === "warning" && "border-warning/25 bg-warning/5 text-foreground",
						display.severity === "info" && "border-border/40 bg-card/50 text-muted-foreground",
					)}
				>
					<div className="flex min-w-0 items-start gap-3">
						<Icon
							className={cn(
								"mt-0.5 size-4 shrink-0",
								display.severity === "info" && "text-primary/70",
							)}
						/>
						<div className="min-w-0 flex-1">
							<div className="font-medium text-foreground">{display.title}</div>
							{display.message ? (
								<div className="mt-1 whitespace-pre-wrap break-words text-[12px] [overflow-wrap:anywhere]">
									{display.message}
								</div>
							) : null}
						</div>
					</div>
				</div>
			</MessageContent>
		</Message>
	);
}

interface RuntimeEventDisplay {
	title: string;
	message?: string;
	severity: "info" | "warning" | "error";
	icon: "info" | "retry" | "error";
}

function buildToolResultMap(messages: ChatMessage[]): Map<string, ToolResultInfo> {
	const map = new Map<string, ToolResultInfo>();
	for (const message of messages) {
		if (message.role !== "toolResult") continue;
		map.set(message.toolCallId, {
			toolCallId: message.toolCallId,
			toolName: message.toolName,
			content: message.content,
			isError: message.isError,
			details: message.details,
			timestamp: message.timestamp,
		});
	}
	return map;
}

function buildTranscript(
	messages: ChatMessage[],
	activeTools: Record<string, ToolExecutionState>,
): TranscriptEntry[] {
	const entries: TranscriptEntry[] = [];
	const seenToolCalls = new Set<string>();
	let userIndex = 0;
	let precedingUserText: string | undefined;

	for (let index = 0; index < messages.length; index++) {
		const message = messages[index];
		if (message.role === "user") {
			entries.push({
				type: "user",
				key: `user-${message.timestamp}-${index}`,
				message,
				userIndex,
			});
			precedingUserText = extractTextFromContent(message.content);
			userIndex++;
			continue;
		}

		if (message.role === "assistant") {
			const parts = (message.content ?? []) as Part[];
			for (let partIndex = 0; partIndex < parts.length; partIndex++) {
				const part = parts[partIndex];
				if (part?.type === "text" && part.text.trim()) {
					entries.push({
						type: "assistantText",
						key: `assistant-text-${message.timestamp}-${index}-${partIndex}`,
						text: part.text.trim(),
						timestamp: message.timestamp,
						model: message.model,
						stopReason: message.stopReason,
						precedingUserText,
					});
				} else if (part?.type === "thinking" && part.thinking.trim()) {
					entries.push({
						type: "thinking",
						key: `assistant-thinking-${message.timestamp}-${index}-${partIndex}`,
						text: part.thinking.trim(),
						redacted: part.redacted,
						timestamp: message.timestamp,
					});
				} else if (part?.type === "toolCall") {
					seenToolCalls.add(part.id);
					entries.push({
						type: "toolCall",
						key: `tool-call-${part.id}-${message.timestamp}-${index}-${partIndex}`,
						toolCallId: part.id,
						toolName: part.name,
						args: part.arguments ?? {},
						timestamp: message.timestamp,
					});
				} else if (part?.type === "image") {
					entries.push({
						type: "assistantImage",
						key: `assistant-image-${message.timestamp}-${index}-${partIndex}`,
						data: part.data,
						mimeType: part.mimeType,
						timestamp: message.timestamp,
					});
				}
			}

			if (
				message.stopReason === "error" ||
				message.stopReason === "aborted" ||
				message.errorMessage
			) {
				entries.push({
					type: "assistantError",
					key: `assistant-error-${message.timestamp}-${index}`,
					stopReason: message.stopReason,
					message: message.errorMessage,
					timestamp: message.timestamp,
				});
			}
			continue;
		}

		if (message.role === "toolResult") {
			entries.push({
				type: "toolResult",
				key: `tool-result-${message.toolCallId}-${message.timestamp}-${index}`,
				message,
			});
			continue;
		}

		if (message.role === "custom") {
			entries.push({
				type: "custom",
				key: `custom-${message.subtype}-${message.timestamp}-${index}`,
				message,
			});
		}
	}

	for (const execution of Object.values(activeTools)) {
		if (seenToolCalls.has(execution.toolCallId)) continue;
		entries.push({
			type: "liveTool",
			key: `live-tool-${execution.toolCallId}`,
			execution,
		});
	}

	return entries;
}

function transcriptSearchText(entry: TranscriptEntry): string {
	switch (entry.type) {
		case "user":
			return extractTextFromContent(entry.message.content);
		case "assistantText":
		case "thinking":
			return entry.text;
		case "assistantImage":
			return entry.mimeType;
		case "toolCall":
			return `${entry.toolName} ${summarize(entry.args)}`;
		case "toolResult":
			return `${entry.message.toolName} ${extractTextFromContent(entry.message.content)} ${summarize(entry.message.details)}`;
		case "assistantError":
			return `${entry.stopReason ?? ""} ${entry.message ?? ""}`;
		case "custom":
			return `${entry.message.subtype} ${summarize(entry.message.data)}`;
		case "liveTool":
			return `${entry.execution.toolName} ${summarize(entry.execution.args)}`;
	}
}

function toolStatus(
	toolCallId: string,
	toolResults: Map<string, ToolResultInfo>,
	activeTools: Record<string, ToolExecutionState>,
): ToolStatus {
	const result = toolResults.get(toolCallId);
	if (result?.isError) return "error";
	if (result) return "done";
	const active = activeTools[toolCallId];
	return active?.status ?? "pending";
}

function statusTone(status: ToolStatus) {
	switch (status) {
		case "running":
		case "pending":
			return {
				card: "border-primary/18 bg-primary/[0.035]",
				icon: "bg-primary-soft text-primary",
				badge: "bg-primary/10 text-primary",
			};
		case "error":
			return {
				card: "border-destructive/25 bg-destructive/[0.04]",
				icon: "bg-destructive/10 text-destructive",
				badge: "bg-destructive/10 text-destructive",
			};
		default:
			return {
				card: "border-border/50 bg-background/50",
				icon: "bg-emerald-500/10 text-emerald-700",
				badge: "bg-emerald-500/10 text-emerald-700",
			};
	}
}

function iconForTool(name: string) {
	switch (name) {
		case "bash":
			return Terminal;
		case "edit":
		case "write":
			return FilePen;
		case "read":
		case "ls":
			return FileText;
		case "grep":
		case "find":
			return Search;
		default:
			return Wrench;
	}
}

function toolResultMeta(message: Extract<ChatMessage, { role: "toolResult" }>): string[] {
	const meta: string[] = [];
	const details = asRecord(message.details);
	const fullOutputPath = stringFromRecord(details, "fullOutputPath");
	const firstChangedLine = numberFromRecord(details, "firstChangedLine");
	const matchLimitReached = numberFromRecord(details, "matchLimitReached");
	const resultLimitReached = numberFromRecord(details, "resultLimitReached");
	const entryLimitReached = numberFromRecord(details, "entryLimitReached");
	if (fullOutputPath) meta.push(compactPath(fullOutputPath));
	if (firstChangedLine) meta.push(`line ${firstChangedLine}`);
	if (matchLimitReached) meta.push(`${matchLimitReached} matches`);
	if (resultLimitReached) meta.push(`${resultLimitReached} results`);
	if (entryLimitReached) meta.push(`${entryLimitReached} entries`);
	const diff = diffFromDetails(message.details);
	const stat = diff ? diffStatFromPatch(diff) : undefined;
	if (stat) meta.push(stat);
	return meta;
}

function diffFromDetails(details: unknown): string | undefined {
	const record = asRecord(details);
	return stringFromRecord(record, "diff") ?? stringFromRecord(record, "patch");
}

function truncationSummary(details: unknown): string | undefined {
	const truncation = asRecord(asRecord(details)?.truncation);
	if (!truncation) return undefined;
	const originalBytes = numberFromRecord(truncation, "originalBytes");
	const originalLines = numberFromRecord(truncation, "originalLines");
	const shownBytes = numberFromRecord(truncation, "shownBytes");
	const shownLines = numberFromRecord(truncation, "shownLines");
	const parts = [];
	if (shownLines && originalLines && shownLines < originalLines) {
		parts.push(`${shownLines}/${originalLines} lines shown`);
	}
	if (shownBytes && originalBytes && shownBytes < originalBytes) {
		parts.push(`${formatBytes(shownBytes)}/${formatBytes(originalBytes)} shown`);
	}
	return parts.length > 0 ? `Output truncated · ${parts.join(" · ")}` : "Output truncated";
}

function shouldCompactResult(toolName: string, text: string): boolean {
	return toolName === "read" || toolName === "grep" || toolName === "find" || text.length > 3000;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function stringFromRecord(
	record: Record<string, unknown> | undefined,
	key: string,
): string | undefined {
	const value = record?.[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberFromRecord(
	record: Record<string, unknown> | undefined,
	key: string,
): number | undefined {
	const value = record?.[key];
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function summarizeToolCall(name: string, args: Record<string, unknown>) {
	if (!args || typeof args !== "object") return name;
	if (typeof args.command === "string") return args.command.split("\n")[0] ?? name;
	const path = pathFromArgs(args);
	const pattern = stringArg(args, "pattern") ?? stringArg(args, "query");
	if (path && pattern) return `${compactPath(path)}  ‹${pattern}›`;
	if (path) return compactPath(path);
	if (pattern) return pattern;
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

function extractTextFromContent(content: string | unknown[]): string {
	if (typeof content === "string") return content;
	return (content as Part[])
		.filter((p): p is Part & { type: "text" } => p?.type === "text" && typeof p.text === "string")
		.map((p) => p.text)
		.join("\n");
}

function extractImagesFromContent(
	content: string | unknown[],
): Array<{ data: string; mimeType: string }> {
	if (typeof content === "string") return [];
	return (content as Part[]).filter(
		(p): p is Part & { type: "image" } =>
			p?.type === "image" && typeof p.data === "string" && typeof p.mimeType === "string",
	);
}

function summarize(v: unknown, maxLength = 800): string {
	try {
		const s = typeof v === "string" ? v : JSON.stringify(v, null, 2);
		if (!s) return "";
		return s.length > maxLength ? `${s.slice(0, maxLength)}...` : s;
	} catch {
		return String(v);
	}
}

function describeRuntimeEvent(
	event: unknown,
	t: (key: string, params?: Record<string, string | number>) => string,
): RuntimeEventDisplay {
	const type = stringProp(event, "type");
	switch (type) {
		case "compaction_start": {
			const reason = compactionReasonLabel(stringProp(event, "reason"), t);
			return {
				title: t("timeline.compacting"),
				message: t("timeline.compactionReason", { reason }),
				severity: "info",
				icon: "info",
			};
		}
		case "compaction_end": {
			const errorMessage = stringProp(event, "errorMessage");
			if (errorMessage) {
				return {
					title: t("timeline.compactionFailed"),
					message: errorMessage,
					severity: "error",
					icon: "error",
				};
			}
			if (booleanProp(event, "aborted")) {
				return {
					title: t("timeline.compactionCancelled"),
					severity: "warning",
					icon: "info",
				};
			}
			return {
				title: booleanProp(event, "willRetry")
					? t("timeline.compactionRetrying")
					: t("timeline.compacted"),
				severity: "info",
				icon: "info",
			};
		}
		case "auto_retry_start": {
			const attempt = numberProp(event, "attempt", 1);
			const maxAttempts = numberProp(event, "maxAttempts", attempt);
			const delay = formatDuration(numberProp(event, "delayMs", 0));
			const errorMessage = stringProp(event, "errorMessage") ?? "";
			return {
				title: t("timeline.retrying"),
				message: t("timeline.retryingDetail", {
					attempt,
					maxAttempts,
					delay,
					error: errorMessage,
				}),
				severity: "warning",
				icon: "retry",
			};
		}
		case "auto_retry_end": {
			if (booleanProp(event, "success")) {
				return {
					title: t("timeline.retryRecovered"),
					severity: "info",
					icon: "retry",
				};
			}
			return {
				title: t("timeline.retryFailed"),
				message: stringProp(event, "finalError"),
				severity: "error",
				icon: "error",
			};
		}
		case "extension_error": {
			const extensionPath = stringProp(event, "extensionPath");
			const extensionEvent = stringProp(event, "event");
			const errorMessage = stringProp(event, "error");
			const scope = [extensionPath, extensionEvent].filter(Boolean).join(" · ");
			return {
				title: t("timeline.extensionError"),
				message: [scope, errorMessage].filter(Boolean).join("\n"),
				severity: "error",
				icon: "error",
			};
		}
		default:
			return {
				title: type ?? t("timeline.runtimeEvent"),
				message: summarize(event),
				severity: "info",
				icon: "info",
			};
	}
}

function compactionReasonLabel(
	reason: string | undefined,
	t: (key: string, params?: Record<string, string | number>) => string,
): string {
	switch (reason) {
		case "manual":
			return t("timeline.compactionReasonManual");
		case "threshold":
			return t("timeline.compactionReasonThreshold");
		case "overflow":
			return t("timeline.compactionReasonOverflow");
		default:
			return reason ?? t("timeline.compactionReasonUnknown");
	}
}

function stringProp(value: unknown, key: string): string | undefined {
	if (!value || typeof value !== "object") return undefined;
	const prop = (value as Record<string, unknown>)[key];
	return typeof prop === "string" && prop.length > 0 ? prop : undefined;
}

function numberProp(value: unknown, key: string, fallback: number): number {
	if (!value || typeof value !== "object") return fallback;
	const prop = (value as Record<string, unknown>)[key];
	return typeof prop === "number" && Number.isFinite(prop) ? prop : fallback;
}

function booleanProp(value: unknown, key: string): boolean {
	if (!value || typeof value !== "object") return false;
	return (value as Record<string, unknown>)[key] === true;
}

function formatDuration(ms: number) {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes <= 0) return `${seconds}s`;
	return `${minutes}m ${seconds}s`;
}
