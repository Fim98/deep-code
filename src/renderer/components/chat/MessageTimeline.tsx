import { useMemo } from "react";
import { Sparkles } from "lucide-react";
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
	OrphanToolResult,
	type ToolResultInfo,
} from "@/components/chat/MessageBubbles";
import { useSessions, type ChatMessage } from "@/stores/session-state";

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

export function MessageTimeline({ sessionId }: Props) {
	const slice = useSessions((s) => s.bySession[sessionId]);
	const messages = slice?.messages ?? [];
	const isStreaming = slice?.isStreaming ?? false;

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
			<ConversationContent className="mx-auto w-full max-w-3xl px-4 py-6">
				{messages.length === 0 ? (
					<ConversationEmptyState
						icon={
							<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/10 text-primary shadow-lg shadow-primary/10">
								<Sparkles className="size-7" />
							</div>
						}
						title="Send a message to begin"
						description="Ask pi to read, edit, search, or run anything in this workspace."
					/>
				) : (
					messages.map((m, i) => (
						<Row
							key={i}
							m={m}
							toolResults={toolResults}
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
	claimed,
	isStreamingLast,
}: {
	m: ChatMessage;
	toolResults: Map<string, ToolResultInfo>;
	claimed: Set<string>;
	isStreamingLast: boolean;
}) {
	if (m.role === "user") return <UserRow content={m.content} />;
	if (m.role === "assistant")
		return (
			<AssistantRow
				content={m.content as unknown[]}
				model={m.model}
				stopReason={m.stopReason}
				toolResults={toolResults}
				isStreaming={isStreamingLast}
			/>
		);
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
			<MessageContent>
				{images.map((img, i) => (
					<img
						key={i}
						alt=""
						src={`data:${img.mimeType};base64,${img.data}`}
						className="max-h-72 rounded-md border border-border/40"
					/>
				))}
				{text ? <MessageResponse>{text}</MessageResponse> : null}
			</MessageContent>
		</Message>
	);
}

function AssistantRow({
	content,
	model,
	stopReason,
	toolResults,
	isStreaming,
}: {
	content: unknown[];
	model?: string;
	stopReason?: string;
	toolResults: Map<string, ToolResultInfo>;
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

	const lastIdx = parts.length - 1;

	return (
		<Message from="assistant">
			<MessageContent>
				{parts.map((p, i) => {
					if (p.type === "text") {
						if (!p.text) return null;
						return <MessageResponse key={i}>{p.text}</MessageResponse>;
					}
					if (p.type === "thinking") {
						return (
							<Reasoning
								key={i}
								isStreaming={isStreaming && i === lastIdx}
								defaultOpen={false}
							>
								<ReasoningTrigger />
								<ReasoningContent>{p.thinking || ""}</ReasoningContent>
							</Reasoning>
						);
					}
					if (p.type === "toolCall") {
						return (
							<ToolCallCard key={p.id} call={p} result={toolResults.get(p.id)} />
						);
					}
					return null;
				})}
				{model || stopReason ? (
					<div className="mt-1 text-[10px] font-medium tracking-wide text-muted-foreground/60">
						{model ?? ""}
						{stopReason && stopReason !== "stop" ? ` · ${stopReason}` : ""}
					</div>
				) : null}
			</MessageContent>
		</Message>
	);
}

function CustomRow({ data }: { data: ChatMessage & { role: "custom" } }) {
	return (
		<div className="rounded-xl border border-border/30 bg-card/40 px-3.5 py-2 text-[11px] text-muted-foreground backdrop-blur">
			<span className="font-semibold uppercase tracking-wider opacity-70">
				{data.subtype}
			</span>
			<pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10.5px]">
				{summarize(data.data)}
			</pre>
		</div>
	);
}

function summarize(v: unknown): string {
	try {
		const s = JSON.stringify(v, null, 2);
		return s.length > 400 ? `${s.slice(0, 400)}…` : s;
	} catch {
		return String(v);
	}
}
