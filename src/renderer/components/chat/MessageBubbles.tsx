import { cn } from "@/lib/utils";

interface TextPart {
	type: "text";
	text: string;
}
interface ThinkingPart {
	type: "thinking";
	thinking: string;
	redacted?: boolean;
}
interface ToolCallPart {
	type: "toolCall";
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}
interface ImagePart {
	type: "image";
	data: string;
	mimeType: string;
}

type Part = TextPart | ThinkingPart | ToolCallPart | ImagePart;

interface UserProps {
	content: string | unknown[];
	timestamp: number;
}

export function UserBubble({ content }: UserProps) {
	const text =
		typeof content === "string"
			? content
			: (content as Part[])
					.filter((p): p is TextPart => (p as Part).type === "text")
					.map((p) => p.text)
					.join("\n");
	const images =
		typeof content === "string"
			? []
			: (content as Part[]).filter(
					(p): p is ImagePart => (p as Part).type === "image",
				);

	return (
		<div className="flex justify-end">
			<div className="flex max-w-[68%] flex-col items-end gap-2">
				{images.map((img, i) => (
					<img
						key={i}
						alt=""
						src={`data:${img.mimeType};base64,${img.data}`}
						className="max-h-72 rounded-xl border border-border/40"
					/>
				))}
				{text ? (
					<div className="whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground shadow-md shadow-primary/20">
						{text}
					</div>
				) : null}
			</div>
		</div>
	);
}

interface AssistantProps {
	content: unknown[];
	model?: string;
	stopReason?: string;
}

export function AssistantBubble({ content, model, stopReason }: AssistantProps) {
	const parts = (content ?? []) as Part[];
	return (
		<div className="flex justify-start">
			<div className="flex max-w-[78%] flex-col gap-2.5">
				{parts.map((p, i) => {
					if (p.type === "text") {
						return (
							<div
								key={i}
								className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-card/70 px-4 py-3 text-[14px] leading-relaxed text-foreground shadow-md ring-1 ring-border/30 backdrop-blur"
							>
								{p.text}
							</div>
						);
					}
					if (p.type === "thinking") {
						return <Reasoning key={i} text={p.thinking} redacted={p.redacted} />;
					}
					if (p.type === "toolCall") {
						return <ToolCallCard key={i} call={p} />;
					}
					return null;
				})}
				{model || stopReason ? (
					<div className="px-1 text-[10px] font-medium tracking-wide text-muted-foreground/60">
						{model ?? ""}
						{stopReason && stopReason !== "stop" ? ` · ${stopReason}` : ""}
					</div>
				) : null}
			</div>
		</div>
	);
}

function Reasoning({ text, redacted }: { text: string; redacted?: boolean }) {
	if (redacted) {
		return (
			<details className="group rounded-xl border border-border/40 bg-card/30 px-3 py-2 text-[12px]">
				<summary className="cursor-pointer select-none text-muted-foreground">
					Thinking (redacted)
				</summary>
			</details>
		);
	}
	return (
		<details className="group rounded-xl border border-border/40 bg-card/30 px-3 py-2 text-[12px] open:bg-card/50">
			<summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground/80">
				Thinking
			</summary>
			<div className="mt-2 whitespace-pre-wrap text-muted-foreground/90">
				{text}
			</div>
		</details>
	);
}

function ToolCallCard({ call }: { call: ToolCallPart }) {
	return (
		<div className="rounded-xl border border-border/40 bg-card/40 px-3.5 py-2.5 text-[12px] backdrop-blur">
			<div className="flex items-center gap-2">
				<span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/70" />
				<span className="font-medium text-foreground/90">{call.name}</span>
				<span className="font-mono text-[10px] text-muted-foreground/60">
					{call.id.slice(-6)}
				</span>
			</div>
			<pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground/90">
				{summarizeArgs(call.arguments)}
			</pre>
		</div>
	);
}

function summarizeArgs(args: Record<string, unknown>): string {
	try {
		const s = JSON.stringify(args, null, 2);
		return s.length > 600 ? `${s.slice(0, 600)}…` : s;
	} catch {
		return String(args);
	}
}

interface ToolResultProps {
	toolName: string;
	content: unknown[];
	isError: boolean;
}

export function ToolResultBubble({ toolName, content, isError }: ToolResultProps) {
	const text = (content as Part[])
		.filter((p): p is TextPart => (p as Part).type === "text")
		.map((p) => p.text)
		.join("\n");
	return (
		<div className="flex justify-start">
			<div
				className={cn(
					"max-w-[78%] rounded-xl border px-3.5 py-2 text-[12px] backdrop-blur",
					isError
						? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
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
