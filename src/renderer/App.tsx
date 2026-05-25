import { useEffect, useRef, useState } from "react";
import {
	Folder,
	FolderPlus,
	MessageSquare,
	MessageSquarePlus,
	Sparkles,
	Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainArea } from "@/components/layout/MainArea";
import {
	Sidebar,
	SidebarItem,
	SidebarSection,
} from "@/components/layout/Sidebar";
import { Composer } from "@/components/chat/Composer";
import { MessageTimeline } from "@/components/chat/MessageTimeline";
import { BashPanel } from "@/components/panels/BashPanel";
import { ModelPicker } from "@/components/settings/ModelPicker";
import { useSessions } from "@/stores/session-state";
import { pi } from "@/lib/rpc";

type Workspace = Awaited<ReturnType<typeof pi.workspaces.list>>[number];
type SessionInfo = Awaited<ReturnType<typeof pi.sessions.list>>[number];

export function App() {
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [activeWs, setActiveWs] = useState<string | null>(null);
	const [sessions, setSessions] = useState<SessionInfo[]>([]);
	const [activeSid, setActiveSid] = useState<string | null>(null);
	const [activePiSid, setActivePiSid] = useState<string | null>(null);
	const [bashOpen, setBashOpen] = useState(false);

	const { hydrate, attach, setCurrent } = useSessions();
	const slice = useSessions((s) => (activeSid ? s.bySession[activeSid] : null));
	const attachedSids = useRef(new Set<string>());

	useEffect(() => {
		void refreshWorkspaces();
	}, []);

	useEffect(() => {
		setCurrent(activeSid);
	}, [activeSid, setCurrent]);

	async function refreshWorkspaces() {
		const [list, active] = await Promise.all([
			pi.workspaces.list(),
			pi.workspaces.getActive(),
		]);
		setWorkspaces(list);
		setActiveWs(active);
		if (active) await refreshSessions(active);
		else setSessions([]);
	}

	async function refreshSessions(workspaceId: string) {
		const list = await pi.sessions.list(workspaceId);
		setSessions(list);
	}

	async function selectWorkspace(id: string) {
		await pi.workspaces.setActive(id);
		setActiveWs(id);
		await refreshSessions(id);
		setActiveSid(null);
		setActivePiSid(null);
	}

	async function addWorkspace() {
		const path = await pi.workspaces.pickDirectory();
		if (!path) return;
		await pi.workspaces.add(path);
		await refreshWorkspaces();
	}

	async function openSession(sessionFile?: string) {
		if (!activeWs) return;
		const result = await pi.sessions.open({
			workspaceId: activeWs,
			sessionFile,
		});
		const { sessionId, piSessionId } = result;
		setActiveSid(sessionId);
		setActivePiSid(piSessionId);
		await hydrate(sessionId);
		if (!attachedSids.current.has(sessionId)) {
			attach(sessionId);
			attachedSids.current.add(sessionId);
		}
		await refreshSessions(activeWs);
	}

	const activeWorkspace = workspaces.find((w) => w.id === activeWs);

	return (
		<div className="flex h-full w-full">
			<Sidebar>
				<SidebarSection
					title="Workspaces"
					action={
						<Button
							size="iconSm"
							variant="ghost"
							onClick={addWorkspace}
							title="Add workspace"
						>
							<FolderPlus className="size-3.5" />
						</Button>
					}
				>
					{workspaces.length === 0 ? (
						<div className="px-3 py-2 text-[11px] text-muted-foreground/60">
							No workspaces yet
						</div>
					) : (
						workspaces.map((w) => (
							<SidebarItem
								key={w.id}
								active={w.id === activeWs}
								onClick={() => selectWorkspace(w.id)}
								icon={<Folder className="size-3.5" />}
								title={w.name}
								subtitle={w.path.replace(/^\/Users\/[^/]+/, "~")}
								title2={w.path}
							/>
						))
					)}
				</SidebarSection>

				{activeWorkspace ? (
					<SidebarSection
						title="Sessions"
						action={
							<Button
								size="iconSm"
								variant="ghost"
								onClick={() => openSession()}
								title="New session"
							>
								<MessageSquarePlus className="size-3.5" />
							</Button>
						}
					>
						{sessions.length === 0 ? (
							<div className="px-3 py-2 text-[11px] text-muted-foreground/60">
								No sessions in this workspace yet
							</div>
						) : (
							sessions.map((s) => (
								<SidebarItem
									key={s.path}
									active={s.id === activePiSid}
									onClick={() => openSession(s.path)}
									icon={<MessageSquare className="size-3.5" />}
									title={s.name ?? (truncate(s.firstMessage, 36) || "Untitled")}
									subtitle={`${s.messageCount} msg · ${formatTime(s.modified)}`}
									title2={s.firstMessage}
								/>
							))
						)}
					</SidebarSection>
				) : null}
			</Sidebar>

			<MainArea
				header={
					<>
						<span className="text-sm font-semibold text-foreground/90">
							{activeSid
								? slice?.state?.sessionName ?? "Session"
								: "pi · desktop"}
						</span>
						{activeSid ? (
							<ModelPicker
								sessionId={activeSid}
								model={slice?.state?.model as any}
								thinkingLevel={slice?.state?.thinkingLevel as any}
							/>
						) : null}
						{activeSid ? (
							<div className="ml-auto">
								<Button
									size="iconSm"
									variant={bashOpen ? "secondary" : "ghost"}
									onClick={() => setBashOpen((o) => !o)}
									title="Toggle bash panel"
								>
									<Terminal className="size-3.5" />
								</Button>
							</div>
						) : null}
					</>
				}
				footer={
					activeSid ? (
						<Composer
							sessionId={activeSid}
							isStreaming={slice?.isStreaming ?? false}
						/>
					) : null
				}
			>
				{activeSid ? (
					<div className="flex h-full flex-col">
						<div className="min-h-0 flex-1">
							<MessageTimeline sessionId={activeSid} />
						</div>
						{bashOpen ? (
							<div className="shrink-0 px-4 pb-3 pt-1">
								<BashPanel
									sessionId={activeSid}
									onClose={() => setBashOpen(false)}
								/>
							</div>
						) : null}
					</div>
				) : (
					<NoSessionState
						hasWorkspace={!!activeWorkspace}
						onAddWorkspace={addWorkspace}
						onNewSession={() => openSession()}
					/>
				)}
			</MainArea>
		</div>
	);
}

