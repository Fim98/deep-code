import { Activity, Calendar, Clock, Coins, Database, Layers, Sparkles, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { type DailyStat, type ModelStat, pi, type StatsResult } from "@/lib/rpc";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

function formatCost(n: number): string {
	if (n === 0) return "$0.00";
	if (n < 0.01) return `$${n.toFixed(4)}`;
	return `$${n.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
	const d = new Date(dateStr);
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type TimeRange = "7d" | "30d" | "all";

function filterDays(days: DailyStat[], range: TimeRange): DailyStat[] {
	if (range === "all") return days;
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - (range === "7d" ? 7 : 30));
	return days.filter((d) => new Date(d.date) >= cutoff);
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Dashboard() {
	const { t } = useI18n();
	const [data, setData] = useState<StatsResult | null>(null);
	const [loading, setLoading] = useState(true);
	const [range, setRange] = useState<TimeRange>("30d");

	useEffect(() => {
		pi.stats
			.get()
			.then((result) => {
				setData(result as StatsResult);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, []);

	const filtered = useMemo(() => (data ? filterDays(data.days, range) : []), [data, range]);

	const filteredTotals = useMemo(() => {
		const totals = {
			cost: 0,
			tokens: 0,
			requests: 0,
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
		};
		for (const d of filtered) {
			totals.cost += d.totalCost;
			totals.tokens += d.totalTokens;
			totals.requests += d.requests;
			totals.inputTokens += d.inputTokens;
			totals.outputTokens += d.outputTokens;
			totals.cacheReadTokens += d.cacheReadTokens;
			totals.cacheWriteTokens += d.cacheWriteTokens;
		}
		return totals;
	}, [filtered]);

	// Aggregate models across filtered days
	const filteredModels = useMemo(() => {
		const map = new Map<string, ModelStat>();
		for (const d of filtered) {
			for (const [name, stat] of Object.entries(d.models)) {
				if (!map.has(name)) {
					map.set(name, {
						cost: 0,
						tokens: 0,
						inputTokens: 0,
						outputTokens: 0,
						cacheReadTokens: 0,
						cacheWriteTokens: 0,
						requests: 0,
					});
				}
				const m = map.get(name)!;
				m.cost += stat.cost;
				m.tokens += stat.tokens;
				m.inputTokens += stat.inputTokens;
				m.outputTokens += stat.outputTokens;
				m.cacheReadTokens += stat.cacheReadTokens;
				m.cacheWriteTokens += stat.cacheWriteTokens;
				m.requests += stat.requests;
			}
		}
		return Array.from(map.entries()).sort((a, b) => b[1].cost - a[1].cost);
	}, [filtered]);

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-3 text-muted-foreground">
					<Sparkles className="size-5 animate-pulse" />
					<span className="text-[14px]">{t("dashboard.loading")}</span>
				</div>
			</div>
		);
	}

	if (!data || data.days.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<div className="flex size-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-primary/20 to-primary/10">
					<Database className="size-8 text-primary" />
				</div>
				<div className="text-center">
					<h2 className="text-[18px] font-medium text-foreground">{t("dashboard.empty")}</h2>
					<p className="mt-1 text-[13px] text-muted-foreground">
						{t("dashboard.emptyDescription")}
					</p>
				</div>
			</div>
		);
	}

	const maxDayCost = Math.max(...filtered.map((d) => d.totalCost), 0.001);

	return (
		<ScrollArea className="h-full">
			<div className="mx-auto max-w-[960px] space-y-8 px-8 py-8">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-[28px] font-semibold tracking-tight text-foreground">
							{t("dashboard.title")}
						</h1>
						<p className="mt-1 text-[13px] text-muted-foreground">
							{t("dashboard.subtitle", {
								sessions: data.sessionCount,
								workspaces: data.workspaces.length,
							})}
						</p>
					</div>
					<Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
						<SelectTrigger className="w-[120px] text-[13px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="7d">{t("dashboard.last7Days")}</SelectItem>
							<SelectItem value="30d">{t("dashboard.last30Days")}</SelectItem>
							<SelectItem value="all">{t("dashboard.allTime")}</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Summary cards */}
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<StatCard
						icon={<Coins className="size-4" />}
						label={t("dashboard.totalCost")}
						value={formatCost(filteredTotals.cost)}
						sub={formatCost(data.totalCost) + t("dashboard.allTimeLabel")}
					/>
					<StatCard
						icon={<Zap className="size-4" />}
						label={t("dashboard.totalTokens")}
						value={formatTokens(filteredTotals.tokens)}
						sub={`${t("dashboard.in")}${formatTokens(filteredTotals.inputTokens)} · ${t("dashboard.out")}${formatTokens(filteredTotals.outputTokens)}`}
					/>
					<StatCard
						icon={<Activity className="size-4" />}
						label={t("dashboard.totalRequests")}
						value={String(filteredTotals.requests)}
						sub={`${t("dashboard.avgPerDay")}${filtered.length > 0 ? Math.round(filteredTotals.requests / filtered.length) : 0}`}
					/>
					<StatCard
						icon={<Layers className="size-4" />}
						label={t("dashboard.modelsUsed")}
						value={String(filteredModels.length)}
						sub={filteredModels[0]?.[0] ?? "—"}
					/>
				</div>

				{/* Daily chart */}
				<Card className="rounded-[20px] border border-border/60">
					<CardContent className="p-6">
						<div className="mb-4 flex items-center gap-2">
							<Calendar className="size-4 text-muted-foreground" />
							<h2 className="text-[15px] font-medium">{t("dashboard.dailyUsage")}</h2>
						</div>

						{filtered.length === 0 ? (
							<p className="py-8 text-center text-[13px] text-muted-foreground">
								{t("dashboard.noDataForRange")}
							</p>
						) : (
							<div className="space-y-2">
								{filtered.map((day) => (
									<DailyRow key={day.date} day={day} maxCost={maxDayCost} />
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Model breakdown */}
				<Card className="rounded-[20px] border border-border/60">
					<CardContent className="p-6">
						<div className="mb-4 flex items-center gap-2">
							<Sparkles className="size-4 text-muted-foreground" />
							<h2 className="text-[15px] font-medium">{t("dashboard.modelBreakdown")}</h2>
						</div>

						<div className="space-y-3">
							{filteredModels.map(([name, stat]) => (
								<ModelRow key={name} name={name} stat={stat} totalCost={filteredTotals.cost} />
							))}
						</div>
					</CardContent>
				</Card>

				{/* Token breakdown */}
				<Card className="rounded-[20px] border border-border/60">
					<CardContent className="p-6">
						<div className="mb-4 flex items-center gap-2">
							<Clock className="size-4 text-muted-foreground" />
							<h2 className="text-[15px] font-medium">{t("dashboard.tokenBreakdown")}</h2>
						</div>

						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
							<TokenStat
								label={t("dashboard.input")}
								value={filteredTotals.inputTokens}
								color="bg-blue-500"
							/>
							<TokenStat
								label={t("dashboard.output")}
								value={filteredTotals.outputTokens}
								color="bg-emerald-500"
							/>
							<TokenStat
								label={t("dashboard.cacheRead")}
								value={filteredTotals.cacheReadTokens}
								color="bg-amber-500"
							/>
							<TokenStat
								label={t("dashboard.cacheWrite")}
								value={filteredTotals.cacheWriteTokens}
								color="bg-purple-500"
							/>
						</div>

						{filteredTotals.tokens > 0 && (
							<div className="mt-4 flex h-3 overflow-hidden rounded-full bg-foreground/[0.05]">
								<div
									className="bg-blue-500 transition-all"
									style={{
										width: `${(filteredTotals.inputTokens / filteredTotals.tokens) * 100}%`,
									}}
								/>
								<div
									className="bg-emerald-500 transition-all"
									style={{
										width: `${(filteredTotals.outputTokens / filteredTotals.tokens) * 100}%`,
									}}
								/>
								<div
									className="bg-amber-500 transition-all"
									style={{
										width: `${(filteredTotals.cacheReadTokens / filteredTotals.tokens) * 100}%`,
									}}
								/>
								<div
									className="bg-purple-500 transition-all"
									style={{
										width: `${(filteredTotals.cacheWriteTokens / filteredTotals.tokens) * 100}%`,
									}}
								/>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</ScrollArea>
	);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
	icon,
	label,
	value,
	sub,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	sub: string;
}) {
	return (
		<Card className="rounded-[18px] border border-border/60">
			<CardContent className="p-5">
				<div className="mb-2 flex items-center gap-2 text-muted-foreground">
					{icon}
					<span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
				</div>
				<div className="text-[22px] font-semibold tabular-nums text-foreground">{value}</div>
				<div className="mt-1 truncate text-[11px] text-muted-foreground">{sub}</div>
			</CardContent>
		</Card>
	);
}

function DailyRow({ day, maxCost }: { day: DailyStat; maxCost: number }) {
	const pct = (day.totalCost / maxCost) * 100;
	return (
		<div className="group flex items-center gap-3 rounded-[12px] px-3 py-2 transition-colors hover:bg-foreground/[0.03]">
			<div className="w-16 shrink-0 text-[12px] font-medium text-muted-foreground">
				{formatDate(day.date)}
			</div>
			<div className="relative h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-foreground/[0.04]">
				<div
					className="absolute inset-y-0 left-0 rounded-md bg-primary/20 transition-all"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<div className="flex w-24 shrink-0 justify-end text-[12px] tabular-nums font-medium text-foreground">
				{formatCost(day.totalCost)}
			</div>
			<div className="flex w-20 shrink-0 justify-end text-[11px] tabular-nums text-muted-foreground">
				{formatTokens(day.totalTokens)}
			</div>
			<div className="flex w-12 shrink-0 justify-end">
				<Badge variant="default" className="text-[10px]">
					{day.requests}
				</Badge>
			</div>
		</div>
	);
}

function ModelRow({ name, stat, totalCost }: { name: string; stat: ModelStat; totalCost: number }) {
	const { t } = useI18n();
	const pct = totalCost > 0 ? (stat.cost / totalCost) * 100 : 0;
	return (
		<div className="rounded-[14px] border border-border/40 px-4 py-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-[13px] font-medium text-foreground">{name}</span>
					<Badge variant="default" className="text-[10px]">
						{stat.requests} req
					</Badge>
				</div>
				<div className="text-[14px] font-semibold tabular-nums text-foreground">
					{formatCost(stat.cost)}
				</div>
			</div>
			<div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-foreground/[0.05]">
				<div className="rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
			</div>
			<div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
				<span>
					{formatTokens(stat.inputTokens)} {t("dashboard.input")}
				</span>
				<span>
					{formatTokens(stat.outputTokens)} {t("dashboard.output")}
				</span>
				<span>
					{formatTokens(stat.cacheReadTokens)} {t("dashboard.cacheRead")}
				</span>
				{pct > 0 && <span className="ml-auto font-medium">{pct.toFixed(1)}%</span>}
			</div>
		</div>
	);
}

function TokenStat({ label, value, color }: { label: string; value: number; color: string }) {
	return (
		<div className="rounded-[14px] bg-foreground/[0.03] px-4 py-3">
			<div className="flex items-center gap-2">
				<div className={cn("size-2 rounded-full", color)} />
				<span className="text-[11px] font-medium text-muted-foreground">{label}</span>
			</div>
			<div className="mt-1 text-[16px] font-semibold tabular-nums text-foreground">
				{formatTokens(value)}
			</div>
		</div>
	);
}
