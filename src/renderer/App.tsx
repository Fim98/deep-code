import {
	AlertTriangle,
	Copy,
	Folder,
	FolderOpen,
	FolderPlus,
	MessageSquarePlus,
	PackageOpen,
	PackagePlus,
	Search,
	Settings as SettingsIcon,
	Share2,
	Sparkles,
	Trash2,
	Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BranchesPanel } from "@/components/chat/BranchesPanel";
import { Composer } from "@/components/chat/Composer";
import { MessageTimeline } from "@/components/chat/MessageTimeline";
import { PlanTrackerWidget } from "@/components/chat/PlanTrackerWidget";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { ExtensionUIHost } from "@/components/extension-ui/ExtensionUIHost";
import { FilePreview } from "@/components/file-tree/FilePreview";
import { FileTree } from "@/components/file-tree/FileTree";
import { FloatingChromeControls } from "@/components/layout/FloatingChromeControls";
import { MainArea } from "@/components/layout/MainArea";
import { Sidebar, SidebarItem, SidebarSection } from "@/components/layout/Sidebar";
import { TerminalPanel } from "@/components/panels/TerminalPanel";
import { ContextBar } from "@/components/settings/ContextBar";
import { ModelPicker } from "@/components/settings/ModelPicker";
import { PackagesPanel } from "@/components/settings/PackagesPanel";
import { ResourcesPanel } from "@/components/settings/ResourcesPanel";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { ToolsPanel } from "@/components/settings/ToolsPanel";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/lib/i18n";
import { useKeyboardShortcuts } from "@/lib/keyboard";
import { pi, type UpdateState } from "@/lib/rpc";
import { emitToast, installGlobalErrorToasts, ToastHost } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useSessions } from "@/stores/session-state";

type Workspace = Awaited<ReturnType<typeof pi.workspaces.list>>[number];
type SessionInfo = Awaited<ReturnType<typeof pi.sessions.list>>[number];

type RightRailPanel = "tools" | "resources" | "packages" | "files" | "preview";

type SessionRuntimeActivity = {
	isStreaming?: boolean;
	pendingSubmissions?: Array<unknown>;
	queue?: { steering?: Array<unknown>; followUp?: Array<unknown> };
	activeTools?: Record<string, { status?: string }>;
};

const IDLE_SESSION_TTL_MS = 15 * 60 * 1000;
const SESSION_REAPER_INTERVAL_MS = 60 * 1000;

function isSessionBusy(slice: SessionRuntimeActivity | null | undefined): boolean {
	if (!slice) return false;
	if (slice.isStreaming) return true;
	if ((slice.pendingSubmissions?.length ?? 0) > 0) return true;
	if ((slice.queue?.steering?.length ?? 0) > 0) return true;
	if ((slice.queue?.followUp?.length ?? 0) > 0) return true;
	return Object.values(slice.activeTools ?? {}).some(
		(tool) => tool.status === "running" || tool.status === "pending",
	);
}

