import { useState } from "react";
import {
	PromptInput,
	type PromptInputMessage,
	PromptInputBody,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { pi } from "@/lib/rpc";

interface Props {
	sessionId: string;
	isStreaming: boolean;
}

export function Composer({ sessionId, isStreaming }: Props) {
	const [text, setText] = useState("");

	async function handleSubmit(message: PromptInputMessage) {
		const content = message.text?.trim();
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

	const status: "ready" | "submitted" | "streaming" = isStreaming
		? "streaming"
		: "ready";

	return (
		<PromptInput
			onSubmit={handleSubmit}
			className="mx-auto w-full max-w-3xl rounded-2xl border border-border/60 bg-popover/95 shadow-lg backdrop-blur-xl focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20"
		>
			<PromptInputBody>
				<PromptInputTextarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={isStreaming ? "Steer the agent…" : "Ask pi anything…"}
					className="border-0 bg-transparent text-[14px]"
				/>
			</PromptInputBody>
			<PromptInputFooter className="px-3 pb-2">
				<div className="flex-1 text-[10.5px] text-muted-foreground/70">
					{isStreaming
						? "Send to steer · empty submit to abort"
						: "↵ to send  ·  ⇧↵ for new line"}
				</div>
				<PromptInputSubmit status={status} disabled={!text.trim() && !isStreaming} />
			</PromptInputFooter>
		</PromptInput>
	);
}
