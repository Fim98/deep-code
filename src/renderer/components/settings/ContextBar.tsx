import { Gauge } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/lib/i18n";
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
	const { t } = useI18n();
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
				emitToast(t("context.compactFailed"));
			} else {
				emitToast(t("context.compacted"), "info");
				await refresh();
			}
		} catch (_e) {
			emitToast(t("context.compactFailed"));
		} finally {
			setCompacting(false);
		}
	}

	if (!stats) return null;

	const contextWindow = stats.contextUsage?.contextWindow ?? modelContextWindow ?? null;
	const contextTokens = stats.contextUsage?.tokens ?? null;
	const contextPercent = stats.contextUsage?.percent ?? null;
	const progressValue =
		contextPercent == null || !Number.isFinite(contextPercent)
			? 0
			: Math.max(0, Math.min(100, contextPercent));

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-[11px]">
					<Gauge className="size-3.5" />
					{formatPercentInline(contextPercent)} / {formatTokens(contextWindow)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[320px] rounded-[20px] p-0">
				<div className="space-y-4 p-4">
					<div className="space-y-1">
						<div className="text-[14px] font-medium text-foreground">{t("context.title")}</div>
						<div className="truncate text-[12px] text-muted-foreground">
							{modelId ?? t("context.currentSession")}
						</div>
					</div>

					<div className="rounded-[18px] bg-foreground/[0.03] px-3 py-3">
						<div className="mb-2 flex items-baseline justify-between gap-3">
							<div className="text-[12px] text-muted-foreground">{t("context.load")}</div>
							<div className="text-[12px] font-medium tabular-nums text-foreground">
								{formatPercent(contextPercent)}
							</div>
						</div>
						<Progress value={progressValue} className="h-1.5" />
						{contextPercent == null ? (
							<div className="mt-2 text-[11px] text-muted-foreground">
								{t("context.unknownHint")}
							</div>
						) : (
							<div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
								<span>{t("context.branchEstimate")}</span>
								<span className="tabular-nums">
									{t("context.window", { count: formatTokens(contextWindow) })}
								</span>
							</div>
						)}
					</div>

					<div className="grid grid-cols-2 gap-2 text-[11px]">
						<UsageStat label={t("context.estimate")} value={contextTokens} />
						<UsageStat label={t("context.input")} value={stats.tokens.input} />
						<UsageStat label={t("context.output")} value={stats.tokens.output} />
						<UsageStat label={t("context.cacheRead")} value={stats.tokens.cacheRead} />
						<UsageStat label={t("context.cacheWrite")} value={stats.tokens.cacheWrite} />
					</div>

					<Separator />

					<div className="space-y-2">
						<div className="flex items-center justify-between text-[11px] text-muted-foreground">
							<span>{t("context.totalTokens")}</span>
							<span className="font-mono text-foreground">{formatTokens(stats.tokens.total)}</span>
						</div>
						<div className="flex items-center justify-between text-[11px] text-muted-foreground">
							<span>{t("context.cost")}</span>
							<span className="font-mono text-foreground">${stats.cost.toFixed(4)}</span>
						</div>
					</div>

					<Button
						className="w-full"
						size="sm"
						variant="secondary"
						onClick={handleCompact}
						disabled={compacting}
					>
						{compacting ? <Spinner size="sm" /> : null}
						{t("context.compact")}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function UsageStat({ label, value }: { label: string; value: number | null | undefined }) {
	return (
		<div className="rounded-[14px] bg-foreground/[0.03] px-3 py-2.5">
			<div className="text-muted-foreground/80">{label}</div>
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

function formatPercent(value: number | null | undefined) {
	if (value == null || !Number.isFinite(value)) return "--";
	return `${value.toFixed(1)}%`;
}

function formatPercentInline(value: number | null | undefined) {
	if (value == null || !Number.isFinite(value)) return "?";
	return `${value.toFixed(1)}%`;
}
