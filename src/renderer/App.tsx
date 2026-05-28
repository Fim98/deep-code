import { useEffect, useMemo, useRef, useState } from "react";
import {
	Folder,
	FolderOpen,
	FolderPlus,
	MessageSquarePlus,
	Search,
	Settings as SettingsIcon,
	Sparkles,
	Terminal,
	Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { ThemeSwitcher } from "@/components/settings/ThemeSwitcher";
import { ContextBar } from "@/components/settings/ContextBar";
import {
	ToastHost,
	emitToast,
	installGlobalErrorToasts,
} from "@/lib/toast";
import { useKeyboardShortcuts } from "@/lib/keyboard";
import { useSessions } from "@/stores/session-state";
import { cn } from "@/lib/utils";
import { pi } from "@/lib/rpc";

type Workspace = Awaited<ReturnType<typeof pi.workspaces.list>>[number];
type SessionInfo = Awaited<ReturnType<typeof pi.sessions.list>>[number];

export function App() {
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [activeWs, setActiveWs] = useState<string | null>(null);
	const [sessionsByWs, setSessionsByWs] = useState<Record<string, SessionInfo[]>>({});
	const [activeSid, setActiveSid] = useState<string | null>(null);
	const [activePiSid, setActivePiSid] = useState<string | null>(null);
	const [bashOpen, setBashOpen] = useState(false);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);

	const { hydrate, attach, setCurrent } = useSessions();
	const slice = useSessions((s) => (activeSid ? s.bySession[activeSid] : null));
	const attachedSids = useRef(new Set<string>());

	useEffect(() => {
		installGlobalErrorToasts();
		void refreshWorkspaces();
	}, []);

	useEffect(() => {
		setCurrent(activeSid);
	}, [activeSid, setCurrent]);

	const shortcuts = useMemo(
		() => [
			{
				key: "n",
				meta: true,
				handler: () => {
					if (activeWs) void openSession();
				},
			},
			{
				key: "b",
				meta: true,
				handler: () => {
					if (activeSid) setBashOpen((o) => !o);
				},
			},
		],
		[activeSid, activeWs],
	);
	useKeyboardShortcuts(shortcuts);

	async function refreshWorkspaces() {
		const [list, active] = await Promise.all([
			pi.workspaces.list(),
			pi.workspaces.getActive(),
		]);
		setWorkspaces(list);
		setActiveWs(active);
		await Promise.all(list.map((w) => refreshSessions(w.id)));
	}

	async function refreshSessions(workspaceId: string) {
		const list = await pi.sessions.list(workspaceId);
		setSessionsByWs((prev) => ({ ...prev, [workspaceId]: list }));
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
		try {
			const result = await pi.sessions.open({
				workspaceId: activeWs,
				sessionFile,
			});
			const { sessionId, piSessionId } = result;
			setActiveSid(sessionId);
			setActivePiSid(piSessionId);
			if (!sessionFile) {
				setSessionsByWs((prev) => {
					const existing = prev[activeWs] ?? [];
					const alreadyListed = existing.some((s) => s.id === piSessionId);
					if (alreadyListed) return prev;
					const placeholder: SessionInfo = {
						id: piSessionId,
						path: result.sessionFile ?? "",
						cwd: "",
						firstMessage: "",
						messageCount: 0,
						created: Date.now(),
						modified: Date.now(),
					};
					return { ...prev, [activeWs]: [placeholder, ...existing] };
				});
			}
			await hydrate(sessionId);
			if (!attachedSids.current.has(sessionId)) {
				attach(sessionId);
				attachedSids.current.add(sessionId);
			}
			await refreshSessions(activeWs);
		} catch (e) {
			emitToast(
				`Failed to open session: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}

	async function deleteSession(workspaceId: string, s: SessionInfo) {
		const ok = window.confirm(
			`Delete session "${s.name ?? (s.firstMessage.slice(0, 40) || "Untitled")}"?\n\nThis removes the session file from disk and cannot be undone.`,
		);
		if (!ok) return;
		try {
			await pi.sessions.delete({ workspaceId, sessionPath: s.path });
			setSessionsByWs((prev) => ({
				...prev,
				[workspaceId]: (prev[workspaceId] ?? []).filter(
					(session) => session.path !== s.path,
				),
			}));
			if (s.id === activePiSid) {
				setActiveSid(null);
				setActivePiSid(null);
			}
			await refreshSessions(workspaceId);
		} catch (e) {
			emitToast(
				`Delete failed: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}

	async function renameSession(s: SessionInfo, newName: string) {
		const name = newName.trim();
		if (!name || name === s.name) return;
		try {
			const result = await pi.sessions.open({
				workspaceId: activeWs!,
				sessionFile: s.path,
			});
			const resp = await pi.rpc.send(result.sessionId, {
				type: "set_session_name",
				name,
			});
			if (!resp.success) emitToast(resp.error);
			await refreshSessions(activeWs!);
		} catch (e) {
			emitToast(
				`Rename failed: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}

	const activeWorkspace = workspaces.find((w) => w.id === activeWs);
	const activeMessageCount = slice?.messages.length ?? 0;
	const headerSubtitle = activeSid
		? `${activeWorkspace?.name ?? "Workspace"} · ${
				slice?.isStreaming
					? "Thinking"
					: `${activeMessageCount} ${activeMessageCount === 1 ? "message" : "messages"}`
			}`
		: "Choose a workspace to begin";

	return (
		<div className="flex h-full w-full bg-background">
			<ToastHost />
			<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
			<Sidebar>

				<SidebarSection
					title="Workspaces"
					action={
						<Button
							size="icon-sm"
							variant="ghost"
							onClick={addWorkspace}
							aria-label="Add workspace"
						>
							<FolderPlus className="size-3.5" />
						</Button>
					}
				>
					{workspaces.length === 0 ? (
						<div className="rounded-[14px] px-4 py-3 text-[11px] font-medium text-muted-foreground/50">
							No workspaces yet
						</div>
					) : (
						workspaces.map((w) => (
							<WorkspaceWithSessions
								key={w.id}
								workspace={w}
								active={w.id === activeWs}
								sessions={sessionsByWs[w.id] ?? []}
								activePiSid={activePiSid}
								activeSessionRunning={!!slice?.isStreaming}
								renamingId={renamingId}
								onSelectWorkspace={selectWorkspace}
								onOpenSession={openSession}
								onStartRename={setRenamingId}
								onSubmitRename={renameSession}
								onCancelRename={() => setRenamingId(null)}
								onDeleteSession={(session) => deleteSession(w.id, session)}
							/>
						))
					)}
				</SidebarSection>
			</Sidebar>

			<MainArea
					header={
					<>
						<div className="min-w-0">
							{activeSid && slice?.state?.sessionName ? (
								<div className="truncate text-[20px] font-semibold leading-tight tracking-tight text-foreground">
									{slice.state.sessionName}
								</div>
							) : null}
							<div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
								<span>{headerSubtitle}</span>
								{activeSid ? (
									<>
										<span className="text-muted-foreground/40">·</span>
										<ModelPicker
											sessionId={activeSid}
											model={slice?.state?.model as any}
											thinkingLevel={slice?.state?.thinkingLevel as any}
										/>
										<ContextBar
											sessionId={activeSid}
											modelId={
												slice?.state?.model
													? `${(slice.state.model as any).provider}/${(slice.state.model as any).id}`
													: undefined
											}
											modelContextWindow={(slice?.state?.model as any)?.contextWindow}
										/>
									</>
								) : null}
							</div>
						</div>
						<div className="ml-auto flex items-center gap-1">
							<Button
								size="sm"
								variant="secondary"
								aria-label="Search chats"
								className="h-9 rounded-full px-4 text-[13px] font-medium"
							>
								<Search className="size-4" />
								Search
							</Button>
							<ThemeSwitcher />
							<Button
								size="sm"
								variant="primary"
								onClick={() => setSettingsOpen(true)}
								aria-label="Settings"
								className="h-9 rounded-full px-4 text-[13px] font-medium"
							>
								<SettingsIcon className="size-3.5" />
								Settings
							</Button>
							{activeSid ? (
								<Button
									size="icon"
									variant={bashOpen ? "secondary" : "ghost"}
									onClick={() => setBashOpen((o) => !o)}
									aria-label="Toggle bash panel"
								>
									<Terminal className="size-3.5" />
								</Button>
							) : null}
						</div>
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

function WorkspaceWithSessions({
	workspace,
	active,
	sessions,
	activePiSid,
	activeSessionRunning,
	renamingId,
	onSelectWorkspace,
	onOpenSession,
	onStartRename,
	onSubmitRename,
	onCancelRename,
	onDeleteSession,
}: {
	workspace: Workspace;
	active: boolean;
	sessions: SessionInfo[];
	activePiSid: string | null;
	activeSessionRunning: boolean;
	renamingId: string | null;
	onSelectWorkspace: (id: string) => void;
	onOpenSession: (sessionFile?: string) => void;
	onStartRename: (id: string) => void;
	onSubmitRename: (session: SessionInfo, name: string) => Promise<void>;
	onCancelRename: () => void;
	onDeleteSession: (session: SessionInfo) => void;
}) {
	const [expanded, setExpanded] = useState(active);

	useEffect(() => {
		if (active) setExpanded(true);
	}, [active]);

	const pathDisplay = workspace.path.replace(/^\/Users\/[^/]+/, "~");

	return (
		<div className="group/workspace w-full min-w-0">
			<SidebarItem
				active={active}
				onClick={() => {
					if (active) {
						setExpanded((prev) => !prev);
						return;
					}
					onSelectWorkspace(workspace.id);
					setExpanded(true);
				}}
				icon={
					expanded ? (
						<FolderOpen
							className={cn(
								"size-3.5",
								active ? "text-foreground" : "text-blue-500/80",
							)}
						/>
					) : (
						<Folder
							className={cn(
								"size-3.5",
								active ? "text-foreground" : "text-blue-500/80",
							)}
						/>
					)
				}
				title={workspace.name}
				subtitle={pathDisplay}
				title2={workspace.path}
				right={
					active && (
						<Button
							size="icon-sm"
							variant="ghost"
							onClick={() => onOpenSession()}
							aria-label="New session"
							className="size-6 text-primary opacity-0 group-hover/sidebar-item:opacity-100"
						>
							<MessageSquarePlus className="size-3.5" />
						</Button>
					)
				}
			/>
			{expanded && (
				<div className="mt-0.5 w-full min-w-0 space-y-px">
					{sessions.length > 0 ? (
						sessions.map((s) => (
							<SessionRow
								key={s.path}
								session={s}
								active={s.id === activePiSid}
								isRunning={s.id === activePiSid && activeSessionRunning}
								renaming={renamingId === s.path}
								onClick={() => onOpenSession(s.path)}
								onStartRename={() => onStartRename(s.path)}
								onSubmitRename={async (name) => {
									onCancelRename();
									await onSubmitRename(s, name);
								}}
								onCancelRename={onCancelRename}
								onDelete={() => onDeleteSession(s)}
							/>
						))
					) : active ? (
						<div className="rounded-[14px] px-3 py-2 text-[10.5px] font-medium text-muted-foreground/40">
							No sessions yet
						</div>
					) : null}
				</div>
			)}
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
			<div className="mb-5 flex size-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-primary/20 to-primary/10 text-primary shadow-md shadow-primary/10">
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
						<kbd className="ml-1 rounded-md bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-mono">
							⌘N
						</kbd>
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

function SessionRow({
	session,
	active,
	isRunning,
	renaming,
	onClick,
	onStartRename,
	onSubmitRename,
	onCancelRename,
	onDelete,
}: {
	session: SessionInfo;
	active: boolean;
	isRunning: boolean;
	renaming: boolean;
	onClick: () => void;
	onStartRename: () => void;
	onSubmitRename: (name: string) => void;
	onCancelRename: () => void;
	onDelete: () => void;
}) {
	const [draft, setDraft] = useState(session.name ?? "");
	useEffect(() => {
		if (renaming) setDraft(session.name ?? "");
	}, [renaming, session.name]);

	if (renaming) {
		return (
			<form
				onSubmit={(e) => {
					e.preventDefault();
					onSubmitRename(draft);
				}}
				className="px-2 py-1"
			>
				<Input
					autoFocus
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={() => onSubmitRename(draft)}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							e.preventDefault();
							onCancelRename();
						}
					}}
					placeholder={truncate(session.firstMessage, 36) || "Session name"}
					className="w-full text-[13px] h-8"
				/>
			</form>
		);
	}

	const sessionTitle = session.name ?? (truncate(session.firstMessage, 36) || "Untitled");
	const sessionSubtitle = `${session.messageCount} msg · ${formatTime(session.modified)}`;

	return (
		<div
			className="group/sessionrow relative w-full min-w-0"
			onDoubleClick={(e) => {
				e.preventDefault();
				onStartRename();
			}}
		>
			<div
				onClick={onClick}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " " ) {
						e.preventDefault();
						onClick();
					}
				}}
				className={cn(
					"flex min-h-[36px] w-full min-w-0 cursor-pointer items-center rounded-[12px] px-3 py-1.5 text-left transition-colors duration-150",
					active
						? "bg-primary/8 text-primary"
						: "text-foreground/60 hover:bg-foreground/[0.03] hover:text-foreground/80",
				)}
			>
				<div className="min-w-0 flex-1 overflow-hidden pl-3">
					<div
						className={cn(
							"truncate text-[12.5px] leading-tight",
							active ? "font-medium text-primary" : "font-normal",
						)}
					>
						{sessionTitle}
					</div>
				</div>
				{isRunning ? (
					<div className="ml-2 flex size-5 shrink-0 items-center justify-center rounded-full text-primary">
						<Spinner size="sm" className="size-3" />
					</div>
				) : null}
				<div
					className={cn(
						"ml-auto shrink-0 opacity-0 transition-opacity group-hover/sessionrow:opacity-100",
						isRunning && "hidden",
					)}
				>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
						}}
						aria-label="Delete session"
						className={cn(
							"flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-destructive",
							active && "text-primary/50",
						)}
					>
						<Trash2 className="size-3" />
					</button>
				</div>
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
