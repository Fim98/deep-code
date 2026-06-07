import { RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { pi, type SessionToolsData, type ToolInfo } from "@/lib/rpc";
import { onSessionReloaded } from "@/lib/session-events";
import { emitToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
	sessionId: string | null;
}

const READ_ONLY_TOOLS = ["read", "grep", "find", "ls"];
const DEFAULT_TOOLS = ["read", "bash", "edit", "write"];

export function ToolsPanel({ sessionId }: Props) {
	const [data, setData] = useState<SessionToolsData | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		void refresh();
	}, [sessionId]);

	useEffect(() => {
		return onSessionReloaded(({ sessionId: reloadedSessionId }) => {
			if (reloadedSessionId === sessionId) void refresh();
		});
	}, [sessionId]);

	const activeSet = useMemo(() => new Set(data?.active ?? []), [data]);

	async function refresh() {
		if (!sessionId) return;
		setLoading(true);
		try {
			setData(await pi.sessions.getTools(sessionId));
		} catch (error) {
			emitToast(formatError(error));
		} finally {
			setLoading(false);
		}
	}

	async function setActive(toolNames: string[]) {
		if (!sessionId) return;
		setSaving(true);
		try {
			setData(await pi.sessions.setActiveTools(sessionId, toolNames));
			emitToast("Active tools updated", "info");
		} catch (error) {
			emitToast(formatError(error));
		} finally {
			setSaving(false);
		}
	}

	function toggle(name: string, enabled: boolean) {
		const current = new Set(data?.active ?? []);
		if (enabled) current.add(name);
		else current.delete(name);
		void setActive([...current]);
	}

	if (!sessionId) {
		return (
			<div className="flex h-full items-center justify-center px-8 text-center text-[13px] text-muted-foreground">
				Open a session to manage active pi tools.
			</div>
		);
	}

	return (
		<aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border/50 bg-card/80 backdrop-blur-xl">
			<header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border/40 px-5">
				<div className="flex items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-[14px] bg-primary-soft text-primary">
						<ShieldCheck className="size-4" />
					</div>
					<div>
						<div className="text-[14px] font-medium text-foreground">Tools</div>
						<div className="text-[11px] text-muted-foreground">pi active tool set</div>
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={refresh}
					disabled={loading}
					aria-label="Refresh tools"
				>
					{loading ? <Spinner size="sm" /> : <RefreshCw className="size-4" />}
				</Button>
			</header>

			<div className="space-y-4 overflow-auto p-5">
				<div className="grid grid-cols-3 gap-2">
					<PresetButton label="Default" onClick={() => setActive(DEFAULT_TOOLS)} />
					<PresetButton label="Read only" onClick={() => setActive(READ_ONLY_TOOLS)} />
					<PresetButton label="None" onClick={() => setActive([])} />
				</div>

				{loading && !data ? (
					<div className="flex items-center justify-center rounded-[18px] border border-border/50 bg-background/40 p-8">
						<Spinner size="sm" />
					</div>
				) : (
					<div className="space-y-2.5">
						{(data?.tools ?? []).map((tool) => (
							<ToolRow
								key={tool.name}
								tool={tool}
								active={activeSet.has(tool.name)}
								disabled={saving}
								onToggle={(enabled) => toggle(tool.name, enabled)}
							/>
						))}
						{(data?.tools ?? []).length === 0 ? (
							<div className="rounded-[18px] border border-dashed border-border/60 px-5 py-8 text-center text-[13px] text-muted-foreground">
								No tools registered for this session.
							</div>
						) : null}
					</div>
				)}
			</div>
		</aside>
	);
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded-[14px] bg-foreground/[0.04] px-3 py-2 text-[12px] font-medium text-foreground/70 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
		>
			{label}
		</button>
	);
}

function ToolRow({
	tool,
	active,
	disabled,
	onToggle,
}: {
	tool: ToolInfo;
	active: boolean;
	disabled: boolean;
	onToggle: (active: boolean) => void;
}) {
	const source = tool.sourceInfo?.source ?? "unknown";
	return (
		<div className="rounded-[18px] border border-border/50 bg-background/50 p-4 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
			<div className="flex items-start gap-3">
				<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
					<Wrench className="size-3.5" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<div className="truncate text-[13px] font-medium text-foreground">{tool.name}</div>
						<span className="shrink-0 rounded-full bg-foreground/[0.05] px-2 py-0.5 text-[10px] text-muted-foreground">
							{source}
						</span>
					</div>
					<div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
						{tool.description || "No description"}
					</div>
				</div>
				<button
					type="button"
					disabled={disabled}
					onClick={() => onToggle(!active)}
					className={cn(
						"relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
						active ? "bg-primary" : "bg-foreground/15",
					)}
					aria-label={`Toggle ${tool.name}`}
				>
					<span
						className={cn(
							"absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
							active ? "translate-x-5" : "translate-x-0.5",
						)}
					/>
				</button>
			</div>
		</div>
	);
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
