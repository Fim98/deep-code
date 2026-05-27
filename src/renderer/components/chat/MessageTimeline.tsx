import { useMemo } from "react";
import { Activity, Sparkles } from "lucide-react";
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
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { ToolCallCard } from "@/components/chat/ToolCallCard";
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
}

type Part =
	| { type: "text"; text: string }
	| { type: "thinking"; thinking: string; redacted?: boolean }
	| ToolCallPart
	| { type: "image"; data: string; mimeType: string };

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
				{isStreaming ? <StreamingStatus activeTools={activeTools} /> : null}
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
				content={m.content as unknown[]}
				model={m.model}
				stopReason={m.stopReason}
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
			<MessageContent className="flex flex-col items-end gap-3">
				{images.map((img, i) => (
					<img
						key={i}
						alt=""
						src={`data:${img.mimeType};base64,${img.data}`}
						className="max-h-72 rounded-[18px] border border-white/25 object-contain"
					/>
				))}
				{text ? <div className="whitespace-pre-wrap">{text}</div> : null}
			</MessageContent>
		</Message>
	);
}

function AssistantRow({
	content,
	model,
	stopReason,
	toolResults,
	activeTools,
	isStreaming,
}: {
	content: unknown[];
	model?: string;
	stopReason?: string;
	toolResults: Map<string, ToolResultInfo>;
	activeTools: Record<string, ToolExecutionState>;
	isStreaming: boolean;
}) {
	const parts = (content ?? []) as Part[];
	const hasContent = parts.some(
		(p) =>
			(p.type === "text" && p.text) ||
			p.type === "thinking" ||
			p.type === "toolCall",
	);
	if (!hasContent) return null;

	return (
		<Message from="assistant">
			<MessageContent className="flex flex-col gap-4">
				{parts.map((p, i) => {
					if (p.type === "text") {
						if (!p.text) return null;
						return <MessageResponse key={i}>{p.text}</MessageResponse>;
					}
					if (p.type === "thinking") {
						return (
							<ThinkingBlock
								key={i}
								thinking={p.thinking}
								isStreaming={isStreaming}
							/>
						);
					}
					if (p.type === "toolCall") {
						return (
							<ToolCallCard
								key={p.id}
								call={p}
								result={toolResults.get(p.id)}
								execution={activeTools[p.id]}
							/>
						);
					}
					return null;
				})}
				{model || stopReason ? (
					<div className="text-[11px] font-medium text-muted-foreground/55">
						{model ?? ""}
						{stopReason && stopReason !== "stop" ? ` · ${stopReason}` : ""}
					</div>
				) : null}
			</MessageContent>
		</Message>
	);
}

function ThinkingBlock({
	thinking,
	isStreaming,
}: {
	thinking: string;
	isStreaming: boolean;
}) {
	return (
		<Reasoning isStreaming={isStreaming} defaultOpen={isStreaming}>
			<ReasoningTrigger>{isStreaming ? "Thinking..." : "Thinking"}</ReasoningTrigger>
			<ReasoningContent>{thinking || ""}</ReasoningContent>
		</Reasoning>
	);
}

function StreamingStatus({
	activeTools,
}: {
	activeTools: Record<string, ToolExecutionState>;
}) {
	const running = Object.values(activeTools).filter(
		(t) => t.status === "running" || t.status === "pending",
	);
	const label =
		running.length > 0
			? running.map((t) => t.toolName).join(", ")
			: "Working";
	return (
		<div className="flex items-center gap-2 pl-1 text-[12px] text-muted-foreground">
			<Activity className="size-3.5 animate-pulse text-primary" />
			<span>{label}</span>
		</div>
	);
}

function CustomRow({ data }: { data: ChatMessage & { role: "custom" } }) {
	return (
		<Message from="assistant">
			<MessageContent className="max-w-[74%] rounded-[18px] border border-border/40 bg-card/50 px-4 py-3 text-[12px] text-muted-foreground shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-xl">
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
					"max-w-[78%] rounded-[18px] border px-4 py-3 text-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-xl",
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

function summarize(v: unknown): string {
	try {
		const s = JSON.stringify(v, null, 2);
		return s.length > 400 ? `${s.slice(0, 400)}...` : s;
	} catch {
		return String(v);
	}
}
