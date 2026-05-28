import { Copy, Eraser, FileText, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type LogEntry, pi } from "@/lib/rpc";
import { emitToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function formatTimestamp(ts: number): string {
	const d = new Date(ts);
	return (
		d.toLocaleTimeString("en-US", {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		}) +
		"." +
		String(d.getMilliseconds()).padStart(3, "0")
	);
}

function sourceBadge(source: string): { label: string; className: string } {
	if (source.includes("uncaughtException")) {
		return { label: "FATAL", className: "bg-destructive/10 text-destructive" };
	}
	if (source.includes("unhandledRejection")) {
		return { label: "UNHANDLED", className: "bg-warning/10 text-warning" };
	}
	if (source.includes("settings") || source.includes("auth")) {
		return { label: "WARN", className: "bg-warning/10 text-warning" };
	}
	return { label: "INFO", className: "bg-foreground/[0.06] text-foreground/60" };
}

function EntryRow({ entry }: { entry: LogEntry }) {
	const [expanded, setExpanded] = useState(false);
	const badge = sourceBadge(entry.source);

	return (
		<div className="border-b border-border/20 px-4 py-2.5 last:border-0">
			<div className="flex items-start gap-2">
				<span
					className={cn(
						"mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider",
						badge.className,
					)}
				>
					{badge.label}
				</span>
				<span className="shrink-0 font-mono text-[10px] text-muted-foreground/50">
					{formatTimestamp(entry.timestamp)}
				</span>
				<span className="min-w-0 flex-1 font-mono text-[11px] text-foreground/80 [word-break:break-all]">
					{entry.message}
				</span>
			</div>
			{entry.stack ? (
				<div className="mt-1 pl-[88px]">
					<button
						type="button"
						onClick={() => setExpanded((v) => !v)}
						className="font-mono text-[10px] text-primary/60 hover:text-primary"
					>
						{expanded ? "hide stack" : "show stack"}
					</button>
					{expanded ? (
						<pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground/60">
							{entry.stack}
						</pre>
					) : null}
				</div>
			) : null}
			<div className="mt-0.5 pl-[88px] font-mono text-[9px] text-muted-foreground/40">
				{entry.source}
			</div>
		</div>
	);
}

export function LogViewerDialog({ open, onOpenChange }: Props) {
	const [entries, setEntries] = useState<LogEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const logs = await pi.logs.get();
			setEntries(logs);
		} catch (e) {
			emitToast(`Failed to load logs: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (open) void refresh();
	}, [open, refresh]);

	// Auto-scroll to bottom on new entries
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [entries.length]);

	async function handleClear() {
		try {
			await pi.logs.clear();
			setEntries([]);
			emitToast("Logs cleared", "info");
		} catch (e) {
			emitToast(`Failed to clear logs: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	async function handleCopy() {
		const text = entries
			.map(
				(e) =>
					`[${formatTimestamp(e.timestamp)}] [${e.source}] ${e.message}${e.stack ? "\n" + e.stack : ""}`,
			)
			.join("\n\n");
		try {
			await navigator.clipboard.writeText(text);
			emitToast("Logs copied to clipboard", "info");
		} catch {
			emitToast("Failed to copy logs");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[80vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
				<DialogHeader className="shrink-0 border-b border-border/40 px-6 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex size-9 shrink-0 items-center justify-center rounded-[14px] bg-destructive/10 text-destructive">
								<FileText className="size-4" />
							</div>
							<div>
								<DialogTitle className="text-[18px] font-medium tracking-tight">
									Error Logs
								</DialogTitle>
								<DialogDescription className="text-[12px] text-muted-foreground">
									{entries.length} {entries.length === 1 ? "entry" : "entries"} · last {500} max
								</DialogDescription>
							</div>
						</div>
						<div className="flex items-center gap-1.5">
							<Button
								type="button"
								size="icon-sm"
								variant="ghost"
								onClick={refresh}
								aria-label="Refresh"
								className="size-8 rounded-[12px]"
							>
								<RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
							</Button>
							<Button
								type="button"
								size="icon-sm"
								variant="ghost"
								onClick={handleCopy}
								aria-label="Copy logs"
								disabled={entries.length === 0}
								className="size-8 rounded-[12px]"
							>
								<Copy className="size-3.5" />
							</Button>
							<Button
								type="button"
								size="icon-sm"
								variant="ghost"
								onClick={handleClear}
								aria-label="Clear logs"
								disabled={entries.length === 0}
								className="size-8 rounded-[12px] hover:text-destructive"
							>
								<Eraser className="size-3.5" />
							</Button>
						</div>
					</div>
				</DialogHeader>
				<ScrollArea className="flex-1">
					<div ref={scrollRef} className="min-h-0">
						{entries.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
								<FileText className="size-8 text-muted-foreground/30" />
								<div className="text-[13px] text-muted-foreground">
									{loading ? "Loading…" : "No errors logged"}
								</div>
							</div>
						) : (
							<div>
								{entries.map((entry, i) => (
									<EntryRow key={`${entry.timestamp}-${i}`} entry={entry} />
								))}
							</div>
						)}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
