import { useCallback, useEffect, useState } from "react";
import {
	Button,
	Card,
	Popover,
	ProgressBar,
	Separator,
	Spinner,
} from "@heroui/react";
import { Gauge } from "lucide-react";
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

	// Fetch stats on mount and when sessionId changes
	useEffect(() => {
		void refresh();
	}, [refresh]);

	// Re-fetch after every turn_end event
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
				emitToast("Context compacted successfully");
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
			<Button size="sm" variant="tertiary" className="h-7 gap-1.5 px-2 text-[11px]">
				<Gauge className="size-3.5" />
				{formatTokens(usedTokens)} / {formatTokens(maxTokens)}
			</Button>
			<Popover.Content placement="bottom" className="w-[340px] p-0">
				<Popover.Dialog className="outline-none">
					<Card className="border-0 bg-transparent shadow-none" variant="transparent">
						<Card.Header>
							<Card.Title>Context</Card.Title>
							<Card.Description>
								{modelId ?? "Current session usage"}
							</Card.Description>
						</Card.Header>
						<Card.Content className="space-y-3">
							<ProgressBar aria-label="Context usage" value={progressValue}>
								<ProgressBar.Track>
									<ProgressBar.Fill />
								</ProgressBar.Track>
							</ProgressBar>
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
						</Card.Content>
						<Card.Footer>
							<Button
								fullWidth
								size="sm"
								variant="secondary"
								onPress={handleCompact}
								isDisabled={compacting}
							>
								{compacting ? <Spinner color="current" size="sm" /> : null}
								Compact context
							</Button>
						</Card.Footer>
					</Card>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}

function UsageStat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-xl bg-foreground/[0.04] px-2.5 py-2">
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
