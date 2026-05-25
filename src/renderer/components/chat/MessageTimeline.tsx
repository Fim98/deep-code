import { useEffect, useMemo, useRef } from "react";
import { useSessions, type ChatMessage } from "@/stores/session-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	AssistantBubble,
	OrphanToolResult,
	UserBubble,
	type ToolResultInfo,
} from "@/components/chat/MessageBubbles";

interface Props {
	sessionId: string;
}

export function MessageTimeline({ sessionId }: Props) {
	const slice = useSessions((s) => s.bySession[sessionId]);
	const scrollRef = useRef<HTMLDivElement>(null);

	const toolResultsMap = useMemo(() => {
		const map = new Map<string, ToolResultInfo>();
		const claimed = new Set<string>();
		if (!slice) return { map, claimed };
		for (const m of slice.messages) {
			if (m.role === "toolResult") {
				map.set(m.toolCallId, {
					toolName: m.toolName,
					content: m.content,
					isError: m.isError,
					details: m.details,
				});
				claimed.add(m.toolCallId);
			}
		}
		return { map, claimed };
	}, [slice?.messages]);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [slice?.messages.length, slice?.isStreaming]);

	if (!slice) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				Loading…
			</div>
		);
	}
	const { messages, isStreaming } = slice;
	const knownToolCallIds = new Set<string>();
	for (const m of messages) {
		if (m.role === "assistant") {
			for (const part of m.content as Array<{ type: string; id?: string }>) {
				if (part.type === "toolCall" && part.id) knownToolCallIds.add(part.id);
			}
		}
	}

	return (
		<ScrollArea className="h-full">
			<div ref={scrollRef} className="mx-auto max-w-3xl space-y-4 px-6 py-6">
				{messages.length === 0 ? (
					<div className="py-20 text-center text-sm text-muted-foreground">
						Send a message to begin.
					</div>
				) : (
					messages.map((m, i) => (
						<MessageRow
							key={i}
							m={m}
							toolResults={toolResultsMap.map}
							skipIfClaimed={knownToolCallIds}
						/>
					))
				)}
				{isStreaming && messages.at(-1)?.role !== "assistant" ? (
					<StreamingIndicator />
				) : null}
			</div>
		</ScrollArea>
	);
}

function MessageRow({
	m,
	toolResults,
	skipIfClaimed,
}: {
	m: ChatMessage;
	toolResults: Map<string, ToolResultInfo>;
	skipIfClaimed: Set<string>;
}) {
	if (m.role === "user")
		return <UserBubble content={m.content} timestamp={m.timestamp} />;
	if (m.role === "assistant")
		return (
			<AssistantBubble
				content={m.content}
				model={m.model}
				stopReason={m.stopReason}
				toolResults={toolResults}
			/>
		);
	if (m.role === "toolResult") {
		// Hide if its tool call is rendered inline by an AssistantBubble
		if (skipIfClaimed.has(m.toolCallId)) return null;
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

function CustomRow({ data }: { data: ChatMessage & { role: "custom" } }) {
	return (
		<div className="rounded-xl border border-border/30 bg-card/30 px-3.5 py-2 text-[11px] text-muted-foreground backdrop-blur">
			<span className="font-semibold uppercase tracking-wider opacity-70">
				{data.subtype}
			</span>
			<pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10.5px]">
				{summarize(data.data)}
			</pre>
		</div>
	);
}

function StreamingIndicator() {
	return (
		<div className="flex items-center gap-1.5 px-2">
			<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
			<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:120ms]" />
			<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:240ms]" />
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
