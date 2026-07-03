import { ChevronRight, Sparkles } from "lucide-react";
import { type ComponentProps, useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function Reasoning({
	isStreaming = false,
	defaultOpen,
	open,
	onOpenChange,
	className,
	children,
	...props
}: ComponentProps<typeof Collapsible> & {
	isStreaming?: boolean;
	defaultOpen?: boolean;
}) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen ?? isStreaming);
	const actualOpen = open ?? internalOpen;

	useEffect(() => {
		if (open !== undefined) return;
		setInternalOpen(isStreaming);
	}, [isStreaming, open]);

	return (
		<Collapsible
			open={actualOpen}
			onOpenChange={(next) => {
				setInternalOpen(next);
				onOpenChange?.(next);
			}}
			className={cn(
				"rounded-[14px] border border-border/50 bg-card/55 px-4 py-3 text-[13px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-xl",
				className,
			)}
			{...props}
		>
			{children}
		</Collapsible>
	);
}

export function ReasoningTrigger({
	className,
	children,
	...props
}: ComponentProps<typeof CollapsibleTrigger>) {
	return (
		<CollapsibleTrigger
			className={cn(
				"group flex w-full cursor-pointer items-center gap-2 text-left text-muted-foreground transition-colors hover:text-foreground",
				className,
			)}
			{...props}
		>
			<ChevronRight className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-90" />
			<Sparkles className="size-3.5 text-primary" />
			<span className="font-medium">{children ?? "Thinking"}</span>
		</CollapsibleTrigger>
	);
}

export function ReasoningContent({
	className,
	...props
}: ComponentProps<typeof CollapsibleContent>) {
	return (
		<CollapsibleContent
			className={cn(
				"mt-3 whitespace-pre-wrap border-t border-border/40 pt-3 text-[13px] leading-6 text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}
