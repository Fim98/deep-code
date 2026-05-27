import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { Button, Disclosure, ScrollShadow } from "@heroui/react";
import { cn } from "@/lib/utils";
import { ToolCallCard } from "@/components/chat/ToolCallCard";
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
		<div className="flex h-full min-h-0 flex-col">
			<ScrollShadow className="min-h-0 flex-1" size={48}>
				<div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
					{messages.length === 0 ? (
						<div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
							<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/10 text-primary shadow-lg shadow-primary/10">
								<Sparkles className="size-7" />
							</div>
							<div className="text-xl font-semibold text-foreground">
								Send a message to begin
							</div>
							<p className="mt-2 max-w-md text-sm text-muted-foreground">
								Ask pi to read, edit, search, or run anything in this workspace.
							</p>
						</div>
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
				</div>
			</ScrollShadow>
		</div>
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
	if (m.role === "assistant") {
		return (
			<AssistantRow
				content={m.content as unknown[]}
				model={m.model}
				stopReason={m.stopReason}
				toolResults={toolResults}
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
		<div className="flex justify-end">
			<div className="flex max-w-[78%] flex-col items-end gap-2">
				{images.map((img, i) => (
					<img
						key={i}
						alt=""
						src={`data:${img.mimeType};base64,${img.data}`}
						className="max-h-72 rounded-md border border-border/40"
					/>
				))}
				{text ? (
					<div className="whitespace-pre-wrap rounded-3xl rounded-br-lg bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground shadow-md shadow-primary/20">
						{text}
					</div>
				) : null}
			</div>
		</div>
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
		<div className="flex justify-start">
			<div className="flex max-w-[86%] flex-col gap-2.5">
				{parts.map((p, i) => {
					if (p.type === "text") {
						if (!p.text) return null;
						return (
							<div
								key={i}
								className="whitespace-pre-wrap rounded-3xl rounded-bl-lg bg-card/70 px-4 py-3 text-[14px] leading-relaxed text-foreground shadow-md ring-1 ring-border/30 backdrop-blur"
							>
								{p.text}
							</div>
						);
					}
					if (p.type === "thinking") {
						return (
							<Disclosure
								key={i}
								className="rounded-2xl border border-border/40 bg-card/30 px-3 py-2 text-[12px]"
							>
								<Disclosure.Heading>
									<Button slot="trigger" size="sm" variant="tertiary" className="h-6 px-0 text-muted-foreground">
										{isStreaming && i === lastIdx ? "Thinking..." : "Thinking"}
										<Disclosure.Indicator />
									</Button>
								</Disclosure.Heading>
								<Disclosure.Content>
									<Disclosure.Body className="mt-2 whitespace-pre-wrap text-muted-foreground/90">
										{p.thinking || ""}
									</Disclosure.Body>
								</Disclosure.Content>
							</Disclosure>
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
			</div>
		</div>
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
		<div className="flex justify-start">
			<div
				className={cn(
					"max-w-[78%] rounded-xl border px-3.5 py-2 text-[12px] backdrop-blur",
					isError
						? "border-destructive/40 bg-destructive/10 text-destructive"
						: "border-border/30 bg-card/30 text-muted-foreground",
				)}
			>
				<div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
					<span className="font-semibold">{toolName}</span>
					<span className="opacity-60">·</span>
					<span>{isError ? "error" : "result"}</span>
				</div>
				<pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px]">
					{text || "(no output)"}
				</pre>
			</div>
		</div>
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
