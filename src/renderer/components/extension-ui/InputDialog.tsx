import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { ExtensionUIInputRequest } from "@/lib/rpc";

interface Props {
	request: ExtensionUIInputRequest;
	onSubmit: (value: string) => void;
	onCancel: () => void;
}

export function InputDialog({ request, onSubmit, onCancel }: Props) {
	const [value, setValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			e.preventDefault();
			if (value.trim()) onSubmit(value.trim());
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
			<DialogContent className="max-w-[420px] rounded-[24px] p-0">
				<DialogHeader className="border-b border-border/30 px-6 pt-6 pb-4">
					<DialogTitle className="text-[16px] font-medium tracking-tight">
						{request.title}
					</DialogTitle>
				</DialogHeader>

				<div className="px-6 py-4">
					<input
						ref={inputRef}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder={request.placeholder ?? "Enter value..."}
						className="w-full rounded-[14px] border border-border/40 bg-background px-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
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
						disabled={!value.trim()}
						onClick={() => onSubmit(value.trim())}
					>
						Submit
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
