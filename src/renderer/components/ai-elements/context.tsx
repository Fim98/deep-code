"use client";

import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
	BarChart3Icon,
	ChevronDownIcon,
	DatabaseIcon,
	SparklesIcon,
	ZapIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import {
	createContext,
	useContext,
	useMemo,
	useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextUsage {
	/** Estimated context tokens used, or null if unknown */
	tokens: number | null;
	/** Max context window for the current model */
	contextWindow: number;
	/** Percentage [0–100] of context used, or null */
	percent: number | null;
}

export interface TokenUsage {
	/** Total input tokens */
	inputTokens: number;
	/** Total output tokens */
	outputTokens: number;
	/** Tokens used for reasoning */
	reasoningTokens: number;
	/** Tokens read from cache */
	cachedInputTokens: number;
	/** Total tokens (input + output) */
	totalTokens: number;
}

interface ContextValue {
	maxTokens: number;
	modelId: string | undefined;
	usage: TokenUsage;
	usedTokens: number;
	contextUsage: ContextUsage | undefined;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ContextProvider = createContext<ContextValue | null>(null);

function useObjectContext() {
	const ctx = useContext(ContextProvider);
	if (!ctx) throw new Error("Context components must be used within <Context>");
	return ctx;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export type ContextProps = ComponentProps<typeof Popover> & {
	maxTokens: number;
	modelId?: string;
	usage: TokenUsage;
	usedTokens: number;
	contextUsage?: ContextUsage;
};

export const Context = ({
	className,
	maxTokens,
	modelId,
	usage,
	usedTokens,
	contextUsage,
	children,
	...props
}: ContextProps) => {
	const value = useMemo<ContextValue>(
		() => ({ maxTokens, modelId, usage, usedTokens, contextUsage }),
		[maxTokens, modelId, usage, usedTokens, contextUsage],
	);

	return (
		<ContextProvider.Provider value={value}>
			<Popover {...props}>
				{children}
			</Popover>
		</ContextProvider.Provider>
	);
};

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

export type ContextTriggerProps = ComponentProps<typeof PopoverTrigger>;

export const ContextTrigger = ({ className, ...props }: ContextTriggerProps) => {
	const { usedTokens, maxTokens, contextUsage } = useObjectContext();
	const percent = contextUsage?.percent ?? Math.min(100, Math.round((usedTokens / maxTokens) * 100));

	const barColor =
		percent > 90
			? "bg-destructive"
			: percent > 70
				? "bg-yellow-500"
				: "bg-primary";

	const barWidth = `${Math.min(100, percent)}%`;

	return (
		<PopoverTrigger asChild {...props}>
			<button
				type="button"
				className={cn(
					"flex items-center gap-2 rounded-md border border-border/40 bg-foreground/[0.04] px-2.5 py-1 text-[11px] transition-colors hover:bg-foreground/[0.07]",
					className,
				)}
			>
				<div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-foreground/[0.08]">
					<div
						className={cn("h-full rounded-full transition-all duration-500", barColor)}
						style={{ width: barWidth }}
					/>
				</div>
				<span className="tabular-nums text-muted-foreground">
					{formatTokens(usedTokens)}/{formatTokens(maxTokens)}
				</span>
				<ChevronDownIcon className="size-3 opacity-50" />
			</button>
		</PopoverTrigger>
	);
};

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export type ContextContentProps = ComponentProps<typeof PopoverContent>;

export const ContextContent = ({ className, ...props }: ContextContentProps) => (
	<PopoverContent
		align="end"
		className={cn("w-72 p-0", className)}
		{...props}
	/>
);

// ---------------------------------------------------------------------------
// Content Header
// ---------------------------------------------------------------------------

export const ContextContentHeader = ({ className }: { className?: string }) => {
	const { modelId, usedTokens, maxTokens } = useObjectContext();
	const percent = Math.min(100, Math.round((usedTokens / maxTokens) * 100));

	return (
		<div className={cn("border-b border-border/30 px-4 py-3", className)}>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<BarChart3Icon className="size-4 text-muted-foreground" />
					<span className="text-sm font-medium">Context Usage</span>
				</div>
				<Badge
					variant={percent > 90 ? "destructive" : "secondary"}
					className="text-[10px]"
				>
					{percent}%
				</Badge>
			</div>
			{modelId ? (
				<div className="mt-1 text-[11px] text-muted-foreground">{modelId}</div>
			) : null}
			<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
				<div
					className={cn(
						"h-full rounded-full transition-all duration-500",
						percent > 90
							? "bg-destructive"
							: percent > 70
								? "bg-yellow-500"
								: "bg-primary",
					)}
					style={{ width: `${percent}%` }}
				/>
			</div>
			<div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
				<span>{formatTokens(usedTokens)} used</span>
				<span>{formatTokens(maxTokens)} limit</span>
			</div>
		</div>
	);
};

// ---------------------------------------------------------------------------
// Content Body
// ---------------------------------------------------------------------------

export type ContextContentBodyProps = ComponentProps<"div">;

export const ContextContentBody = ({ className, ...props }: ContextContentBodyProps) => (
	<div className={cn("space-y-1 px-4 py-3", className)} {...props} />
);

// ---------------------------------------------------------------------------
// Usage Rows
// ---------------------------------------------------------------------------

function UsageRow({
	icon,
	label,
	value,
	subtitle,
}: {
	icon: ReactNode;
	label: string;
	value: number;
	subtitle?: string;
}) {
	return (
		<div className="flex items-center justify-between py-1.5">
			<div className="flex items-center gap-2">
				<span className="text-muted-foreground">{icon}</span>
				<div>
					<div className="text-[12px] font-medium">{label}</div>
					{subtitle ? (
						<div className="text-[10px] text-muted-foreground">{subtitle}</div>
					) : null}
				</div>
			</div>
			<span className="font-mono text-[12px] tabular-nums">{formatTokens(value)}</span>
		</div>
	);
}

export type ContextInputUsageProps = ComponentProps<"div">;

export const ContextInputUsage = (props: ContextInputUsageProps) => {
	const { usage } = useObjectContext();
	return <UsageRow icon={<DatabaseIcon className="size-3.5" />} label="Input" value={usage.inputTokens} />;
};

export type ContextOutputUsageProps = ComponentProps<"div">;

export const ContextOutputUsage = (props: ContextOutputUsageProps) => {
	const { usage } = useObjectContext();
	return <UsageRow icon={<ZapIcon className="size-3.5" />} label="Output" value={usage.outputTokens} />;
};

export type ContextReasoningUsageProps = ComponentProps<"div">;

export const ContextReasoningUsage = (props: ContextReasoningUsageProps) => {
	const { usage } = useObjectContext();
	if (!usage.reasoningTokens) return null;
	return (
		<UsageRow
			icon={<SparklesIcon className="size-3.5" />}
			label="Reasoning"
			value={usage.reasoningTokens}
		/>
	);
};

export type ContextCacheUsageProps = ComponentProps<"div">;

export const ContextCacheUsage = (props: ContextCacheUsageProps) => {
	const { usage } = useObjectContext();
	if (!usage.cachedInputTokens) return null;
	return (
		<UsageRow
			icon={<DatabaseIcon className="size-3.5" />}
			label="Cache read"
			value={usage.cachedInputTokens}
		/>
	);
};

// ---------------------------------------------------------------------------
// Content Footer
// ---------------------------------------------------------------------------

export type ContextContentFooterProps = ComponentProps<"div"> & {
	onCompact?: () => void;
	compacting?: boolean;
	cost?: number;
};

export const ContextContentFooter = ({
	className,
	onCompact,
	compacting,
	cost,
	...props
}: ContextContentFooterProps) => {
	const { usage } = useObjectContext();

	return (
		<div
			className={cn(
				"flex items-center justify-between border-t border-border/30 px-4 py-2.5",
				className,
			)}
			{...props}
		>
			<div className="text-[11px] text-muted-foreground">
				{cost != null && cost > 0 ? (
					<span className="font-mono tabular-nums">${cost.toFixed(4)}</span>
				) : (
					<span>Total: {formatTokens(usage.totalTokens)} tokens</span>
				)}
			</div>
			{onCompact ? (
				<button
					type="button"
					onClick={onCompact}
					disabled={compacting}
					className={cn(
						"rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
						compacting
							? "cursor-wait text-muted-foreground"
							: "bg-primary/15 text-primary hover:bg-primary/25",
					)}
				>
					{compacting ? "Compacting…" : "Compact now"}
				</button>
			) : null}
		</div>
	);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
	return String(n);
}
