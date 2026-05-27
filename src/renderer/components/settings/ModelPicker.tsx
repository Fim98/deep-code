import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button, Input, Popover, ScrollShadow } from "@heroui/react";
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
		const resp = await pi.rpc.send(sessionId, {
			type: "set_model",
			provider: m.provider,
			modelId: m.id,
		});
		if (resp.success) {
			// pi doesn't emit a model_change AgentEvent; pull the new state
			// so the badge + RpcSessionState in our store stay in sync.
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
		<Popover isOpen={open} onOpenChange={setOpen}>
			<Button size="sm" variant="tertiary" className="h-7 gap-1.5 px-2 text-[11px]">
					<span className="font-medium">
						{model ? `${model.provider}/${model.id}` : "Select model"}
					</span>
					{thinkingLevel && thinkingLevel !== "off" ? (
						<span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary">
							{thinkingLevel}
						</span>
					) : null}
					<ChevronDown className="size-3 opacity-60" />
			</Button>
			<Popover.Content
				placement="bottom start"
				className="w-[420px] p-0"
			>
				<Popover.Dialog className="outline-none">
				<div className="border-b border-border/30 p-2">
					<Input
						autoFocus
						aria-label="Search models"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search models..."
						variant="secondary"
						className="w-full text-[12px]"
					/>
				</div>
				<ScrollShadow className="max-h-[360px]">
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
											<Button
												key={`${m.provider}/${m.id}`}
												variant={active ? "secondary" : "tertiary"}
												onPress={() => pick(m)}
												className={cn(
													"w-full justify-start gap-2 px-2.5 text-left text-[12px]",
													active && "text-accent-soft-foreground",
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
													<span className="shrink-0 rounded bg-foreground/[0.07] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
														R
													</span>
												) : null}
												{m.contextWindow ? (
													<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
														{formatContext(m.contextWindow)}
													</span>
												) : null}
											</Button>
										);
									})}
								</div>
							))
						)}
					</div>
				</ScrollShadow>
				<div className="border-t border-border/30 p-2">
					<div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
						Thinking
					</div>
					<div className="flex flex-wrap gap-1">
						{THINKING_LEVELS.map((lv) => (
							<Button
								key={lv}
								size="sm"
								variant={lv === thinkingLevel ? "primary" : "tertiary"}
								onPress={() => setThinking(lv)}
								className={cn(
									"h-7 px-2 text-[11px] uppercase tracking-wider",
									lv !== thinkingLevel && "text-foreground/70",
								)}
							>
								{lv}
							</Button>
						))}
					</div>
				</div>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}

function formatContext(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
	return String(n);
}
