import { useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
			className="mx-auto w-full max-w-3xl rounded-[32px] border border-border/60 bg-card/95 p-3 shadow-md backdrop-blur-xl transition-all duration-200 focus-within:border-primary/40 focus-within:shadow-lg focus-within:shadow-primary/5"
		>
			<Textarea
				aria-label="Message"
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={onKeyDown}
				placeholder={isStreaming ? "Steer the agent..." : "Ask pi anything..."}
				className="max-h-44 min-h-[60px] w-full text-[14px]"
			/>
			<div className="mt-2 flex items-center gap-3 px-1">
				<div className="flex-1 text-[11px] text-muted-foreground">
					{isStreaming
						? "Send to steer · empty submit to abort"
						: "Enter to send · Shift+Enter for new line"}
				</div>
				<Button
					type="submit"
					size="sm"
					variant={isStreaming && !text.trim() ? "destructive-soft" : "primary"}
					disabled={!text.trim() && !isStreaming}
				>
					{isStreaming && !text.trim() ? <Square className="size-3.5" /> : <Send className="size-3.5" />}
					{isStreaming && !text.trim() ? "Abort" : isStreaming ? "Steer" : "Send"}
				</Button>
			</div>
		</form>
	);
}