export function App() {
	const { t } = useI18n();
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [activeWs, setActiveWs] = useState<string | null>(null);
	const [sessionsByWs, setSessionsByWs] = useState<Record<string, SessionInfo[]>>({});
	const [activeSessionByWs, setActiveSessionByWs] = useState<
		Record<string, { sessionId: string; piSessionId: string }>
	>({});
	const [bashOpen, setBashOpen] = useState(false);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [fileTreeOpen, setFileTreeOpen] = useState(false);
	const [toolsOpen, setToolsOpen] = useState(false);
	const [resourcesOpen, setResourcesOpen] = useState(false);
	const [packagesOpen, setPackagesOpen] = useState(false);
	const [previewFile, setPreviewFile] = useState<string | null>(null);
	const [rightRailWidth, setRightRailWidth] = useState(380);
	const [_previewWidth, _setPreviewWidth] = useState(480);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [sessionFilter, setSessionFilter] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<{
		workspaceId: string;
		session: SessionInfo;
	} | null>(null);
	const [removeWsTarget, setRemoveWsTarget] = useState<Workspace | null>(null);

	const { hydrate, attach, setCurrent } = useSessions();
	const sessionSubscriptions = useRef(new Map<string, () => void>());
	const sessionActivity = useRef(
		new Map<string, { workspaceId: string; piSessionId: string; lastTouchedAt: number }>(),
	);
	const recyclingSessions = useRef(new Set<string>());
	const trackedSlices = useRef(new Map<string, unknown>());
	const activeSession = activeWs ? (activeSessionByWs[activeWs] ?? null) : null;
	const activeSid = activeSession?.sessionId ?? null;
	const activePiSid = activeSession?.piSessionId ?? null;
	const sessionSlices = useSessions((s) => s.bySession);
	const slice = activeSid ? (sessionSlices[activeSid] ?? null) : null;

	useEffect(() => {
		installGlobalErrorToasts();
		void refreshWorkspaces();
	}, []);

	// Auto-updater: listen for state changes
	useEffect(() => {
		const unsub = pi.updater.onState((state: UpdateState) => {
			if (state.status === "downloaded") {
				emitToast(t("toast.updateReady", { version: state.version ?? "" }), {
					action: { label: t("toast.restart"), onClick: () => void pi.updater.install() },
				});
			} else if (state.status === "error") {
				// Silently ignore — updates are non-critical
			}
		});
		return unsub;
	}, [t]);

	useEffect(() => {
		setCurrent(activeSid);
	}, [activeSid, setCurrent]);

	useEffect(() => {
		return () => {
			for (const unsub of sessionSubscriptions.current.values()) unsub();
			sessionSubscriptions.current.clear();
			sessionActivity.current.clear();
			trackedSlices.current.clear();
			recyclingSessions.current.clear();
		};
	}, []);

	const shortcuts = useMemo(
		() => [
			{
				key: "k",
				meta: true,
				handler: () => setPaletteOpen((o) => !o),
			},
			{
				key: "n",
				meta: true,
				handler: () => {
					if (activeWs) void openSession();
				},
			},
			{
				key: "n",
				meta: true,
				shift: true,
				handler: () => {
					void pi.window.new();
				},
			},
			{
				key: "b",
				meta: true,
				handler: () => {
					setSidebarOpen((o) => !o);
				},
			},
			{
				key: "j",
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
		const [list, active] = await Promise.all([pi.workspaces.list(), pi.workspaces.getActive()]);
		setWorkspaces(list);
		setActiveWs(active);
		setActiveSessionByWs((prev) => {
			const nextEntries = Object.entries(prev).filter(([workspaceId]) =>
				list.some((workspace) => workspace.id === workspaceId),
			);
			return Object.fromEntries(nextEntries);
		});
		await Promise.all(list.map((w) => refreshSessions(w.id)));
	}

	async function refreshSessions(workspaceId: string) {
		const list = await pi.sessions.list(workspaceId);
		setSessionsByWs((prev) => ({ ...prev, [workspaceId]: list }));
	}

	function touchSession(sessionId: string, workspaceId?: string, piSessionId?: string) {
		const current = sessionActivity.current.get(sessionId);
		if (!current && (!workspaceId || !piSessionId)) return;
		sessionActivity.current.set(sessionId, {
			workspaceId: workspaceId ?? current!.workspaceId,
			piSessionId: piSessionId ?? current!.piSessionId,
			lastTouchedAt: Date.now(),
		});
	}

	function attachSession(sessionId: string) {
		if (sessionSubscriptions.current.has(sessionId)) return;
		const unsub = attach(sessionId);
		sessionSubscriptions.current.set(sessionId, unsub);
	}

	async function closeDesktopSession(sessionId: string | null) {
		if (!sessionId) return;
		const unsub = sessionSubscriptions.current.get(sessionId);
		if (unsub) {
			unsub();
			sessionSubscriptions.current.delete(sessionId);
		}
		sessionActivity.current.delete(sessionId);
		trackedSlices.current.delete(sessionId);
		recyclingSessions.current.delete(sessionId);
		await pi.sessions.close(sessionId);
	}

	async function selectWorkspace(id: string) {
		await pi.workspaces.setActive(id);
		setActiveWs(id);
		await refreshSessions(id);
	}

	async function addWorkspace() {
		const path = await pi.workspaces.pickDirectory();
		if (!path) return;
		await pi.workspaces.add(path);
		await refreshWorkspaces();
	}

	async function openSession(sessionFile?: string, workspaceIdArg?: string) {
		const workspaceId = workspaceIdArg ?? activeWs;
		if (!workspaceId) return;
		const targetWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
		try {
			const existingActive = activeSessionByWs[workspaceId];
			const existingSessions = sessionsByWs[workspaceId] ?? [];
			const matchedSession = sessionFile
				? existingSessions.find((session) => session.path === sessionFile)
				: null;
			if (sessionFile && matchedSession && existingActive?.piSessionId === matchedSession.id) {
				if (activeWs !== workspaceId) {
					setActiveWs(workspaceId);
					await pi.workspaces.setActive(workspaceId);
				}
				setBashOpen(false);
				return;
			}

			const result = await pi.sessions.open({
				workspaceId,
				sessionFile,
			});
			const { sessionId, piSessionId } = result;
			if (result.cwdFallback) {
				emitToast(t("toast.workspaceMissing"), "info");
			}
			if (result.projectHasTrustInputs && !result.projectTrusted) {
				emitToast(t("toast.projectUntrusted"), {
					action: {
						label: t("toast.trustProject"),
						onClick: () => {
							if (!targetWorkspace) return;
							void pi.settings.setProjectTrust(targetWorkspace.path, true).then(() => {
								emitToast(t("toast.projectTrustSaved"), "info");
							});
						},
					},
				});
			}
			setActiveSessionByWs((prev) => ({
				...prev,
				[workspaceId]: { sessionId, piSessionId },
			}));
			touchSession(sessionId, workspaceId, piSessionId);
			if (activeWs !== workspaceId) {
				setActiveWs(workspaceId);
				await pi.workspaces.setActive(workspaceId);
			}
			setBashOpen(false);
			if (!sessionFile) {
				setSessionsByWs((prev) => {
					const existing = prev[workspaceId] ?? [];
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
					return { ...prev, [workspaceId]: [placeholder, ...existing] };
				});
			}
			await hydrate(sessionId);
			attachSession(sessionId);
			if (existingActive && existingActive.sessionId !== sessionId) {
				try {
					await closeDesktopSession(existingActive.sessionId);
				} catch {
					// Ignore cleanup errors for replaced workspace session
				}
			}
			if (sessionFile) {
				await refreshSessions(workspaceId);
			}
		} catch (e) {
			emitToast(t("toast.failedToOpen", { error: e instanceof Error ? e.message : String(e) }));
		}
	}

	async function confirmDeleteSession() {
		if (!deleteTarget) return;
		const { workspaceId, session: s } = deleteTarget;
		setDeleteTarget(null);
		try {
			const activeForWorkspace = activeSessionByWs[workspaceId];
			if (s.id === activeForWorkspace?.piSessionId) {
				setActiveSessionByWs((prev) => {
					const next = { ...prev };
					delete next[workspaceId];
					return next;
				});
				try {
					await closeDesktopSession(activeForWorkspace.sessionId);
				} catch {
					// Ignore close errors
				}
			}
			await pi.sessions.delete({ workspaceId, sessionPath: s.path });
			setSessionsByWs((prev) => ({
				...prev,
				[workspaceId]: (prev[workspaceId] ?? []).filter((session) => session.path !== s.path),
			}));
			await refreshSessions(workspaceId);
		} catch (e) {
			emitToast(t("toast.deleteFailed", { error: e instanceof Error ? e.message : String(e) }));
		}
	}

	async function confirmRemoveWorkspace() {
		if (!removeWsTarget) return;
		const ws = removeWsTarget;
		setRemoveWsTarget(null);
		try {
			const activeForWorkspace = activeSessionByWs[ws.id];
			if (activeForWorkspace) {
				setActiveSessionByWs((prev) => {
					const next = { ...prev };
					delete next[ws.id];
					return next;
				});
				try {
					await closeDesktopSession(activeForWorkspace.sessionId);
				} catch {
					// Ignore
				}
			}
			if (activeWs === ws.id) {
				setBashOpen(false);
			}
			await pi.workspaces.remove(ws.id);
			setSessionsByWs((prev) => {
				const next = { ...prev };
				delete next[ws.id];
				return next;
			});
			await refreshWorkspaces();
		} catch (e) {
			emitToast(
				t("toast.removeWorkspaceFailed", { error: e instanceof Error ? e.message : String(e) }),
			);
		}
	}

	async function copyLastMessage() {
		if (!activeSid) return;
		try {
			const resp = await pi.rpc.send(activeSid, { type: "get_last_assistant_text" });
			if (resp.success && resp.command === "get_last_assistant_text") {
				const text = (resp.data as { text: string | null }).text;
				if (text) {
					await navigator.clipboard.writeText(text);
					emitToast(t("toast.messageCopied"), "info");
				} else {
					emitToast(t("toast.noMessageToCopy"), "info");
				}
			}
		} catch (e) {
			emitToast(t("toast.copyFailed", { error: e instanceof Error ? e.message : String(e) }));
		}
	}

	async function exportSession() {
		if (!activeSid) return;
		try {
			const path = await pi.sessions.exportHtml(activeSid);
			if (path) {
				emitToast(t("toast.sessionExported", { path }), {
					action: {
						label: t("toast.showInFinder"),
						onClick: () => void pi.shell.showItemInFolder(path),
					},
				});
			}
		} catch (e) {
			emitToast(t("toast.exportFailed", { error: e instanceof Error ? e.message : String(e) }));
		}
	}

	async function renameSession(workspaceId: string, s: SessionInfo, newName: string) {
		const name = newName.trim();
		if (!name || name === s.name) return;
		let temporarySessionId: string | null = null;
		try {
			const activeForWorkspace = activeSessionByWs[workspaceId];
			const isActiveRuntime = activeForWorkspace?.piSessionId === s.id;
			const targetSessionId = isActiveRuntime
				? activeForWorkspace.sessionId
				: (
						await pi.sessions.open({
							workspaceId,
							sessionFile: s.path,
						})
					).sessionId;
			if (!isActiveRuntime) temporarySessionId = targetSessionId;
			const resp = await pi.rpc.send(targetSessionId, {
				type: "set_session_name",
				name,
			});
			if (!resp.success) emitToast(resp.error);
			await refreshSessions(workspaceId);
		} catch (e) {
			emitToast(t("toast.renameFailed", { error: e instanceof Error ? e.message : String(e) }));
		} finally {
			if (temporarySessionId) {
				try {
					await closeDesktopSession(temporarySessionId);
				} catch {
					// Ignore close errors for temporary rename session
				}
			}
		}
	}

	useEffect(() => {
		for (const [workspaceId, binding] of Object.entries(activeSessionByWs)) {
			if (!sessionActivity.current.has(binding.sessionId)) {
				touchSession(binding.sessionId, workspaceId, binding.piSessionId);
			}
			const nextSlice = sessionSlices[binding.sessionId];
			if (nextSlice && trackedSlices.current.get(binding.sessionId) !== nextSlice) {
				trackedSlices.current.set(binding.sessionId, nextSlice);
				touchSession(binding.sessionId, workspaceId, binding.piSessionId);
			}
		}
		for (const sessionId of Array.from(trackedSlices.current.keys())) {
			const stillTracked = Object.values(activeSessionByWs).some(
				(binding) => binding.sessionId === sessionId,
			);
			if (!stillTracked) trackedSlices.current.delete(sessionId);
		}
	}, [activeSessionByWs, sessionSlices]);

	useEffect(() => {
		if (activeSid) touchSession(activeSid, activeWs ?? undefined, activePiSid ?? undefined);
	}, [activePiSid, activeSid, activeWs]);

	useEffect(() => {
		const timer = window.setInterval(() => {
			const now = Date.now();
			for (const [workspaceId, binding] of Object.entries(activeSessionByWs)) {
				const sessionId = binding.sessionId;
				if (workspaceId === activeWs) continue;
				if (recyclingSessions.current.has(sessionId)) continue;
				const meta = sessionActivity.current.get(sessionId);
				if (!meta) continue;
				const sliceForSession = sessionSlices[sessionId];
				if (isSessionBusy(sliceForSession)) continue;
				if (now - meta.lastTouchedAt < IDLE_SESSION_TTL_MS) continue;

				recyclingSessions.current.add(sessionId);
				void closeDesktopSession(sessionId)
					.catch(() => {
						// Ignore idle cleanup errors — session can be reopened later.
					})
					.finally(() => {
						setActiveSessionByWs((prev) => {
							if (prev[workspaceId]?.sessionId !== sessionId) return prev;
							const next = { ...prev };
							delete next[workspaceId];
							return next;
						});
						recyclingSessions.current.delete(sessionId);
					});
			}
		}, SESSION_REAPER_INTERVAL_MS);
		return () => window.clearInterval(timer);
	}, [activeSessionByWs, activeWs, sessionSlices]);

	const activeWorkspace = workspaces.find((w) => w.id === activeWs);
	const activeRightRailPanel: RightRailPanel | null = packagesOpen
		? "packages"
		: resourcesOpen
			? "resources"
			: toolsOpen
				? "tools"
				: previewFile
					? "preview"
					: fileTreeOpen
						? "files"
						: null;
	const firstUserMessage = slice ? firstUserMessageText(slice.messages) : "";

	function setRightRailPanel(panel: RightRailPanel | null) {
		setToolsOpen(panel === "tools");
		setResourcesOpen(panel === "resources");
		setPackagesOpen(panel === "packages");
		setFileTreeOpen(panel === "files");
		if (panel !== "preview") setPreviewFile(null);
	}

	function toggleRightRailPanel(panel: RightRailPanel) {
		setRightRailPanel(activeRightRailPanel === panel ? null : panel);
	}

	useEffect(() => {
		if (!activeWs || !activeSid || !activePiSid || !firstUserMessage) return;

		const fallbackCwd = workspaces.find((w) => w.id === activeWs)?.path ?? "";
		let cancelled = false;

		const upsertCurrentSession = (state?: {
			sessionFile?: string;
			sessionId?: string;
			sessionName?: string;
			messageCount?: number;
		}) => {
			if (cancelled) return;
			setSessionsByWs((prev) => {
				const existing = prev[activeWs] ?? [];
				const nextId = state?.sessionId ?? activePiSid;
				const nextPath = state?.sessionFile ?? "";
				const matched = existing.find(
					(s) => s.id === nextId || (!!nextPath && s.path === nextPath) || s.id === activePiSid,
				);
				const item: SessionInfo = {
					path: nextPath || matched?.path || "",
					id: nextId,
					cwd: matched?.cwd || fallbackCwd,
					name: state?.sessionName ?? matched?.name,
					parentSessionPath: matched?.parentSessionPath,
					created: matched?.created ?? Date.now(),
					modified: Date.now(),
					messageCount: state?.messageCount ?? slice?.messages.length ?? matched?.messageCount ?? 0,
					firstMessage: matched?.firstMessage || firstUserMessage,
				};
				const rest = existing.filter(
					(s) => s.id !== activePiSid && s.id !== nextId && (!item.path || s.path !== item.path),
				);
				return { ...prev, [activeWs]: [item, ...rest] };
			});
		};

		upsertCurrentSession(slice?.state ?? undefined);

		void pi.rpc.send(activeSid, { type: "get_state" }).then((resp) => {
			if (resp.success && resp.command === "get_state") {
				upsertCurrentSession(resp.data);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [activeWs, activeSid, activePiSid, firstUserMessage, slice, workspaces]);

	const activeMessageCount = slice?.messages.length ?? 0;
	const headerSubtitle = activeSid
		? `${activeWorkspace?.name ?? ""} · ${
				slice?.isStreaming
					? t("header.thinking")
					: t(activeMessageCount === 1 ? "header.message" : "header.messages", {
							count: activeMessageCount,
						})
			}`
		: t("header.chooseWorkspace");

	const deleteSessionName = deleteTarget
		? (deleteTarget.session.name ?? truncate(deleteTarget.session.firstMessage ?? "", 40)) ||
			t("sidebar.untitled")
		: "";

	return (
		<div className="relative flex h-full w-full bg-background">
			<ToastHost />
			<ExtensionUIHost />
			<FloatingChromeControls
				sidebarOpen={sidebarOpen}
				bashOpen={bashOpen}
				rightRailActive={activeRightRailPanel === "files" || activeRightRailPanel === "preview"}
				sidebarLabel={sidebarOpen ? t("sidebar.hide") : t("sidebar.show")}
				bashTitle={t("bash.title")}
				fileTreeTitle={t("fileTree.title")}
				onToggleSidebar={() => setSidebarOpen((o) => !o)}
				onToggleBash={() => setBashOpen((o) => !o)}
				onToggleRightRail={() => toggleRightRailPanel("files")}
			/>

			{/* Delete session confirmation dialog */}
			<Dialog
				open={!!deleteTarget}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
			>
				<DialogContent className="max-w-[400px] rounded-[24px] p-0">
					<div className="flex flex-col items-center px-8 pt-8">
						<div className="mb-5 flex size-12 items-center justify-center rounded-full bg-destructive/10">
							<AlertTriangle className="size-5 text-destructive" />
						</div>
						<DialogHeader className="text-center">
							<DialogTitle className="text-[18px] font-semibold tracking-tight">
								{t("sidebar.deleteLabel")}
							</DialogTitle>
							<DialogDescription className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
								{t("sidebar.deleteConfirm", { name: deleteSessionName })}
							</DialogDescription>
						</DialogHeader>
					</div>
					<DialogFooter className="flex-row gap-3 border-t border-border/50 px-8 py-5">
						<Button
							variant="ghost"
							size="md"
							className="flex-1 rounded-full text-[14px]"
							onClick={() => setDeleteTarget(null)}
						>
							{t("sidebar.cancel")}
						</Button>
						<Button
							variant="destructive"
							size="md"
							className="flex-1 rounded-full text-[14px]"
							onClick={confirmDeleteSession}
						>
							{t("sidebar.delete")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Remove workspace confirmation dialog */}
			<Dialog
				open={!!removeWsTarget}
				onOpenChange={(open) => {
					if (!open) setRemoveWsTarget(null);
				}}
			>
				<DialogContent className="max-w-[400px] rounded-[24px] p-0">
					<div className="flex flex-col items-center px-8 pt-8">
						<div className="mb-5 flex size-12 items-center justify-center rounded-full bg-destructive/10">
							<AlertTriangle className="size-5 text-destructive" />
						</div>
						<DialogHeader className="text-center">
							<DialogTitle className="text-[18px] font-semibold tracking-tight">
								{t("sidebar.removeWorkspace")}
							</DialogTitle>
							<DialogDescription className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
								{t("sidebar.removeWorkspaceConfirm", { name: removeWsTarget?.name ?? "" })}
							</DialogDescription>
						</DialogHeader>
					</div>
					<DialogFooter className="flex-row gap-3 border-t border-border/50 px-8 py-5">
						<Button
							variant="ghost"
							size="md"
							className="flex-1 rounded-full text-[14px]"
							onClick={() => setRemoveWsTarget(null)}
						>
							{t("sidebar.cancel")}
						</Button>
						<Button
							variant="destructive"
							size="md"
							className="flex-1 rounded-full text-[14px]"
							onClick={confirmRemoveWorkspace}
						>
							{t("sidebar.remove")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<SettingsDialog
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				activeWorkspacePath={activeWorkspace?.path}
				activeSessionId={activeSid}
			/>
			<CommandPalette
				open={paletteOpen}
				onOpenChange={setPaletteOpen}
				workspaces={workspaces}
				activeWorkspaceId={activeWs}
				sessions={activeWs ? (sessionsByWs[activeWs] ?? []) : []}
				activeSessionId={activeSid}
				activePiSessionId={activePiSid}
				bashOpen={bashOpen}
				settingsOpen={settingsOpen}
				onSelectWorkspace={selectWorkspace}
				onAddWorkspace={addWorkspace}
				onOpenSession={openSession}
				onToggleBash={() => setBashOpen((o) => !o)}
				onToggleSettings={() => setSettingsOpen((o) => !o)}
			/>
			<Sidebar
				collapsed={!sidebarOpen}
				footer={
					<button
						type="button"
						onClick={() => setSettingsOpen(true)}
						className={cn(
							"flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-[13px] font-medium transition-colors duration-150",
							"text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground",
						)}
					>
						<SettingsIcon className="size-4" />
						{t("header.settings")}
					</button>
				}
			>
				<SidebarSection
					title={t("sidebar.workspaces")}
					action={
						<Button
							size="icon-sm"
							variant="ghost"
							onClick={addWorkspace}
							aria-label={t("sidebar.addWorkspace")}
						>
							<FolderPlus className="size-3.5" />
						</Button>
					}
				>
					{workspaces.length > 0 ? (
						<div className="relative px-1">
							<Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
							<input
								value={sessionFilter}
								onChange={(e) => setSessionFilter(e.target.value)}
								placeholder={t("sidebar.filterSessions")}
								className="h-8 w-full rounded-[10px] border border-border/40 bg-foreground/[0.03] pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none"
							/>
						</div>
					) : null}
					{workspaces.length === 0 ? (
						<div className="rounded-[14px] px-4 py-3 text-[11px] font-medium text-muted-foreground/50">
							{t("sidebar.noWorkspaces")}
						</div>
					) : (
						workspaces.map((w) => (
							<WorkspaceWithSessions
								key={w.id}
								workspace={w}
								active={w.id === activeWs}
								sessions={filterSessions(sessionsByWs[w.id] ?? [], sessionFilter)}
								activePiSid={activePiSid}
								activeSessionRunning={!!slice?.isStreaming}
								renamingId={renamingId}
								onSelectWorkspace={selectWorkspace}
								onOpenSession={openSession}
								onStartRename={setRenamingId}
								onSubmitRename={renameSession}
								onCancelRename={() => setRenamingId(null)}
								onDeleteSession={(session) => setDeleteTarget({ workspaceId: w.id, session })}
								onRemoveWorkspace={() => setRemoveWsTarget(w)}
							/>
						))
					)}
				</SidebarSection>
			</Sidebar>

			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex min-h-0 flex-1">
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
												<span className="text-muted-foreground/40">·</span>
												<BranchesPanel
													sessionId={activeSid}
													onForked={() => refreshSessions(activeWs!)}
												/>
											</>
										) : null}
									</div>
								</div>
								<div className="ml-auto flex items-center gap-0.5">
									{activeSid ? (
										<>
											<Button
												size="sm"
												variant="ghost"
												aria-label={t("header.copy")}
												onClick={copyLastMessage}
												className="h-8 rounded-full px-2.5 text-[13px] font-medium"
											>
												<Copy className="size-3.5" />
												{t("header.copy")}
											</Button>
											<Button
												size="sm"
												variant="ghost"
												aria-label={t("header.share")}
												onClick={exportSession}
												className="h-8 rounded-full px-2.5 text-[13px] font-medium"
											>
												<Share2 className="size-3.5" />
												{t("header.share")}
											</Button>
										</>
									) : null}
									<div className="mx-1 h-5 w-px bg-border/60" />
									{activeSid ? (
										<>
											<button
												type="button"
												onClick={() => toggleRightRailPanel("tools")}
												aria-label="Toggle tools"
												title="Tools"
												className={cn(
													"flex size-8 cursor-pointer items-center justify-center rounded-[10px] transition-colors",
													activeRightRailPanel === "tools"
														? "bg-foreground/[0.08] text-foreground"
														: "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
												)}
											>
												<Wrench className="size-4" />
											</button>
											<button
												type="button"
												onClick={() => toggleRightRailPanel("resources")}
												aria-label="Toggle resources"
												title="Resources"
												className={cn(
													"flex size-8 cursor-pointer items-center justify-center rounded-[10px] transition-colors",
													activeRightRailPanel === "resources"
														? "bg-foreground/[0.08] text-foreground"
														: "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
												)}
											>
												<PackageOpen className="size-4" />
											</button>
											<button
												type="button"
												onClick={() => toggleRightRailPanel("packages")}
												aria-label="Toggle packages"
												title="Packages"
												className={cn(
													"flex size-8 cursor-pointer items-center justify-center rounded-[10px] transition-colors",
													activeRightRailPanel === "packages"
														? "bg-foreground/[0.08] text-foreground"
														: "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
												)}
											>
												<PackagePlus className="size-4" />
											</button>
										</>
									) : null}
								</div>
							</>
						}
						footer={
							activeSid ? (
								<div className="flex flex-col gap-2">
									<PlanTrackerWidget sessionId={activeSid} />
									<Composer sessionId={activeSid} isStreaming={slice?.isStreaming ?? false} />
								</div>
							) : null
						}
					>
						{activeSid ? (
							<div className="flex h-full flex-col">
								<div className="min-h-0 flex-1">
									<MessageTimeline sessionId={activeSid} />
								</div>
							</div>
						) : (
							<NoSessionState
								hasWorkspace={!!activeWorkspace}
								onAddWorkspace={addWorkspace}
								onNewSession={() => openSession()}
							/>
						)}
					</MainArea>

					{/* Right rail: packages + resources + tools + file preview + file tree */}
					{packagesOpen ? (
						<ResizableRightRail width={rightRailWidth} onResize={setRightRailWidth}>
							<PackagesPanel
								cwd={activeWorkspace?.path}
								sessionId={activeSid}
								onClose={() => setRightRailPanel(null)}
							/>
						</ResizableRightRail>
					) : null}
					{resourcesOpen ? (
						<ResizableRightRail width={rightRailWidth} onResize={setRightRailWidth}>
							<ResourcesPanel
								sessionId={activeSid}
								cwd={activeWorkspace?.path}
								onClose={() => setRightRailPanel(null)}
							/>
						</ResizableRightRail>
					) : null}
					{toolsOpen ? (
						<ResizableRightRail width={rightRailWidth} onResize={setRightRailWidth}>
							<ToolsPanel sessionId={activeSid} onClose={() => setRightRailPanel(null)} />
						</ResizableRightRail>
					) : null}
					{activeWorkspace && previewFile ? (
						<ResizableRightRail width={rightRailWidth} onResize={setRightRailWidth}>
							<div className="flex h-full w-full flex-col border-l border-border/40 bg-card/75 backdrop-blur-xl">
								<FilePreview
									filePath={previewFile}
									onClose={() => setRightRailPanel(null)}
									onBack={() => setRightRailPanel("files")}
								/>
							</div>
						</ResizableRightRail>
					) : null}
					{activeWorkspace && fileTreeOpen ? (
						<ResizableRightRail width={rightRailWidth} onResize={setRightRailWidth}>
							<div className="flex h-full w-full flex-col border-l border-border/40 bg-card/75 backdrop-blur-xl">
								<div className="min-h-0 flex-1 overflow-hidden">
									<FileTree
										rootPath={activeWorkspace.path}
										open={fileTreeOpen}
										onOpenChange={setFileTreeOpen}
										onFileClick={(path) => {
											setRightRailPanel("preview");
											setPreviewFile(path);
										}}
									/>
								</div>
							</div>
						</ResizableRightRail>
					) : null}
				</div>
				{activeSid ? (
					<TerminalPanel
						cwd={activeWorkspace?.path}
						expanded={bashOpen}
						onToggle={() => setBashOpen((o) => !o)}
						onClose={() => setBashOpen(false)}
					/>
				) : null}
			</div>
		</div>
	);
}

function ResizableRightRail({
	width,
	onResize,
	children,
}: {
	width: number;
	onResize: (width: number) => void;
	children: React.ReactNode;
}) {
	return (
		<>
			<ResizeHandle direction="horizontal" minSize={320} maxSize={560} onResize={onResize} />
			<div className="h-full shrink-0" style={{ width }}>
				{children}
			</div>
		</>
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
	onRemoveWorkspace,
}: {
	workspace: Workspace;
	active: boolean;
	sessions: SessionInfo[];
	activePiSid: string | null;
	activeSessionRunning: boolean;
	renamingId: string | null;
	onSelectWorkspace: (id: string) => void;
	onOpenSession: (sessionFile?: string, workspaceId?: string) => void;
	onStartRename: (id: string) => void;
	onSubmitRename: (workspaceId: string, session: SessionInfo, name: string) => Promise<void>;
	onCancelRename: () => void;
	onDeleteSession: (session: SessionInfo) => void;
	onRemoveWorkspace: () => void;
}) {
	const { t } = useI18n();
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
							className={cn("size-3.5", active ? "text-foreground" : "text-blue-500/80")}
						/>
					) : (
						<Folder className={cn("size-3.5", active ? "text-foreground" : "text-blue-500/80")} />
					)
				}
				title={workspace.name}
				subtitle={pathDisplay}
				title2={workspace.path}
				right={
					active && (
						<div className="flex items-center gap-0.5 opacity-0 group-hover/sidebar-item:opacity-100">
							<Button
								size="icon-sm"
								variant="ghost"
								onClick={(e) => {
									e.stopPropagation();
									onOpenSession(undefined, workspace.id);
								}}
								aria-label={t("sidebar.newSession")}
								className="size-6 text-primary"
							>
								<MessageSquarePlus className="size-3.5" />
							</Button>
							<Button
								size="icon-sm"
								variant="ghost"
								onClick={(e) => {
									e.stopPropagation();
									onRemoveWorkspace();
								}}
								aria-label={t("sidebar.removeWorkspace")}
								className="size-6 text-muted-foreground hover:text-destructive"
							>
								<Trash2 className="size-3" />
							</Button>
						</div>
					)
				}
			/>
			{expanded && (
				<div className="mt-0.5 w-full min-w-0 space-y-px">
					{sessions.length > 0 ? (
						sessions.map((s) => (
							<SessionRow
								key={s.path || s.id}
								session={s}
								active={s.id === activePiSid}
								isRunning={s.id === activePiSid && activeSessionRunning}
								renaming={renamingId === s.path}
								onClick={() => {
									if (s.id !== activePiSid && s.path) onOpenSession(s.path, workspace.id);
								}}
								onStartRename={() => onStartRename(s.path)}
								onSubmitRename={async (name) => {
									onCancelRename();
									await onSubmitRename(workspace.id, s, name);
								}}
								onCancelRename={onCancelRename}
								onDelete={() => onDeleteSession(s)}
							/>
						))
					) : active ? (
						<div className="rounded-[14px] px-3 py-2 text-[10.5px] font-medium text-muted-foreground/40">
							{t("sidebar.noSessions")}
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
	const { t } = useI18n();
	return (
		<div className="flex h-full flex-col items-center justify-center px-8 text-center">
			<div className="mb-5 flex size-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-primary/20 to-primary/10 text-primary shadow-md shadow-primary/10">
				<Sparkles className="size-7" />
			</div>
			<h1 className="text-2xl font-semibold tracking-tight">{t("empty.title")}</h1>
			<p className="mt-2 max-w-md text-sm text-muted-foreground">
				{hasWorkspace ? t("empty.description.hasWorkspace") : t("empty.description.noWorkspace")}
			</p>
			<div className="mt-6 flex gap-3">
				{hasWorkspace ? (
					<Button onClick={onNewSession} size="lg">
						<MessageSquarePlus className="size-4" />
						{t("empty.newSession")}
						<kbd className="ml-1 rounded-md bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-mono">
							⌘N
						</kbd>
					</Button>
				) : (
					<Button onClick={onAddWorkspace} size="lg">
						<FolderPlus className="size-4" />
						{t("empty.addWorkspace")}
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
	const { t } = useI18n();
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
					placeholder={truncate(session.firstMessage, 36) || t("sidebar.sessionName")}
					className="w-full text-[13px] h-8"
				/>
			</form>
		);
	}

	const sessionTitle =
		session.name?.trim() || truncate(session.firstMessage, 36) || t("sidebar.untitled");

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
					if (e.key === "Enter" || e.key === " ") {
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
						aria-label={t("sidebar.deleteLabel")}
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

function firstUserMessageText(messages: Array<{ role: string; content?: unknown }>): string {
	const first = messages.find((m) => m.role === "user");
	return first ? messageContentText(first.content) : "";
}

function messageContentText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter(
			(part): part is { type: "text"; text: string } =>
				!!part &&
				typeof part === "object" &&
				(part as { type?: unknown }).type === "text" &&
				typeof (part as { text?: unknown }).text === "string",
		)
		.map((part) => part.text)
		.join("\n");
}

function filterSessions(sessions: SessionInfo[], query: string): SessionInfo[] {
	if (!query.trim()) return sessions;
	const q = query.toLowerCase();
	return sessions.filter((s) => {
		const name = (s.name ?? "").toLowerCase();
		const first = (s.firstMessage ?? "").toLowerCase();
		return name.includes(q) || first.includes(q);
	});
}
