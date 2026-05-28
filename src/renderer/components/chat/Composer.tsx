import { useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import {
	PromptInput,
	PromptInputBody,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
	type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { pi } from "@/lib/rpc";

interface Props {
	sessionId: string;
	isStreaming: boolean;
}

export function Composer({ sessionId, isStreaming }: Props) {
	const [text, setText] = useState("");

	async function submit(message?: PromptInputMessage) {
		const content = (message?.text ?? text).trim();
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
		<PromptInput onSubmit={(message) => void submit(message)}>
			<PromptInputBody>
				<PromptInputTextarea
					aria-label="Message"
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={onKeyDown}
					placeholder={isStreaming ? "Steer the agent..." : "Ask pi anything..."}
				/>
			</PromptInputBody>
			<PromptInputFooter>
				<div className="flex-1 text-[11px] text-muted-foreground">
					{isStreaming
						? "Send to steer · empty submit to abort"
						: "Enter to send · Shift+Enter for new line"}
				</div>
				<PromptInputTools className="flex-none">
					<PromptInputSubmit
						size="sm"
						variant={isStreaming && !text.trim() ? "destructive-soft" : "primary"}
						disabled={!text.trim() && !isStreaming}
						status={isStreaming ? "streaming" : "ready"}
					>
						{isStreaming && !text.trim() ? (
							<Square className="size-3.5" />
						) : (
							<Send className="size-3.5" />
						)}
						{isStreaming && !text.trim()
							? "Abort"
							: isStreaming
								? "Steer"
								: "Send"}
					</PromptInputSubmit>
				</PromptInputTools>
			</PromptInputFooter>
		</PromptInput>
	);
}
