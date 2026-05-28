import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
	ChevronsUpDown,
	Code,
	Cog,
	FolderPlus,
	MessageSquarePlus,
	Monitor,
	Moon,
	Palette,
	Search,
	Sun,
	Terminal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { pi } from "@/lib/rpc";
import { cn } from "@/lib/utils";
import { useTheme } from "@/stores/theme";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CommandItem {
	id: string;
	group: string;
	label: string;
	description?: string;
	icon: React.ReactNode;
	badge?: string;
	action: () => void | Promise<void>;
}

type Workspace = Awaited<ReturnType<typeof pi.workspaces.list>>[number];
type SessionInfo = Awaited<ReturnType<typeof pi.sessions.list>>[number];

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workspaces: Workspace[];
	activeWorkspaceId: string | null;
	sessions: SessionInfo[];
	activeSessionId: string | null;
	activePiSessionId: string | null;
	bashOpen: boolean;
	settingsOpen: boolean;
	onSelectWorkspace: (id: string) => void;
	onAddWorkspace: () => void;
	onOpenSession: (sessionFile?: string) => void;
	onToggleBash: () => void;
	onToggleSettings: () => void;
}

// ─── Fuzzy match ─────────────────────────────────────────────────────────────

function fuzzyMatch(text: string, query: string): boolean {
	const lower = text.toLowerCase();
	const q = query.toLowerCase();
	let qi = 0;
	for (let i = 0; i < lower.length && qi < q.length; i++) {
		if (lower[i] === q[qi]) qi++;
	}
	return qi === q.length;
}

