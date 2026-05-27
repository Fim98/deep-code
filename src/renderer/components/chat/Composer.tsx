import { useState, type KeyboardEvent } from "react";
import { Button, TextArea } from "@heroui/react";
import { Send, Square } from "lucide-react";
import { pi } from "@/lib/rpc";

interface Props {
	sessionId: string;
	isStreaming: boolean;
}

export function Composer({ sessionId, isStreaming }: Props) {
	const [text, setText] = useState("");

	async function submit() {
		const content = text.trim();
		if (!content) {
			if (isStreaming) {
				await pi.rpc.send(sessionId, { type: "abort" });
			}
			return;
		}
		setText("");
		await pi.rpc.send(sessionId, {
			type: isStreaming ? "steer" : "prompt",
			message: content,
		});
	}

	function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void submit();
		}
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
			className="mx-auto w-full max-w-3xl rounded-3xl border border-border/60 bg-popover/95 p-3 shadow-lg backdrop-blur-xl focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20"
		>
			<TextArea
				aria-label="Message"
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={onKeyDown}
				placeholder={isStreaming ? "Steer the agent..." : "Ask pi anything..."}
				className="max-h-44 min-h-20 w-full resize-none border-0 bg-transparent text-[14px] shadow-none"
			/>
			<div className="mt-2 flex items-center gap-3 px-1">
				<div className="flex-1 text-[10.5px] text-muted-foreground/70">
					{isStreaming
						? "Send to steer · empty submit to abort"
						: "Enter to send · Shift+Enter for new line"}
				</div>
				<Button
					type="submit"
					size="sm"
					variant={isStreaming && !text.trim() ? "danger-soft" : "primary"}
					isDisabled={!text.trim() && !isStreaming}
				>
					{isStreaming && !text.trim() ? <Square className="size-3.5" /> : <Send className="size-3.5" />}
					{isStreaming && !text.trim() ? "Abort" : isStreaming ? "Steer" : "Send"}
				</Button>
			</div>
		</form>
	);
}
