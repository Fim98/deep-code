import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { ExtensionUIEditorRequest } from "@/lib/rpc";

interface Props {
	request: ExtensionUIEditorRequest;
	onSubmit: (value: string) => void;
	onCancel: () => void;
}

export function EditorDialog({ request, onSubmit, onCancel }: Props) {
	const [value, setValue] = useState(request.prefill ?? "");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		// Cmd/Ctrl+Enter to submit
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			onSubmit(value);
		}
		if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
		}
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
		>
			<DialogContent className="max-w-[600px] rounded-[16px] p-0">
				<DialogHeader className="border-b border-border/30 px-6 pt-6 pb-4">
					<DialogTitle className="text-[16px] font-medium tracking-tight">
						{request.title}
					</DialogTitle>
					<p className="mt-1 text-[11px] text-muted-foreground">
						⌘+Enter to submit · Esc to cancel
					</p>
				</DialogHeader>

				<div className="px-6 py-4">
					<textarea
						ref={textareaRef}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						onKeyDown={onKeyDown}
						rows={12}
						className="w-full resize-y rounded-[12px] border border-border/40 bg-background px-4 py-3 font-mono text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
					/>
				</div>

				<DialogFooter className="flex-row gap-3 border-t border-border/50 px-6 py-4">
					<Button
						variant="ghost"
						size="md"
						className="flex-1 rounded-full text-[14px]"
						onClick={onCancel}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						size="md"
						className="flex-1 rounded-full text-[14px]"
						onClick={() => onSubmit(value)}
					>
						Submit
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
