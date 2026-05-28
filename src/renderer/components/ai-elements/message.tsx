import { Streamdown, type StreamdownProps } from "streamdown";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type MessageRole = "user" | "assistant" | "system" | "tool";

export function Message({
	from,
	className,
	...props
}: HTMLAttributes<HTMLDivElement> & { from: MessageRole }) {
	return (
		<div
			data-role={from}
			className={cn(
				"group/message flex w-full",
				from === "user" ? "justify-end" : "justify-start",
				className,
			)}
			{...props}
		/>
	);
}

export function MessageContent({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"w-full max-w-none text-[15px] leading-7 text-foreground",
				"group-data-[role=user]/message:w-fit",
				"group-data-[role=user]/message:max-w-[76%]",
				"group-data-[role=user]/message:rounded-[24px] group-data-[role=user]/message:rounded-br-[10px]",
				"group-data-[role=user]/message:bg-primary group-data-[role=user]/message:px-5 group-data-[role=user]/message:py-3",
				"group-data-[role=user]/message:text-primary-foreground group-data-[role=user]/message:shadow-[0_10px_30px_rgba(91,91,247,0.12)]",
				className,
			)}
			{...props}
		/>
	);
}

export function MessageResponse({
	children,
	className,
	parseIncompleteMarkdown = true,
	...props
}: Omit<StreamdownProps, "children"> & { children: string }) {
	return (
		<Streamdown
			parseIncompleteMarkdown={parseIncompleteMarkdown}
			controls={false}
			lineNumbers={false}
			className={cn(
				"message-response text-[15px] leading-7 text-foreground [&>*]:my-3",
				"[&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline",
				"[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
				"[&_code]:rounded-[8px] [&_code]:bg-foreground/[0.05] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
				"[&_pre]:m-0 [&_pre]:max-w-full [&_pre]:overflow-auto [&_pre]:bg-transparent [&_pre]:p-0",
				"[&_pre_code]:bg-transparent [&_pre_code]:p-0",
				"[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
				"[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
				"[&_li]:my-0.5",
				"[&_p]:my-3 first:[&_p]:mt-0 last:[&_p]:mb-0",
				className,
			)}
			{...props}
		>
			{children}
		</Streamdown>
	);
}
