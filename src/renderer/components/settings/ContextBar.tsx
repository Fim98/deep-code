import { useCallback, useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { pi } from "@/lib/rpc";
import { emitToast } from "@/lib/toast";

interface SessionStatsData {
	tokens: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
	cost: number;
	contextUsage?: {
		tokens: number | null;
		contextWindow: number;
		percent: number | null;
	};
}

interface Props {
	sessionId: string;
	modelId?: string;
	modelContextWindow?: number;
}

export function ContextBar({ sessionId, modelId, modelContextWindow }: Props) {
	const [stats, setStats] = useState<SessionStatsData | null>(null);
	const [compacting, setCompacting] = useState(false);

	const refresh = useCallback(async () => {
		try {
			const resp = await pi.rpc.send(sessionId, { type: "get_session_stats" });
			if (resp.success && resp.command === "get_session_stats") {
				setStats(resp.data as SessionStatsData);
			}
		} catch {
			// Silently ignore — stats are non-critical
		}
	}, [sessionId]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		const unsub = pi.rpc.subscribe(sessionId, (ev) => {
			if (ev.type === "turn_end" || ev.type === "agent_end") {
				void refresh();
			}
		});
		return unsub;
	}, [sessionId, refresh]);

	async function handleCompact() {
		setCompacting(true);
		try {
			const resp = await pi.rpc.send(sessionId, { type: "compact" });
			if (!resp.success) {
				emitToast(`Compact failed: ${resp.error}`);
			} else {
				emitToast("Context compacted successfully", "info");
				await refresh();
			}
		} catch (e) {
			emitToast(`Compact failed: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			setCompacting(false);
		}
	}

	if (!stats) return null;

	const maxTokens = stats.contextUsage?.contextWindow ?? modelContextWindow ?? 128_000;
	const usedTokens = stats.contextUsage?.tokens ?? stats.tokens.total;
	const contextUsage = stats.contextUsage
		? {
				tokens: stats.contextUsage.tokens,
				contextWindow: stats.contextUsage.contextWindow,
				percent: stats.contextUsage.percent,
			}
		: undefined;

	const percent = contextUsage?.percent ?? (maxTokens ? usedTokens / maxTokens : null);
	const progressValue = percent == null ? 0 : Math.min(100, Math.round(percent * 100));

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-[11px]">
					<Gauge className="size-3.5" />
					{formatTokens(usedTokens)} / {formatTokens(maxTokens)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[340px] p-0">
				<Card className="border-0 bg-transparent shadow-none">
					<CardHeader>
						<CardTitle>Context</CardTitle>
						<CardDescription>
							{modelId ?? "Current session usage"}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<Progress value={progressValue} className="h-2" />
						<div className="grid grid-cols-2 gap-2 text-[11px]">
							<UsageStat label="Input" value={stats.tokens.input} />
							<UsageStat label="Output" value={stats.tokens.output} />
							<UsageStat label="Cache read" value={stats.tokens.cacheRead} />
							<UsageStat label="Cache write" value={stats.tokens.cacheWrite} />
						</div>
						<Separator />
						<div className="flex items-center justify-between text-[11px] text-muted-foreground">
							<span>Total tokens</span>
							<span className="font-mono text-foreground">{formatTokens(stats.tokens.total)}</span>
						</div>
						<div className="flex items-center justify-between text-[11px] text-muted-foreground">
							<span>Cost</span>
							<span className="font-mono text-foreground">${stats.cost.toFixed(4)}</span>
						</div>
					</CardContent>
					<CardFooter>
						<Button
							className="w-full"
							size="sm"
							variant="secondary"
							onClick={handleCompact}
							disabled={compacting}
						>
							{compacting ? <Spinner size="sm" /> : null}
							Compact context
						</Button>
					</CardFooter>
				</Card>
			</PopoverContent>
		</Popover>
	);
}

function UsageStat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-[14px] bg-foreground/[0.04] px-2.5 py-2">
			<div className="text-muted-foreground">{label}</div>
			<div className="mt-1 font-mono text-foreground">{formatTokens(value)}</div>
		</div>
	);
}

function formatTokens(value: number | null | undefined) {
	if (value == null) return "--";
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
	return String(value);
}
