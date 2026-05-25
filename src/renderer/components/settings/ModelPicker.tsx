import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { pi } from "@/lib/rpc";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

interface ModelRef {
	id: string;
	name: string;
	provider: string;
	contextWindow?: number;
	reasoning?: boolean;
}

const THINKING_LEVELS: ThinkingLevel[] = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
];

interface Props {
	sessionId: string;
	model?: ModelRef;
	thinkingLevel?: ThinkingLevel;
}

export function ModelPicker({ sessionId, model, thinkingLevel }: Props) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [models, setModels] = useState<ModelRef[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!open) return;
		setLoading(true);
		pi.rpc
			.send(sessionId, { type: "get_available_models" })
			.then((r) => {
				if (r.success && r.command === "get_available_models") {
					setModels(r.data.models as ModelRef[]);
				}
			})
			.finally(() => setLoading(false));
	}, [open, sessionId]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return models;
		return models.filter(
			(m) =>
				m.id.toLowerCase().includes(q) ||
				m.name.toLowerCase().includes(q) ||
				m.provider.toLowerCase().includes(q),
		);
	}, [models, query]);

	const grouped = useMemo(() => {
		const map = new Map<string, ModelRef[]>();
		for (const m of filtered) {
			const arr = map.get(m.provider) ?? [];
			arr.push(m);
			map.set(m.provider, arr);
		}
		return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
	}, [filtered]);

	async function pick(m: ModelRef) {
		await pi.rpc.send(sessionId, {
			type: "set_model",
			provider: m.provider,
			modelId: m.id,
		});
		setOpen(false);
	}

	async function setThinking(level: ThinkingLevel) {
		await pi.rpc.send(sessionId, { type: "set_thinking_level", level });
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex items-center gap-1.5 rounded-md border border-border/40 bg-white/[0.04] px-2 py-1 text-[11px] text-foreground/80 transition-colors hover:bg-white/[0.07] hover:text-foreground"
				>
					<span className="font-medium">
						{model ? `${model.provider}/${model.id}` : "Select model"}
					</span>
					{thinkingLevel && thinkingLevel !== "off" ? (
						<span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary">
							{thinkingLevel}
						</span>
					) : null}
					<ChevronDown className="size-3 opacity-60" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[420px] p-0"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<div className="border-b border-border/30 p-2">
					<div className="flex items-center gap-2 rounded-md bg-white/[0.04] px-2 py-1.5">
						<Search className="size-3.5 text-muted-foreground" />
						<input
							autoFocus
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search models…"
							className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none"
						/>
					</div>
				</div>
				<ScrollArea className="max-h-[360px]">
					<div className="py-1">
						{loading ? (
							<div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
								Loading…
							</div>
						) : grouped.length === 0 ? (
							<div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
								No models. Configure auth in <span className="font-mono">~/.pi/agent/auth.json</span>.
							</div>
						) : (
							grouped.map(([provider, list]) => (
								<div key={provider} className="px-1 pb-1">
									<div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
										{provider}
									</div>
									{list.map((m) => {
										const active =
											model?.provider === m.provider && model.id === m.id;
										return (
											<button
												type="button"
												key={`${m.provider}/${m.id}`}
												onClick={() => pick(m)}
												className={cn(
													"flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors",
													active
														? "bg-primary/15 text-foreground"
														: "text-foreground/85 hover:bg-white/[0.05]",
												)}
											>
												<Check
													className={cn(
														"size-3.5 shrink-0",
														active ? "text-primary" : "opacity-0",
													)}
												/>
												<span className="min-w-0 flex-1 truncate">{m.name}</span>
												{m.reasoning ? (
													<span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
														R
													</span>
												) : null}
												{m.contextWindow ? (
													<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
														{formatContext(m.contextWindow)}
													</span>
												) : null}
											</button>
										);
									})}
								</div>
							))
						)}
					</div>
				</ScrollArea>
				<div className="border-t border-border/30 p-2">
					<div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
						Thinking
					</div>
					<div className="flex flex-wrap gap-1">
						{THINKING_LEVELS.map((lv) => (
							<button
								type="button"
								key={lv}
								onClick={() => setThinking(lv)}
								className={cn(
									"rounded-md px-2 py-1 text-[11px] uppercase tracking-wider transition-colors",
									lv === thinkingLevel
										? "bg-primary text-primary-foreground"
										: "bg-white/[0.04] text-foreground/70 hover:bg-white/[0.08]",
								)}
							>
								{lv}
							</button>
						))}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function formatContext(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
	return String(n);
}