function highlightMatch(text: string, query: string): React.ReactNode {
	if (!query) return text;
	const lower = text.toLowerCase();
	const q = query.toLowerCase();
	const indices: number[] = [];
	let qi = 0;
	for (let i = 0; i < lower.length && qi < q.length; i++) {
		if (lower[i] === q[qi]) {
			indices.push(i);
			qi++;
		}
	}
	if (indices.length !== q.length) return text;

	const parts: React.ReactNode[] = [];
	let last = 0;
	for (const idx of indices) {
		if (idx > last) parts.push(text.slice(last, idx));
		parts.push(
			<span key={idx} className="font-semibold text-primary">
				{text[idx]}
			</span>,
		);
		last = idx + 1;
	}
	if (last < text.length) parts.push(text.slice(last));
	return parts;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CommandPalette({
	open,
	onOpenChange,
	workspaces,
	activeWorkspaceId,
	sessions,
	activeSessionId,
	activePiSessionId,
	bashOpen,
	settingsOpen,
	onSelectWorkspace,
	onAddWorkspace,
	onOpenSession,
	onToggleBash,
	onToggleSettings,
}: CommandPaletteProps) {
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [models, setModels] = useState<Array<{ id: string; name: string; provider: string }>>([]);
	const [commands, setCommands] = useState<
		Array<{ name: string; description?: string; source: string }>
	>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const { choice, setChoice } = useTheme();

	// Fetch models and commands when palette opens
	useEffect(() => {
		if (!open || !activeSessionId) return;
		pi.rpc.send(activeSessionId, { type: "get_available_models" }).then((r) => {
			if (r.success && r.command === "get_available_models") {
				setModels(r.data.models as Array<{ id: string; name: string; provider: string }>);
			}
		});
		pi.rpc.send(activeSessionId, { type: "get_commands" }).then((r) => {
			if (r.success && r.command === "get_commands") {
				setCommands(
					r.data.commands as Array<{ name: string; description?: string; source: string }>,
				);
			}
		});
	}, [open, activeSessionId]);

	// Reset state when opening
	useEffect(() => {
		if (open) {
			setQuery("");
			setSelectedIndex(0);
			// Focus input after animation
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	// Build all command items
	const allItems: CommandItem[] = useMemo(() => {
		const items: CommandItem[] = [];

		// Workspace actions
		items.push({
			id: "ws:add",
			group: "Workspace",
			label: "Add workspace…",
			description: "Open a project folder",
			icon: <FolderPlus className="size-4" />,
			action: () => {
				onOpenChange(false);
				onAddWorkspace();
			},
		});

		for (const ws of workspaces) {
			const isActive = ws.id === activeWorkspaceId;
			items.push({
				id: `ws:switch:${ws.id}`,
				group: "Workspace",
				label: ws.name,
				description: ws.path.replace(/^\/Users\/[^/]+/, "~"),
				icon: <Search className="size-4" />,
				badge: isActive ? "Active" : undefined,
				action: () => {
					onOpenChange(false);
					if (!isActive) onSelectWorkspace(ws.id);
				},
			});
		}

		// Session actions
		if (activeWorkspaceId) {
			items.push({
				id: "session:new",
				group: "Session",
				label: "New session",
				icon: <MessageSquarePlus className="size-4" />,
				action: () => {
					onOpenChange(false);
					onOpenSession();
				},
			});

			for (const s of sessions) {
				const isActive = s.id === activePiSessionId;
				const name = s.name || s.firstMessage.slice(0, 40) || "Untitled";
				items.push({
					id: `session:open:${s.path}`,
					group: "Session",
					label: name,
					description: isActive ? "Currently open" : undefined,
					icon: <Code className="size-4" />,
					badge: isActive ? "Active" : undefined,
					action: () => {
						onOpenChange(false);
						if (!isActive) onOpenSession(s.path);
					},
				});
			}
		}

		// UI toggles
		items.push({
			id: "ui:bash",
			group: "Interface",
			label: bashOpen ? "Hide bash panel" : "Show bash panel",
			icon: <Terminal className="size-4" />,
			action: () => {
				onOpenChange(false);
				onToggleBash();
			},
		});

		items.push({
			id: "ui:settings",
			group: "Interface",
			label: settingsOpen ? "Close settings" : "Open settings",
			icon: <Cog className="size-4" />,
			action: () => {
				onOpenChange(false);
				onToggleSettings();
			},
		});

		// Theme actions
		const themeOptions = [
			{ value: "system" as const, label: "Theme: System", icon: <Monitor className="size-4" /> },
			{ value: "light" as const, label: "Theme: Light", icon: <Sun className="size-4" /> },
			{ value: "dark" as const, label: "Theme: Dark", icon: <Moon className="size-4" /> },
		];
		for (const opt of themeOptions) {
			items.push({
				id: `theme:${opt.value}`,
				group: "Interface",
				label: opt.label,
				icon: opt.icon,
				badge: choice === opt.value ? "Current" : undefined,
				action: () => {
					onOpenChange(false);
					setChoice(opt.value);
				},
			});
		}

		// Model switching (only when a session is active)
		if (activeSessionId) {
			for (const m of models) {
				items.push({
					id: `model:${m.provider}/${m.id}`,
					group: "Model",
					label: `${m.provider} / ${m.name}`,
					icon: <ChevronsUpDown className="size-4" />,
					action: () => {
						onOpenChange(false);
						void pi.rpc.send(activeSessionId, {
							type: "set_model",
							provider: m.provider,
							modelId: m.id,
						});
					},
				});
			}

			// Thinking levels
			const levels = ["off", "medium", "high", "xhigh"] as const;
			for (const level of levels) {
				items.push({
					id: `thinking:${level}`,
					group: "Thinking",
					label: `Thinking: ${level}`,
					icon: <Palette className="size-4" />,
					action: () => {
						onOpenChange(false);
						void pi.rpc.send(activeSessionId, {
							type: "set_thinking_level",
							level,
						});
					},
				});
			}

			// Slash commands
			for (const cmd of commands) {
				items.push({
					id: `cmd:${cmd.source}:${cmd.name}`,
					group: "Commands",
					label: `/${cmd.name}`,
					description: cmd.description,
					badge: cmd.source,
					icon: <Code className="size-4" />,
					action: () => {
						onOpenChange(false);
						void pi.rpc.send(activeSessionId, {
							type: "prompt",
							message: `/${cmd.name}`,
						});
					},
				});
			}
		}

		return items;
	}, [
		workspaces,
		activeWorkspaceId,
		sessions,
		activeSessionId,
		activePiSessionId,
		bashOpen,
		settingsOpen,
		choice,
		models,
		commands,
		onOpenChange,
		onSelectWorkspace,
		onAddWorkspace,
		onOpenSession,
		onToggleBash,
		onToggleSettings,
		setChoice,
	]);

	// Filter by fuzzy search
	const filtered = useMemo(() => {
		if (!query.trim()) return allItems;
		return allItems.filter(
			(item) =>
				fuzzyMatch(item.label, query) ||
				(item.description && fuzzyMatch(item.description, query)) ||
				fuzzyMatch(item.group, query),
		);
	}, [allItems, query]);

	// Group filtered items
	const grouped = useMemo(() => {
		const map = new Map<string, CommandItem[]>();
		for (const item of filtered) {
			const arr = map.get(item.group) ?? [];
			arr.push(item);
			map.set(item.group, arr);
		}
		return Array.from(map.entries());
	}, [filtered]);

	// Clamp selected index when filtered list changes
	useEffect(() => {
		setSelectedIndex(0);
	}, [filtered.length]);

	// Flatten for keyboard nav
	const flatItems = useMemo(() => filtered, [filtered]);

	const executeItem = useCallback((item: CommandItem) => {
		void Promise.resolve(item.action());
	}, []);

	// Keyboard handlers
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((i) => Math.max(i - 1, 0));
			} else if (e.key === "Enter") {
				e.preventDefault();
				const item = flatItems[selectedIndex];
				if (item) executeItem(item);
			}
		},
		[flatItems, selectedIndex, executeItem],
	);

	// Scroll selected item into view
	useEffect(() => {
		const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
		el?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex]);

	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
				<DialogPrimitive.Content
					className={cn(
						"fixed left-[50%] top-[15%] z-50 w-full max-w-[580px] translate-x-[-50%] overflow-hidden",
						"rounded-[24px] border border-border/60 bg-card shadow-[0_25px_60px_rgba(0,0,0,0.12)]",
						"data-[state=open]:animate-in data-[state=closed]:animate-out",
						"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
						"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
						"duration-150",
					)}
					onKeyDown={handleKeyDown}
				>
					<DialogPrimitive.Title className="sr-only">Command Palette</DialogPrimitive.Title>
					<DialogPrimitive.Description className="sr-only">
						Quick launcher for workspaces, sessions, models, and commands
					</DialogPrimitive.Description>

					{/* Search input */}
					<div className="flex items-center gap-3 border-b border-border/40 px-5 py-3.5">
						<Search className="size-4 shrink-0 text-muted-foreground" />
						<input
							ref={inputRef}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Type a command or search…"
							className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
						/>
						<kbd className="hidden rounded-md border border-border/60 bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
							Esc
						</kbd>
					</div>

					{/* Results list */}
					<div ref={listRef} className="max-h-[380px] overflow-y-auto py-2">
						{flatItems.length === 0 ? (
							<div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
								No results for "{query}"
							</div>
						) : (
							grouped.map(([group, items]) => (
								<div key={group}>
									<div className="px-5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60 first:pt-1">
										{group}
									</div>
									{items.map((item) => {
										const globalIdx = flatItems.indexOf(item);
										const isSelected = globalIdx === selectedIndex;
										return (
											<button
												key={item.id}
												data-index={globalIdx}
												onClick={() => executeItem(item)}
												onMouseEnter={() => setSelectedIndex(globalIdx)}
												className={cn(
													"flex w-full cursor-pointer items-center gap-3 px-5 py-2.5 text-left transition-colors duration-75",
													isSelected
														? "bg-foreground/[0.05] text-foreground"
														: "text-foreground/70 hover:bg-foreground/[0.03] hover:text-foreground",
												)}
											>
												<span
													className={cn(
														"flex size-7 shrink-0 items-center justify-center rounded-[10px]",
														isSelected
															? "bg-primary/10 text-primary"
															: "bg-foreground/[0.04] text-muted-foreground",
													)}
												>
													{item.icon}
												</span>
												<span className="min-w-0 flex-1 truncate text-[13px] font-medium">
													{highlightMatch(item.label, query)}
												</span>
												{item.description ? (
													<span className="shrink-0 truncate text-[11px] text-muted-foreground/70 max-w-[160px]">
														{item.description}
													</span>
												) : null}
												{item.badge ? (
													<Badge
														variant={
															item.badge === "Active" || item.badge === "Current"
																? "primary"
																: "default"
														}
														size="sm"
													>
														{item.badge}
													</Badge>
												) : null}
											</button>
										);
									})}
								</div>
							))
						)}
					</div>

					{/* Footer hint */}
					<div className="flex items-center gap-4 border-t border-border/40 px-5 py-2.5 text-[10px] text-muted-foreground/60">
						<span>
							<kbd className="rounded border border-border/60 bg-foreground/[0.04] px-1 py-px font-mono">
								↑↓
							</kbd>{" "}
							Navigate
						</span>
						<span>
							<kbd className="rounded border border-border/60 bg-foreground/[0.04] px-1 py-px font-mono">
								↵
							</kbd>{" "}
							Select
						</span>
						<span>
							<kbd className="rounded border border-border/60 bg-foreground/[0.04] px-1 py-px font-mono">
								Esc
							</kbd>{" "}
							Close
						</span>
					</div>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
