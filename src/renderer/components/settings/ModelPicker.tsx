import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { pi } from "@/lib/rpc";
import { useSessions } from "@/stores/session-state";

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
		const resp = await pi.rpc.send(sessionId, {
			type: "set_model",
			provider: m.provider,
			modelId: m.id,
		});
		if (resp.success) {
			await useSessions.getState().hydrate(sessionId);
		}
		setOpen(false);
	}

	async function setThinking(level: ThinkingLevel) {
		const resp = await pi.rpc.send(sessionId, {
			type: "set_thinking_level",
			level,
		});
		if (resp.success) {
			await useSessions.getState().hydrate(sessionId);
		}
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-[11px]">
					<span className="font-medium">
						{model ? `${model.provider}/${model.id}` : "Select model"}
					</span>
					{thinkingLevel && thinkingLevel !== "off" ? (
						<Badge variant="primary" size="sm">
							{thinkingLevel}
						</Badge>
					) : null}
					<ChevronDown className="size-3 opacity-60" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="flex w-[400px] max-h-[420px] max-w-[calc(100vw-24px)] flex-col overflow-hidden p-0"
				style={{ maxHeight: "min(420px, var(--radix-popover-content-available-height))" }}
			>
				<div className="shrink-0 border-b border-border/30 p-2">
					<Input
						autoFocus
						aria-label="Search models"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search models..."
						className="w-full text-[12px] h-8"
					/>
				</div>
				<div className="model-picker-scroll min-h-0 flex-1 overflow-y-auto py-1">
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
								<div key={provider} className="px-1.5 pb-1.5">
									<div className="px-3 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
										{provider}
									</div>
									{list.map((m) => {
										const active =
											model?.provider === m.provider && model.id === m.id;
										return (
											<button
												key={`${m.provider}/${m.id}`}
												onClick={() => pick(m)}
												className={cn(
													"flex min-h-[38px] w-full cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[12px] transition-colors",
													active
														? "bg-foreground/[0.05] text-foreground"
														: "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground",
												)}
											>
												<Check
													className={cn(
														"size-3.5 shrink-0",
														active ? "text-primary" : "opacity-0",
													)}
												/>
												<span className="min-w-0 flex-1 truncate font-medium text-foreground/90">
													{m.name}
												</span>
												{m.reasoning ? (
													<Badge variant="default" size="sm">R</Badge>
												) : null}
												{m.contextWindow ? (
													<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/80">
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
				<div className="shrink-0 border-t border-border/30 p-2">
					<div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
						Thinking
					</div>
					<div className="flex flex-wrap gap-1">
						{THINKING_LEVELS.map((lv) => (
							<button
								key={lv}
								onClick={() => setThinking(lv)}
								className={cn(
									"cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors",
									lv === thinkingLevel
										? "bg-primary text-primary-foreground"
										: "bg-foreground/[0.04] text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground",
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
