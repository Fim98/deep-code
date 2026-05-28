import { Send, Square } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import {
	PromptInput,
	PromptInputBody,
	PromptInputFooter,
	type PromptInputMessage,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { pi } from "@/lib/rpc";
import { useSessions } from "@/stores/session-state";

interface Props {
	sessionId: string;
	isStreaming: boolean;
}

export function Composer({ sessionId, isStreaming }: Props) {
	const [text, setText] = useState("");
	const addPendingSubmission = useSessions((s) => s.addPendingSubmission);
	const removePendingSubmission = useSessions((s) => s.removePendingSubmission);

	async function submit(message?: PromptInputMessage) {
		const content = (message?.text ?? text).trim();
		if (!content) {
			if (isStreaming) {
				await pi.rpc.send(sessionId, { type: "abort" });
			}
			return;
		}
		const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const kind = isStreaming ? "steer" : "prompt";
		addPendingSubmission(sessionId, { id: pendingId, content, kind });
		setText("");
		try {
			const response = await pi.rpc.send(sessionId, {
				type: isStreaming ? "steer" : "prompt",
				message: content,
			});
			if (!response.success) removePendingSubmission(sessionId, pendingId);
		} catch (error) {
			removePendingSubmission(sessionId, pendingId);
			throw error;
		}
	}

	function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		const nativeEvent = e.nativeEvent;
		if (nativeEvent.isComposing || nativeEvent.keyCode === 229) return;
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
						{isStreaming && !text.trim() ? "Abort" : isStreaming ? "Steer" : "Send"}
					</PromptInputSubmit>
				</PromptInputTools>
			</PromptInputFooter>
		</PromptInput>
	);
}
