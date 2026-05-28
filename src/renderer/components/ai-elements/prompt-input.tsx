import { ArrowUp, Loader2 } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface PromptInputMessage {
	text: string;
	files?: File[];
}

export interface PromptInputProps
	extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
	onSubmit?: (message: PromptInputMessage, event: React.FormEvent<HTMLFormElement>) => void;
}

export function PromptInput({ className, onSubmit, children, ...props }: PromptInputProps) {
	return (
		<form
			className={cn(
				"mx-auto w-full max-w-3xl rounded-[32px] border border-border/60 bg-card/95 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl",
				"transition-all duration-200 focus-within:border-primary/35 focus-within:shadow-[0_10px_30px_rgba(91,91,247,0.08)]",
				className,
			)}
			onSubmit={(event) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				const text = String(data.get("message") ?? "");
				onSubmit?.({ text }, event);
			}}
			{...props}
		>
			{children}
		</form>
	);
}

export function PromptInputBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("flex min-w-0", className)} {...props} />;
}

export function PromptInputFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("mt-2 flex items-center gap-3 px-1", className)} {...props} />;
}

export function PromptInputTools({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("flex flex-1 items-center gap-2", className)} {...props} />;
}

export const PromptInputTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, name = "message", onInput, rows = 1, ...props }, ref) => {
		const internalRef = React.useRef<HTMLTextAreaElement | null>(null);

		const setRefs = React.useCallback(
			(node: HTMLTextAreaElement | null) => {
				internalRef.current = node;
				if (typeof ref === "function") ref(node);
				else if (ref) ref.current = node;
			},
			[ref],
		);

		const resize = React.useCallback(() => {
			const node = internalRef.current;
			if (!node) return;
			node.style.height = "auto";
			node.style.height = `${Math.min(node.scrollHeight, 176)}px`;
		}, []);

		React.useLayoutEffect(() => {
			resize();
		}, [resize, props.value]);

		return (
			<Textarea
				className={cn(
					"max-h-44 min-h-[56px] flex-1 rounded-[24px] px-4 py-3 text-[14px] leading-6",
					className,
				)}
				name={name}
				onInput={(event) => {
					resize();
					onInput?.(event);
				}}
				ref={setRefs}
				rows={rows}
				{...props}
			/>
		);
	},
);
PromptInputTextarea.displayName = "PromptInputTextarea";

export function PromptInputButton({
	className,
	variant = "ghost",
	size = "sm",
	...props
}: ButtonProps) {
	return <Button className={className} size={size} variant={variant} {...props} />;
}

export interface PromptInputSubmitProps extends Omit<ButtonProps, "type"> {
	status?: "ready" | "submitted" | "streaming" | "error";
}

export function PromptInputSubmit({
	children,
	className,
	status = "ready",
	size = "sm",
	variant = "primary",
	...props
}: PromptInputSubmitProps) {
	const busy = status === "submitted";
	return (
		<Button
			className={cn("min-w-9", className)}
			size={size}
			type="submit"
			variant={variant}
			{...props}
		>
			{children ??
				(busy ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-3.5" />)}
		</Button>
	);
}
