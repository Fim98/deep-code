import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ExtensionUISelectRequest } from "@/lib/rpc";
import { cn } from "@/lib/utils";

interface Props {
	request: ExtensionUISelectRequest;
	onSelect: (value: string) => void;
	onCancel: () => void;
}

export function SelectDialog({ request, onSelect, onCancel }: Props) {
	const [filter, setFilter] = useState("");
	const [highlighted, setHighlighted] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const filtered = useMemo(() => {
		if (!filter) return request.options;
		const q = filter.toLowerCase();
		return request.options.filter((o) => o.toLowerCase().includes(q));
	}, [request.options, filter]);

	useEffect(() => {
		setHighlighted(0);
	}, [filter]);

	const handleSelect = useCallback(
		(value: string) => {
			onSelect(value);
		},
		[onSelect],
	);

	function onKeyDown(e: React.KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setHighlighted((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (filtered[highlighted] !== undefined) handleSelect(filtered[highlighted]);
		} else if (e.key === "Escape") {
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
			<DialogContent className="max-w-[420px] rounded-[16px] p-0">
				<DialogHeader className="border-b border-border/30 px-5 pt-5 pb-3">
					<DialogTitle className="text-[16px] font-medium tracking-tight">
						{request.title}
					</DialogTitle>
				</DialogHeader>

				<div className="px-3 pb-1 pt-1">
					<input
						ref={inputRef}
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder="Search..."
						className="w-full rounded-[10px] border border-border/40 bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
					/>
				</div>

				<div className="max-h-[320px] overflow-y-auto px-2 pb-3">
					{filtered.length === 0 ? (
						<div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
							No matches
						</div>
					) : (
						filtered.map((option, idx) => (
							<button
								key={option}
								type="button"
								onClick={() => handleSelect(option)}
								onMouseEnter={() => setHighlighted(idx)}
								className={cn(
									"flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-75",
									idx === highlighted
										? "bg-foreground/[0.05] text-foreground"
										: "text-foreground/80 hover:bg-foreground/[0.03]",
								)}
							>
								<span className="min-w-0 flex-1 truncate text-[13px]">{option}</span>
								{idx === highlighted ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
							</button>
						))
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
