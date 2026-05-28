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
				"group/message flex w-full min-w-0",
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
				"min-w-0 max-w-full text-[14px] leading-6 text-foreground",
				"group-data-[role=user]/message:w-fit",
				"group-data-[role=user]/message:max-w-[76%]",
				"group-data-[role=user]/message:rounded-[22px] group-data-[role=user]/message:rounded-br-[10px]",
				"group-data-[role=user]/message:bg-primary group-data-[role=user]/message:px-4 group-data-[role=user]/message:py-2.5",
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
			className={cn(
				"min-w-0 max-w-full break-words [overflow-wrap:anywhere] [&_*]:max-w-full",
				"[&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_pre]:break-normal",
				"[&_code]:break-words [&_pre_code]:break-normal",
				className,
			)}
			{...props}
		>
			{children}
		</Streamdown>
	);
}
