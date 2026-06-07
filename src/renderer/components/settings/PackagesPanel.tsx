import { Download, PackagePlus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { type PiPackageEntry, type PiPackageProgressEvent, pi } from "@/lib/rpc";
import { reloadSessionAndNotify } from "@/lib/session-events";
import { emitToast } from "@/lib/toast";

interface Props {
	cwd: string | undefined;
	sessionId?: string | null;
}

export function PackagesPanel({ cwd, sessionId }: Props) {
	const [items, setItems] = useState<PiPackageEntry[]>([]);
	const [source, setSource] = useState("");
	const [local, setLocal] = useState(false);
	const [loading, setLoading] = useState(false);
	const [busySource, setBusySource] = useState<string | null>(null);
	const [progress, setProgress] = useState<PiPackageProgressEvent[]>([]);

	useEffect(() => {
		void refresh();
	}, [cwd]);

	useEffect(() => {
		return pi.packages.onProgress((event) => {
			setProgress((prev) => [event, ...prev].slice(0, 12));
		});
	}, []);

	async function refresh() {
		if (!cwd) return;
		setLoading(true);
		try {
			setItems(await pi.packages.list(cwd));
		} catch (error) {
			emitToast(formatError(error));
		} finally {
			setLoading(false);
		}
	}

	async function install() {
		if (!cwd || !source.trim()) return;
		setBusySource(source.trim());
		try {
			setProgress([]);
			setItems(await pi.packages.install({ cwd, source: source.trim(), local }));
			setSource("");
			emitPackageChangeToast("Package installed");
		} catch (error) {
			emitToast(formatError(error));
		} finally {
			setBusySource(null);
		}
	}

	async function remove(item: PiPackageEntry) {
		if (!cwd) return;
		setBusySource(item.source);
		try {
			setProgress([]);
			setItems(
				await pi.packages.remove({ cwd, source: item.source, local: item.scope === "project" }),
			);
			emitPackageChangeToast("Package removed");
		} catch (error) {
			emitToast(formatError(error));
		} finally {
			setBusySource(null);
		}
	}

	async function update(source?: string) {
		if (!cwd) return;
		setBusySource(source ?? "*");
		try {
			setProgress([]);
			setItems(await pi.packages.update({ cwd, source }));
			emitPackageChangeToast("Packages updated");
		} catch (error) {
			emitToast(formatError(error));
		} finally {
			setBusySource(null);
		}
	}

	function emitPackageChangeToast(message: string) {
		if (sessionId) {
			emitToast(message, {
				action: { label: "Reload", onClick: () => void reloadSessionAndNotify(sessionId) },
			});
		} else {
			emitToast(message, "info");
		}
	}

	if (!cwd) {
		return (
			<div className="flex h-full items-center justify-center px-8 text-center text-[13px] text-muted-foreground">
				Choose a workspace to manage pi packages.
			</div>
		);
	}

	return (
		<aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-border/50 bg-card/80 backdrop-blur-xl">
			<header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border/40 px-5">
				<div className="flex items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-[14px] bg-primary-soft text-primary">
						<PackagePlus className="size-4" />
					</div>
					<div>
						<div className="text-[14px] font-medium text-foreground">Packages</div>
						<div className="text-[11px] text-muted-foreground">pi package sources</div>
					</div>
				</div>
				<div className="flex gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => update()}
						disabled={!!busySource}
						aria-label="Update packages"
					>
						{busySource === "*" ? <Spinner size="sm" /> : <Download className="size-4" />}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={refresh}
						disabled={loading}
						aria-label="Refresh packages"
					>
						{loading ? <Spinner size="sm" /> : <RefreshCw className="size-4" />}
					</Button>
				</div>
			</header>

			<div className="space-y-4 overflow-auto p-5">
				{progress.length > 0 ? <ProgressLog events={progress} /> : null}
				<div className="rounded-[18px] border border-border/50 bg-background/50 p-4 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
					<form
						className="space-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							void install();
						}}
					>
						<Input
							value={source}
							onChange={(event) => setSource(event.target.value)}
							placeholder="npm package, git URL, or local path"
							className="text-[13px]"
						/>
						<label className="flex items-center gap-2 text-[12px] text-muted-foreground">
							<input
								type="checkbox"
								checked={local}
								onChange={(event) => setLocal(event.target.checked)}
							/>
							Install into project .pi/settings.json
						</label>
						<Button
							type="submit"
							variant="primary"
							size="sm"
							className="w-full rounded-full"
							disabled={!source.trim() || !!busySource}
						>
							{busySource === source.trim() ? (
								<Spinner size="sm" />
							) : (
								<PackagePlus className="size-3.5" />
							)}
							Install package
						</Button>
					</form>
				</div>

				<div className="space-y-2.5">
					{items.map((item) => (
						<PackageRow
							key={`${item.scope}:${item.source}`}
							item={item}
							busy={busySource === item.source}
							onRemove={() => remove(item)}
							onUpdate={() => update(item.source)}
						/>
					))}
					{items.length === 0 ? (
						<div className="rounded-[18px] border border-dashed border-border/60 px-5 py-8 text-center text-[13px] text-muted-foreground">
							No configured pi packages.
						</div>
					) : null}
				</div>
			</div>
		</aside>
	);
}

function ProgressLog({ events }: { events: PiPackageProgressEvent[] }) {
	return (
		<div className="rounded-[18px] border border-border/50 bg-background/50 p-4 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
			<div className="mb-2 text-[12px] font-medium text-foreground">Progress</div>
			<div className="space-y-1.5">
				{events.map((event, index) => (
					<div
						key={`${event.type}-${event.action}-${event.source}-${index}`}
						className="text-[11px] text-muted-foreground"
					>
						<span className="font-medium text-foreground/80">{event.action}</span> · {event.type} ·{" "}
						{event.source}
						{event.message ? <span> — {event.message}</span> : null}
					</div>
				))}
			</div>
		</div>
	);
}

function PackageRow({
	item,
	busy,
	onRemove,
	onUpdate,
}: {
	item: PiPackageEntry;
	busy: boolean;
	onRemove: () => void;
	onUpdate: () => void;
}) {
	return (
		<div className="rounded-[18px] border border-border/50 bg-background/50 p-4 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<div className="truncate text-[13px] font-medium text-foreground">{item.source}</div>
						<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
							{item.scope}
						</span>
					</div>
					<div className="mt-1 truncate text-[11px] text-muted-foreground">
						{item.installedPath ??
							(item.filtered ? "filtered package source" : "not installed yet")}
					</div>
				</div>
				<div className="flex shrink-0 gap-1">
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onUpdate}
						disabled={busy}
						aria-label="Update package"
					>
						{busy ? <Spinner size="sm" /> : <Download className="size-3" />}
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onRemove}
						disabled={busy}
						aria-label="Remove package"
					>
						<Trash2 className="size-3" />
					</Button>
				</div>
			</div>
		</div>
	);
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
