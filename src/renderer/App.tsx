import { useEffect, useMemo, useRef, useState } from "react";
import {
	Folder,
	FolderPlus,
	MessageSquare,
	MessageSquarePlus,
	Settings as SettingsIcon,
	Sparkles,
	Terminal,
	Trash2,
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
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { ThemeSwitcher } from "@/components/settings/ThemeSwitcher";
import { ContextBar } from "@/components/settings/ContextBar";
import {
	ToastHost,
	emitToast,
	installGlobalErrorToasts,
} from "@/components/ui/toast";
import { useKeyboardShortcuts } from "@/lib/keyboard";
import { useSessions } from "@/stores/session-state";
import { cn } from "@/lib/utils";
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
		try {
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
		} catch (e) {
			emitToast(
				`Failed to open session: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}

	async function deleteSession(s: SessionInfo) {
		if (!activeWs) return;
		const ok = window.confirm(
			`Delete session "${s.name ?? (s.firstMessage.slice(0, 40) || "Untitled")}"?\n\nThis removes the session file from disk and cannot be undone.`,
		);
		if (!ok) return;
		try {
			await pi.sessions.delete({ workspaceId: activeWs, sessionPath: s.path });
			if (s.id === activePiSid) {
				setActiveSid(null);
				setActivePiSid(null);
			}
			await refreshSessions(activeWs);
		} catch (e) {
			emitToast(
				`Delete failed: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}

	async function renameSession(s: SessionInfo, newName: string) {
		const name = newName.trim();
		if (!name || name === s.name) return;
		// Open the session if not already, then rename
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

	return (
		<div className="flex h-full w-full">
			<ToastHost />
			<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
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
								<SessionRow
									key={s.path}
									session={s}
									active={s.id === activePiSid}
									renaming={renamingId === s.path}
									onClick={() => openSession(s.path)}
									onStartRename={() => setRenamingId(s.path)}
									onSubmitRename={async (name) => {
										setRenamingId(null);
										await renameSession(s, name);
									}}
									onCancelRename={() => setRenamingId(null)}
									onDelete={() => deleteSession(s)}
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
							<ContextBar
								sessionId={activeSid}
								modelId={
									slice?.state?.model
										? `${(slice.state.model as any).provider}/${(slice.state.model as any).id}`
										: undefined
								}
								modelContextWindow={(slice?.state?.model as any)?.contextWindow}
							/>
						) : null}
						<div className="ml-auto flex items-center gap-1">
							<ThemeSwitcher />
							<Button
								size="iconSm"
								variant="ghost"
								onClick={() => setSettingsOpen(true)}
								title="Settings"
							>
								<SettingsIcon className="size-3.5" />
							</Button>
							{activeSid ? (
								<Button
									size="iconSm"
									variant={bashOpen ? "secondary" : "ghost"}
									onClick={() => setBashOpen((o) => !o)}
									title="Toggle bash panel  ⌘B"
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
						<kbd className="ml-1 rounded bg-foreground/[0.18] px-1.5 py-0.5 text-[10px] font-mono">
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
	renaming,
	onClick,
	onStartRename,
	onSubmitRename,
	onCancelRename,
	onDelete,
}: {
	session: SessionInfo;
	active: boolean;
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
				className="px-3 py-1.5"
			>
				<input
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
					className="w-full rounded-md border border-primary/40 bg-background/80 px-2 py-1 text-[13px] text-foreground focus:outline-none"
				/>
			</form>
		);
	}

	return (
		<div
			className="group/sessionrow relative"
			onDoubleClick={(e) => {
				e.preventDefault();
				onStartRename();
			}}
		>
			<SidebarItem
				active={active}
				onClick={onClick}
				icon={<MessageSquare className="size-3.5" />}
				title={
					session.name ?? (truncate(session.firstMessage, 36) || "Untitled")
				}
				subtitle={`${session.messageCount} msg · ${formatTime(session.modified)}`}
				title2={session.firstMessage}
				right={
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
						}}
						title="Delete session"
						className={cn(
							"flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover/sessionrow:opacity-100",
							active && "text-accent-foreground/70",
						)}
					>
						<Trash2 className="size-3" />
					</button>
				}
			/>
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
