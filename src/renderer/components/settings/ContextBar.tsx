import { useCallback, useEffect, useState } from "react";
import {
	Context,
	ContextCacheUsage,
	ContextContent,
	ContextContentBody,
	ContextContentFooter,
	ContextContentHeader,
	ContextInputUsage,
	ContextOutputUsage,
	ContextReasoningUsage,
	ContextTrigger,
} from "@/components/ai-elements/context";
import { pi } from "@/lib/rpc";
import { emitToast } from "@/components/ui/toast";

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

	return (
		<Context
			maxTokens={maxTokens}
			modelId={modelId}
			usage={{
				inputTokens: stats.tokens.input,
				outputTokens: stats.tokens.output,
				reasoningTokens: 0,
				cachedInputTokens: stats.tokens.cacheRead,
				totalTokens: stats.tokens.total,
			}}
			usedTokens={usedTokens}
			contextUsage={contextUsage}
		>
			<ContextTrigger />
			<ContextContent>
				<ContextContentHeader />
				<ContextContentBody>
					<ContextInputUsage />
					<ContextOutputUsage />
					<ContextReasoningUsage />
					<ContextCacheUsage />
				</ContextContentBody>
				<ContextContentFooter
					onCompact={handleCompact}
					compacting={compacting}
					cost={stats.cost}
				/>
			</ContextContent>
		</Context>
	);
}
