import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { pi } from "@/lib/rpc";
import { cn } from "@/lib/utils";

interface BashEntry {
	command: string;
	output: string;
	exitCode: number;
	durationMs?: number;
	error?: string;
}

interface Props {
	sessionId: string;
	onClose: () => void;
}

export function BashPanel({ sessionId, onClose }: Props) {
	const [history, setHistory] = useState<BashEntry[]>([]);
	const [input, setInput] = useState("");
	const [running, setRunning] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [history.length, running]);

	async function run() {
		const cmd = input.trim();
		if (!cmd || running) return;
		setInput("");
		setRunning(true);
		const t0 = performance.now();
		const resp = await pi.rpc.send(sessionId, { type: "bash", command: cmd });
		const durationMs = Math.round(performance.now() - t0);
		setRunning(false);
		if (resp.success && resp.command === "bash") {
			const data = resp.data as {
				stdout?: string;
				stderr?: string;
				output?: string;
				exitCode?: number;
				error?: string;
			};
			const output =
				data.output ??
				[data.stdout, data.stderr].filter(Boolean).join("\n").trim();
			setHistory((h) => [
				...h,
				{
					command: cmd,
					output,
					exitCode: data.exitCode ?? 0,
					durationMs,
					error: data.error,
				},
			]);
		} else if (!resp.success) {
			setHistory((h) => [
				...h,
				{ command: cmd, output: "", exitCode: -1, error: resp.error },
			]);
		}
		inputRef.current?.focus();
	}

	async function abort() {
		await pi.rpc.send(sessionId, { type: "abort_bash" });
	}

	function onKey(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			e.preventDefault();
			void run();
		}
	}

	return (
		<div className="flex h-[260px] flex-col rounded-xl border border-border/40 bg-background/60 shadow-2xl backdrop-blur-xl">
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/30 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
				<span>Bash</span>
				<span className="text-muted-foreground/40">·</span>
				<span className="font-mono lowercase tracking-normal text-muted-foreground/60">
					{running ? "running…" : "idle"}
				</span>
				<div className="ml-auto flex items-center gap-1">
					{running ? (
						<Button size="iconSm" variant="ghost" onClick={abort} title="Abort">
							<Square className="size-3 fill-current text-destructive" />
						</Button>
					) : null}
					<Button size="iconSm" variant="ghost" onClick={onClose} title="Close">
						<X className="size-3.5" />
					</Button>
				</div>
			</div>
			<ScrollArea className="flex-1">
				<div
					ref={scrollRef}
					className="space-y-2 px-3 py-2 font-mono text-[11.5px]"
				>
					{history.length === 0 ? (
						<div className="px-1 py-2 text-[11px] text-muted-foreground/70">
							No commands yet. Try <span className="text-foreground/80">ls</span> or{" "}
							<span className="text-foreground/80">git status</span>.
						</div>
					) : (
						history.map((h, i) => <BashRow key={i} entry={h} />)
					)}
				</div>
			</ScrollArea>
			<div className="flex shrink-0 items-center gap-2 border-t border-border/30 px-3 py-2">
				<span className="select-none font-mono text-[12px] text-primary">$</span>
				<input
					ref={inputRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={onKey}
					placeholder="Run a bash command…"
					className="flex-1 bg-transparent font-mono text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none"
					disabled={running}
				/>
			</div>
		</div>
	);
}

function BashRow({ entry }: { entry: BashEntry }) {
	const ok = !entry.error && entry.exitCode === 0;
	return (
		<div className="rounded-md border border-border/30 bg-card/30 px-2.5 py-1.5">
			<div className="flex items-center gap-1.5">
				<span className="text-primary">$</span>
				<span className="min-w-0 flex-1 truncate text-foreground/90">
					{entry.command}
				</span>
				<span
					className={cn(
						"text-[10px] tracking-wider",
						ok ? "text-muted-foreground/60" : "text-destructive",
					)}
				>
					{entry.error ? "ERR" : entry.exitCode === 0 ? "0" : `exit ${entry.exitCode}`}
					{entry.durationMs != null ? ` · ${entry.durationMs}ms` : ""}
				</span>
			</div>
			{entry.output ? (
				<pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground/90">
					{entry.output}
				</pre>
			) : null}
			{entry.error ? (
				<div className="mt-1 text-[11px] text-destructive">{entry.error}</div>
			) : null}
		</div>
	);
}
