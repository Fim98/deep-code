import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pi } from "@/lib/rpc";

interface Props {
	sessionId: string;
	isStreaming: boolean;
}

export function Composer({ sessionId, isStreaming }: Props) {
	const [value, setValue] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	async function send() {
		const text = value.trim();
		if (!text) return;
		setValue("");
		await pi.rpc.send(sessionId, {
			type: isStreaming ? "steer" : "prompt",
			message: text,
		});
		textareaRef.current?.focus();
	}

	async function abort() {
		await pi.rpc.send(sessionId, { type: "abort" });
	}

	function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			void send();
		}
	}

	function autoResize(el: HTMLTextAreaElement) {
		el.style.height = "0px";
		const max = 200;
		el.style.height = `${Math.min(el.scrollHeight, max)}px`;
	}

	return (
		<div className="mx-auto flex max-w-3xl items-end gap-2">
			<div className="flex flex-1 items-end rounded-2xl border border-border/40 bg-card/60 px-4 py-2 shadow-2xl ring-1 ring-foreground/[0.05] backdrop-blur-xl focus-within:border-primary/40 focus-within:ring-primary/30">
				<textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => {
						setValue(e.target.value);
						autoResize(e.target);
					}}
					onKeyDown={onKeyDown}
					placeholder={isStreaming ? "Steer the agent…" : "Ask pi anything…"}
					rows={1}
					className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
				/>
			</div>
			{isStreaming ? (
				<Button
					type="button"
					onClick={abort}
					variant="destructive"
					size="icon"
					title="Abort"
				>
					<Square className="size-3.5 fill-current" />
				</Button>
			) : (
				<Button
					type="button"
					onClick={send}
					size="icon"
					disabled={!value.trim()}
					title="Send (↵)"
				>
					<ArrowUp className="size-4" />
				</Button>
			)}
		</div>
	);
}
