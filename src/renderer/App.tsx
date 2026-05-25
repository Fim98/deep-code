import { useEffect, useState } from "react";
import { pi } from "@/lib/rpc";

interface LogLine {
	t: number;
	text: string;
}

export function App() {
	const [pong, setPong] = useState<string>("…");
	const [workspaces, setWorkspaces] = useState<Awaited<ReturnType<typeof pi.workspaces.list>>>([]);
	const [activeWs, setActiveWs] = useState<string | null>(null);
	const [sessions, setSessions] = useState<Awaited<ReturnType<typeof pi.sessions.list>>>([]);
	const [activeSid, setActiveSid] = useState<string | null>(null);
	const [logs, setLogs] = useState<LogLine[]>([]);

	const log = (text: string) =>
		setLogs((l) => [...l.slice(-19), { t: Date.now(), text }]);

	useEffect(() => {
		pi.ping().then(setPong).catch((e) => setPong(`error: ${e.message}`));
		refreshWorkspaces();
	}, []);

	async function refreshWorkspaces() {
		const [list, active] = await Promise.all([
			pi.workspaces.list(),
			pi.workspaces.getActive(),
		]);
		setWorkspaces(list);
		setActiveWs(active);
		if (active) await refreshSessions(active);
	}

	async function refreshSessions(workspaceId: string) {
		const list = await pi.sessions.list(workspaceId);
		setSessions(list);
	}

	async function addWorkspace() {
		const path = await pi.workspaces.pickDirectory();
		if (!path) return;
		const ws = await pi.workspaces.add(path);
		log(`+ workspace ${ws.name}`);
		await refreshWorkspaces();
	}

	async function openSession(sessionFile?: string) {
		if (!activeWs) return;
		const { sessionId } = await pi.sessions.open({
			workspaceId: activeWs,
			sessionFile,
		});
		setActiveSid(sessionId);
		log(`session opened ${sessionId.slice(0, 8)}`);
		pi.rpc.subscribe(sessionId, (ev) => {
			const type = (ev as { type?: string }).type ?? "?";
			log(`event ${type}`);
		});
		const state = await pi.rpc.send(sessionId, { type: "get_state" });
		log(`state ${JSON.stringify(state).slice(0, 80)}…`);
	}

	return (
		<div className="flex h-full w-full">
			<aside className="w-[280px] shrink-0 border-r border-border/40 px-4 pb-4 pt-12">
				<div className="select-none text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
					Workspaces
				</div>
				<div className="mt-2 space-y-1">
					{workspaces.map((w) => (
						<button
							type="button"
							key={w.id}
							className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 ${
								w.id === activeWs ? "bg-primary/15 text-foreground" : "text-foreground/80"
							}`}
							onClick={async () => {
								await pi.workspaces.setActive(w.id);
								setActiveWs(w.id);
								await refreshSessions(w.id);
							}}
						>
							{w.name}
							<div className="text-[10px] text-muted-foreground truncate">{w.path}</div>
						</button>
					))}
					<button
						type="button"
						onClick={addWorkspace}
						className="mt-2 w-full rounded-lg border border-dashed border-border/60 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-white/5"
					>
						+ Add workspace
					</button>
				</div>

				<div className="mt-6 select-none text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
					Sessions
				</div>
				<div className="mt-2 space-y-1">
					{sessions.length === 0 && (
						<div className="text-xs text-muted-foreground/60">(none)</div>
					)}
					{sessions.map((s) => (
						<button
							type="button"
							key={s.path}
							className="w-full truncate rounded-lg px-3 py-2 text-left text-xs hover:bg-white/5"
							onClick={() => openSession(s.path)}
							title={s.firstMessage}
						>
							<div className="truncate text-foreground/90">
								{s.name ?? (s.firstMessage.slice(0, 40) || "(empty)")}
							</div>
							<div className="text-[10px] text-muted-foreground">
								{new Date(s.modified).toLocaleString()} · {s.messageCount} msgs
							</div>
						</button>
					))}
					<button
						type="button"
						onClick={() => openSession()}
						className="mt-2 w-full rounded-lg border border-dashed border-border/60 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-white/5"
					>
						+ New session
					</button>
				</div>
			</aside>

			<main className="flex flex-1 flex-col">
				<header
					className="flex h-14 shrink-0 items-center px-6 text-sm font-medium"
					style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
				>
					<span className="pl-16 text-foreground/70">
						pi · {activeSid ? activeSid.slice(0, 8) : "no session"}
					</span>
				</header>
				<section className="flex flex-1 flex-col gap-4 px-8 pb-8">
					<div className="rounded-2xl border border-border/40 bg-card/40 px-6 py-4 shadow-2xl backdrop-blur">
						<div className="text-xs uppercase tracking-wider text-muted-foreground">M2 status</div>
						<div className="mt-1 text-sm">
							ping: <span className="font-mono text-primary">{pong}</span>
						</div>
					</div>
					<div className="flex-1 overflow-auto rounded-2xl border border-border/40 bg-card/40 p-4 font-mono text-[12px] text-foreground/80 shadow-2xl backdrop-blur">
						{logs.length === 0 ? (
							<div className="text-muted-foreground">
								Add a workspace and open a session to see RPC events.
							</div>
						) : (
							logs.map((l) => (
								<div key={l.t} className="border-b border-border/20 py-1">
									<span className="mr-3 text-muted-foreground/60">
										{new Date(l.t).toLocaleTimeString()}
									</span>
									{l.text}
								</div>
							))
						)}
					</div>
				</section>
			</main>
		</div>
	);
}
