import { type ComponentProps, type ReactNode } from "react";
import {
	CheckCircle2,
	ChevronRight,
	CircleDashed,
	Loader2,
	TriangleAlert,
} from "lucide-react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ToolState =
	| "input-streaming"
	| "input-available"
	| "output-available"
	| "output-error";

export function Tool({
	className,
	...props
}: ComponentProps<typeof Collapsible>) {
	return (
		<Collapsible
			className={cn(
				"overflow-hidden rounded-[18px] border border-border/50 bg-card/65 text-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-xl",
				className,
			)}
			{...props}
		/>
	);
}

export function ToolHeader({
	toolType,
	state,
	title,
	className,
	children,
	...props
}: ComponentProps<typeof CollapsibleTrigger> & {
	toolType: string;
	state: ToolState;
	title?: string;
}) {
	const badge = getStatusBadge(state);
	const displayTitle = title ?? readableToolName(toolType);
	return (
		<CollapsibleTrigger
			className={cn(
				"group flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.035]",
				className,
			)}
			{...props}
		>
			<ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
			<ToolStateIcon state={state} />
			<span className="min-w-0 truncate text-[13px] font-medium text-foreground">
				{displayTitle}
			</span>
			{children ? <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div> : <span className="flex-1" />}
			{badge}
		</CollapsibleTrigger>
	);
}

export function ToolContent({
	className,
	...props
}: ComponentProps<typeof CollapsibleContent>) {
	return (
		<CollapsibleContent
			className={cn(
				"space-y-3 border-t border-border/40 bg-background/35 px-4 py-3",
				className,
			)}
			{...props}
		/>
	);
}

export function ToolInput({
	input,
	className,
	...props
}: ComponentProps<"div"> & { input: unknown }) {
	return (
		<ToolSection label="Input" className={className} {...props}>
			<pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground/75">
				{formatJson(input)}
			</pre>
		</ToolSection>
	);
}

export function ToolOutput({
	output,
	errorText,
	className,
	...props
}: ComponentProps<"div"> & {
	output?: ReactNode;
	errorText?: string;
}) {
	return (
		<ToolSection
			label={errorText ? "Error" : "Output"}
			className={className}
			{...props}
		>
			<div
				className={cn(
					"max-h-72 overflow-auto text-[12px] leading-6",
					errorText ? "text-destructive" : "text-foreground/80",
				)}
			>
				{errorText ? (
					<pre className="whitespace-pre-wrap font-mono text-[11px] leading-5">
						{errorText}
					</pre>
				) : (
					(output ?? <span className="text-muted-foreground">(no output)</span>)
				)}
			</div>
		</ToolSection>
	);
}

function ToolSection({
	label,
	children,
	className,
	...props
}: ComponentProps<"div"> & { label: string }) {
	return (
		<div className={className} {...props}>
			<div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
				{label}
			</div>
			{children}
		</div>
	);
}

function ToolStateIcon({ state }: { state: ToolState }) {
	const className = "size-3.5 shrink-0";
	if (state === "output-error") {
		return <TriangleAlert className={cn(className, "text-destructive")} />;
	}
	if (state === "output-available") {
		return <CheckCircle2 className={cn(className, "text-emerald-500")} />;
	}
	if (state === "input-available") {
		return <Loader2 className={cn(className, "animate-spin text-primary")} />;
	}
	return <CircleDashed className={cn(className, "text-muted-foreground")} />;
}

export function getStatusBadge(state: ToolState) {
	const label =
		state === "input-streaming"
			? "Pending"
			: state === "input-available"
				? "Running"
				: state === "output-available"
					? "Done"
					: "Error";
	return (
		<Badge
			variant={state === "output-error" ? "destructive" : state === "input-available" ? "primary" : "default"}
			size="sm"
			className="shrink-0"
		>
			{label}
		</Badge>
	);
}

function readableToolName(type: string) {
	return type.replace(/^tool-/, "").replaceAll("_", " ");
}

function formatJson(value: unknown) {
	try {
		return JSON.stringify(value ?? {}, null, 2);
	} catch {
		return String(value);
	}
}