function NoSessionState({
	hasWorkspace,
	onAddWorkspace,
	onNewSession,
}: {
	hasWorkspace: boolean;
	onAddWorkspace: () => void;
	onNewSession: () => void;
}) {
	return (
		<div className="flex h-full flex-col items-center justify-center px-8 text-center">
			<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 text-primary shadow-lg shadow-primary/10">
				<Sparkles className="size-7" />
			</div>
			<h1 className="text-2xl font-semibold tracking-tight">
				Start coding with pi
			</h1>
			<p className="mt-2 max-w-md text-sm text-muted-foreground">
				{hasWorkspace
					? "Open an existing session from the sidebar, or start a fresh one in this workspace."
					: "Add a workspace folder to get started. Each workspace is a project directory where pi can read, edit, and run code."}
			</p>
			<div className="mt-6 flex gap-3">
				{hasWorkspace ? (
					<Button onClick={onNewSession} size="lg">
						<MessageSquarePlus className="size-4" />
						New session
					</Button>
				) : (
					<Button onClick={onAddWorkspace} size="lg">
						<FolderPlus className="size-4" />
						Add workspace
					</Button>
				)}
			</div>
		</div>
	);
}

function truncate(text: string, n: number): string {
	const trimmed = text.replace(/\s+/g, " ").trim();
	return trimmed.length > n ? `${trimmed.slice(0, n - 1)}…` : trimmed;
}

function formatTime(ms: number): string {
	const d = new Date(ms);
	const now = new Date();
	const sameDay =
		d.getFullYear() === now.getFullYear() &&
		d.getMonth() === now.getMonth() &&
		d.getDate() === now.getDate();
	if (sameDay) {
		return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}
	return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
