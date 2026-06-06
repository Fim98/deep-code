import { ChevronDown, ChevronUp, Plus, Terminal as TerminalIcon, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { useI18n } from "@/lib/i18n";
import { pi } from "@/lib/rpc";
import { cn } from "@/lib/utils";
import { useTheme } from "@/stores/theme";

import "@xterm/xterm/css/xterm.css";

const HEIGHT_STORAGE_KEY = "pi.terminal.height";
const DEFAULT_HEIGHT = 260;
const MIN_HEIGHT = 100;
const COLLAPSE_THRESHOLD = 60;

function readPersistedHeight(): number {
	if (typeof window === "undefined") return DEFAULT_HEIGHT;
	try {
		const raw = localStorage.getItem(HEIGHT_STORAGE_KEY);
		if (!raw) return DEFAULT_HEIGHT;
		const n = Number.parseInt(raw, 10);
		if (!Number.isFinite(n) || n < MIN_HEIGHT) return DEFAULT_HEIGHT;
		return Math.min(n, Math.floor(window.innerHeight * 0.8));
	} catch {
		return DEFAULT_HEIGHT;
	}
}

function persistHeight(height: number) {
	try {
		localStorage.setItem(HEIGHT_STORAGE_KEY, String(Math.round(height)));
	} catch {
		// ignore quota / disabled storage
	}
}

interface TerminalTab {
	id: string;
	shell: string;
	cwd: string;
	title: string;
	buffer?: string;
}

interface Props {
	cwd?: string;
	expanded: boolean;
	onToggle: () => void;
	onClose: () => void;
}

const TERMINAL_FONT_FAMILY = [
	"'JetBrainsMono Nerd Font Mono'",
	"'SF Mono'",
	"'Cascadia Code'",
	"'Fira Code'",
	"'JetBrains Mono'",
	"Menlo",
	"Monaco",
	"'Noto Sans Mono CJK SC'",
	"'PingFang SC'",
	"'Hiragino Sans GB'",
	"'Microsoft YaHei UI'",
	"'Microsoft YaHei'",
	"monospace",
].join(", ");

type TerminalWriter = ReturnType<typeof createTerminalWriter>;

function createTerminalWriter(
	write: (data: string, done?: () => void) => void,
	schedule: (flush: () => void) => void = queueMicrotask,
) {
	let chunks: string[] | undefined;
	let waits: Array<() => void> | undefined;
	let scheduled = false;
	let writing = false;

	const settle = () => {
		if (scheduled || writing || chunks?.length) return;
		const list = waits;
		if (!list?.length) return;
		waits = undefined;
		for (const fn of list) fn();
	};

	const run = () => {
		if (writing) return;
		scheduled = false;
		const items = chunks;
		if (!items?.length) {
			settle();
			return;
		}
		chunks = undefined;
		writing = true;
		write(items.join(""), () => {
			writing = false;
			if (chunks?.length) {
				if (scheduled) return;
				scheduled = true;
				schedule(run);
				return;
			}
			settle();
		});
	};

	const push = (data: string) => {
		if (!data) return;
		if (chunks) chunks.push(data);
		else chunks = [data];

		if (scheduled || writing) return;
		scheduled = true;
		schedule(run);
	};

	const flush = (done?: () => void) => {
		if (!scheduled && !writing && !chunks?.length) {
			done?.();
			return;
		}
		if (done) {
			if (waits) waits.push(done);
			else waits = [done];
		}
		run();
	};

	return { push, flush };
}

/** xterm.js theme that adapts to light/dark mode */
function getXtermTheme(isDark: boolean) {
	if (isDark) {
		return {
			background: "#1c1c1e",
			foreground: "#e5e5ea",
			cursor: "#f5f5f7",
			cursorAccent: "#1c1c1e",
			selectionBackground: "rgba(123, 123, 255, 0.25)",
			selectionForeground: "#f5f5f7",
			black: "#3a3a3c",
			red: "#ff453a",
			green: "#30d158",
			yellow: "#ffd60a",
			blue: "#7b7bff",
			magenta: "#bf5af2",
			cyan: "#64d2ff",
			white: "#e5e5ea",
			brightBlack: "#636366",
			brightRed: "#ff6961",
			brightGreen: "#30d158",
			brightYellow: "#ffd60a",
			brightBlue: "#8b8bff",
			brightMagenta: "#bf5af2",
			brightCyan: "#64d2ff",
			brightWhite: "#f5f5f7",
		};
	}
	return {
		background: "#f5f5f7",
		foreground: "#1d1d1f",
		cursor: "#5b5bf7",
		cursorAccent: "#f5f5f7",
		selectionBackground: "rgba(91, 91, 247, 0.18)",
		selectionForeground: "#1d1d1f",
		black: "#1d1d1f",
		red: "#ff3b30",
		green: "#34c759",
		yellow: "#ff9f0a",
		blue: "#5b5bf7",
		magenta: "#af52de",
		cyan: "#5ac8fa",
		white: "#e5e5ea",
		brightBlack: "#636366",
		brightRed: "#ff3b30",
		brightGreen: "#34c759",
		brightYellow: "#ff9f0a",
		brightBlue: "#6b6bff",
		brightMagenta: "#af52de",
		brightCyan: "#5ac8fa",
		brightWhite: "#f5f5f7",
	};
}

export function TerminalPanel({ cwd, expanded, onToggle, onClose }: Props) {
	const { t } = useI18n();
	const [tabs, setTabs] = useState<TerminalTab[]>([]);
	const [activeTabId, setActiveTabId] = useState<string | null>(null);
	const [height, setHeight] = useState<number>(() => readPersistedHeight());
	const [isResizing, setIsResizing] = useState(false);
	const terminalsRef = useRef<Map<string, any>>(new Map());
	const terminalWritersRef = useRef<Map<string, TerminalWriter>>(new Map());
	const pendingOutputRef = useRef<Map<string, string[]>>(new Map());
	const resizeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
	const terminalCleanupsRef = useRef<Map<string, Array<() => void>>>(new Map());
	const containerRef = useRef<HTMLDivElement>(null);
	const fitAddonRef = useRef<Map<string, any>>(new Map());
	const isDark = useTheme((s) => s.applied === "dark");
	const [editingTabId, setEditingTabId] = useState<string | null>(null);
	const [editingValue, setEditingValue] = useState("");
	const editInputRef = useRef<HTMLInputElement | null>(null);

	const renameTab = useCallback(async (id: string, title: string) => {
		const trimmed = title.trim();
		if (!trimmed) {
			setEditingTabId(null);
			return;
		}
		setTabs((prev) => prev.map((tab) => (tab.id === id ? { ...tab, title: trimmed } : tab)));
		setEditingTabId(null);
		try {
			await pi.pty.rename(id, trimmed);
		} catch (err) {
			console.error("[terminal] rename failed", err);
		}
	}, []);

	const startEditing = useCallback((tab: TerminalTab) => {
		setEditingTabId(tab.id);
		setEditingValue(tab.title);
	}, []);

	const cancelEditing = useCallback(() => {
		setEditingTabId(null);
		setEditingValue("");
	}, []);

	useEffect(() => {
		if (!editingTabId) return;
		editInputRef.current?.focus();
		editInputRef.current?.select();
	}, [editingTabId]);

	const handleHeightChange = useCallback((next: number) => {
		const clamped = Math.max(MIN_HEIGHT, next);
		setHeight(clamped);
		persistHeight(clamped);
	}, []);

	const handleResizeStart = useCallback(() => {
		setIsResizing(true);
	}, []);

	const handleResizeEnd = useCallback(() => {
		setIsResizing(false);
	}, []);

	// Re-clamp height when window resizes
	useEffect(() => {
		function onWindowResize() {
			setHeight((prev) => {
				const cap = Math.floor(window.innerHeight * 0.8);
				return Math.min(prev, cap);
			});
		}
		window.addEventListener("resize", onWindowResize);
		return () => window.removeEventListener("resize", onWindowResize);
	}, []);

	const cleanupTerminalUi = useCallback((id: string) => {
		const cleanups = terminalCleanupsRef.current.get(id);
		if (!cleanups) return;
		for (const cleanup of cleanups.splice(0).reverse()) {
			try {
				cleanup();
			} catch {
				// ignore
			}
		}
		terminalCleanupsRef.current.delete(id);
	}, []);

	const disposeTerminal = useCallback(
		(id: string) => {
			cleanupTerminalUi(id);
			terminalsRef.current.get(id)?.dispose();
			terminalsRef.current.delete(id);
			terminalWritersRef.current.delete(id);
			pendingOutputRef.current.delete(id);
			const timer = resizeTimersRef.current.get(id);
			if (timer) clearTimeout(timer);
			resizeTimersRef.current.delete(id);
			fitAddonRef.current.delete(id);
		},
		[cleanupTerminalUi],
	);

	const registerTerminalTab = useCallback((tab: TerminalTab) => {
		setTabs((prev) => (prev.some((item) => item.id === tab.id) ? prev : [...prev, tab]));
		setActiveTabId((prev) => prev ?? tab.id);
		if (tab.buffer) {
			const pending = pendingOutputRef.current.get(tab.id);
			pendingOutputRef.current.set(tab.id, pending ? [tab.buffer, ...pending] : [tab.buffer]);
		}
	}, []);

	const createTerminal = useCallback(async () => {
		const el = containerRef.current;
		const cols = el ? Math.floor(el.clientWidth / 7.8) : 100;
		const rows = el ? Math.floor(el.clientHeight / 16) : 20;

		const result = await pi.pty.spawn({
			cwd: cwd || undefined,
			cols: Math.max(cols, 40),
			rows: Math.max(rows, 8),
		});

		const shellName = result.shell.split("/").pop() || "Terminal";
		const newTab: TerminalTab = {
			id: result.id,
			shell: result.shell,
			cwd: result.cwd,
			title: shellName,
		};

		registerTerminalTab(newTab);
		return result.id;
	}, [cwd, registerTerminalTab]);

	const closeTerminal = useCallback(
		async (id: string) => {
			await pi.pty.kill(id);
			disposeTerminal(id);
			setTabs((prev) => {
				const next = prev.filter((t) => t.id !== id);
				if (activeTabId === id) {
					if (next.length > 0) {
						setActiveTabId(next[next.length - 1].id);
					} else {
						setActiveTabId(null);
						onClose();
					}
				}
				return next;
			});
		},
		[activeTabId, disposeTerminal, onClose],
	);

	const schedulePtyResize = useCallback((tabId: string, cols: number, rows: number) => {
		const existing = resizeTimersRef.current.get(tabId);
		if (existing) clearTimeout(existing);
		const timer = setTimeout(() => {
			resizeTimersRef.current.delete(tabId);
			void pi.pty.resize(tabId, cols, rows);
		}, 80);
		resizeTimersRef.current.set(tabId, timer);
	}, []);

	const initTerminal = useCallback(
		async (tabId: string) => {
			const container = document.getElementById(`xterm-${tabId}`);
			if (!container) return;

			const { Terminal } = await import("@xterm/xterm");
			const { FitAddon } = await import("@xterm/addon-fit");
			const { WebLinksAddon } = await import("@xterm/addon-web-links");

			const existing = terminalsRef.current.get(tabId);
			if (existing) disposeTerminal(tabId);

			const terminal = new Terminal({
				cursorBlink: true,
				cursorStyle: "bar",
				fontSize: 13,
				lineHeight: 1.28,
				letterSpacing: 0,
				fontFamily: TERMINAL_FONT_FAMILY,
				theme: getXtermTheme(isDark),
				allowTransparency: false,
				scrollback: 10000,
				convertEol: false,
			});
			terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
				const key = event.key.toLowerCase();
				if ((event.metaKey || (event.ctrlKey && event.shiftKey)) && key === "c") {
					document.execCommand("copy");
					return false;
				}
				if ((event.metaKey || (event.ctrlKey && event.shiftKey)) && key === "v") {
					void navigator.clipboard.readText().then((text) => {
						if (text) terminal.paste(text);
					});
					return false;
				}
				return true;
			});

			const fitAddon = new FitAddon();
			terminal.loadAddon(fitAddon);
			terminal.loadAddon(new WebLinksAddon());
			terminal.open(container);

			const writer = createTerminalWriter((data, done) => terminal.write(data, done));
			terminalsRef.current.set(tabId, terminal);
			terminalWritersRef.current.set(tabId, writer);
			fitAddonRef.current.set(tabId, fitAddon);

			const fitAndSync = () => {
				try {
					fitAddon.fit();
					schedulePtyResize(tabId, terminal.cols, terminal.rows);
				} catch {
					// ignore
				}
			};
			requestAnimationFrame(fitAndSync);
			requestAnimationFrame(() => requestAnimationFrame(fitAndSync));

			const pending = pendingOutputRef.current.get(tabId);
			if (pending?.length) {
				writer.push(pending.join(""));
				pendingOutputRef.current.delete(tabId);
			}

			const handleCopy = (event: ClipboardEvent) => {
				const selection = terminal.getSelection();
				if (!selection || !event.clipboardData) return;
				event.preventDefault();
				event.clipboardData.setData("text/plain", selection);
			};
			const handlePaste = (event: ClipboardEvent) => {
				const text = event.clipboardData?.getData("text/plain") ?? "";
				if (!text) return;
				event.preventDefault();
				terminal.paste(text);
			};
			const handlePointerDown = () => {
				terminal.focus();
				terminal.textarea?.focus();
			};
			container.addEventListener("copy", handleCopy, true);
			container.addEventListener("paste", handlePaste, true);
			container.addEventListener("pointerdown", handlePointerDown);
			terminalCleanupsRef.current.set(tabId, [
				() => container.removeEventListener("copy", handleCopy, true),
				() => container.removeEventListener("paste", handlePaste, true),
				() => container.removeEventListener("pointerdown", handlePointerDown),
			]);

			if (document.fonts) {
				void document.fonts.ready.then(fitAndSync);
			}

			const dataDisposable = terminal.onData((data) => {
				void pi.pty.write(tabId, data);
			});

			const resizeDisposable = terminal.onResize(({ cols, rows }) => {
				schedulePtyResize(tabId, cols, rows);
			});

			terminalCleanupsRef.current.get(tabId)?.push(
				() => dataDisposable.dispose(),
				() => resizeDisposable.dispose(),
			);

			terminal.focus();
		},
		[disposeTerminal, isDark, schedulePtyResize],
	);

	// Re-theme existing terminals when app theme changes
	useEffect(() => {
		const theme = getXtermTheme(isDark);
		for (const [, terminal] of terminalsRef.current) {
			try {
				terminal.options.theme = theme;
			} catch {
				// ignore
			}
		}
	}, [isDark]);

	// PTY events
	useEffect(() => {
		const unsubData = pi.pty.onData(({ id, data }) => {
			const writer = terminalWritersRef.current.get(id);
			if (writer) {
				writer.push(data);
				return;
			}
			const pending = pendingOutputRef.current.get(id);
			if (pending) pending.push(data);
			else pendingOutputRef.current.set(id, [data]);
		});
		const unsubExit = pi.pty.onExit(({ id }) => {
			setTabs((prev) => {
				const next = prev.filter((t) => t.id !== id);
				setActiveTabId((current) => {
					if (current !== id) return current;
					return next[next.length - 1]?.id ?? null;
				});
				return next;
			});
			const writer = terminalWritersRef.current.get(id);
			if (writer) writer.flush(() => disposeTerminal(id));
			else disposeTerminal(id);
		});
		const unsubTitle = pi.pty.onTitle(({ id, title }) => {
			setTabs((prev) => prev.map((tab) => (tab.id === id ? { ...tab, title } : tab)));
		});
		return () => {
			unsubData();
			unsubExit();
			unsubTitle();
		};
	}, [disposeTerminal]);

	// Restore existing PTYs for this workspace on mount, or create the first one.
	useEffect(() => {
		let cancelled = false;
		void pi.pty.list().then((items) => {
			if (cancelled) return;
			const matching = items.filter((item) => !cwd || item.cwd === cwd);
			if (matching.length === 0) {
				void createTerminal();
				return;
			}
			for (const item of matching) {
				registerTerminalTab({
					id: item.id,
					shell: item.shell,
					cwd: item.cwd,
					title: item.title || item.shell.split("/").pop() || "Terminal",
					buffer: item.buffer,
				});
			}
		});
		return () => {
			cancelled = true;
			for (const [id] of terminalsRef.current) disposeTerminal(id);
			setTabs([]);
			setActiveTabId(null);
		};
	}, [createTerminal, cwd, disposeTerminal, registerTerminalTab]);

	// Init/focus terminal when tab becomes active
	useEffect(() => {
		if (!activeTabId) return;
		if (!terminalsRef.current.has(activeTabId)) {
			const timer = setTimeout(() => void initTerminal(activeTabId), 80);
			return () => clearTimeout(timer);
		}
		if (expanded) {
			const terminal = terminalsRef.current.get(activeTabId);
			requestAnimationFrame(() => {
				try {
					// biome-ignore lint/suspicious/noFocusedTests: xterm.js fit() method, not a test
					fitAddonRef.current.get(activeTabId)?.fit();
					terminal?.focus();
					terminal?.textarea?.focus();
					if (terminal) schedulePtyResize(activeTabId, terminal.cols, terminal.rows);
				} catch {
					// ignore
				}
			});
		}
	}, [activeTabId, expanded, tabs.length, initTerminal, schedulePtyResize]);

	// Fit on expand + resize observer (always active even when collapsed,
	// so when it expands the container has correct dimensions)
	useEffect(() => {
		const doFit = () => {
			if (activeTabId && expanded) {
				try {
					// biome-ignore lint/suspicious/noFocusedTests: xterm.js fit() method, not a test
					fitAddonRef.current.get(activeTabId)?.fit();
					const terminal = terminalsRef.current.get(activeTabId);
					if (terminal) schedulePtyResize(activeTabId, terminal.cols, terminal.rows);
				} catch {
					// ignore
				}
			}
		};

		// Fit after a frame when expanding so the container has its full height
		if (expanded) {
			requestAnimationFrame(doFit);
			// Double rAF to ensure layout is stable
			requestAnimationFrame(() => requestAnimationFrame(doFit));
		}

		const ro = new ResizeObserver(doFit);
		if (containerRef.current) ro.observe(containerRef.current);
		window.addEventListener("resize", doFit);
		return () => {
			ro.disconnect();
			window.removeEventListener("resize", doFit);
		};
	}, [activeTabId, expanded, schedulePtyResize]);

	// Terminal UI cleanup is handled by the restore effect above.

	return (
		<div className="shrink-0 border-t border-border/50 bg-background">
			{/* Header bar — always rendered */}
			<div className="flex h-9 items-center px-3">
				<button
					type="button"
					onClick={onToggle}
					className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					{expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
					<TerminalIcon className="size-3.5" />
					{t("bash.title")}
					{tabs.length > 0 ? (
						<span className="rounded-full bg-foreground/[0.06] px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
							{tabs.length}
						</span>
					) : null}
				</button>

				{expanded ? (
					/* Tabs + actions when expanded */
					<div className="ml-3 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
						{tabs.map((tab) => {
							const isEditing = editingTabId === tab.id;
							return (
								<div
									key={tab.id}
									role="tab"
									tabIndex={0}
									onClick={() => !isEditing && setActiveTabId(tab.id)}
									onKeyDown={(e) => {
										if (isEditing) return;
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											setActiveTabId(tab.id);
										}
									}}
									className={cn(
										"group relative flex h-6 shrink-0 items-center gap-1 rounded-[6px] px-2 text-[11px] font-medium transition-colors duration-100 cursor-pointer",
										activeTabId === tab.id
											? "bg-foreground/[0.06] text-foreground"
											: "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground/70",
									)}
								>
									<TerminalIcon className="size-2.5 shrink-0 opacity-50" />
									{isEditing ? (
										<input
											ref={editInputRef}
											type="text"
											value={editingValue}
											onChange={(e) => setEditingValue(e.target.value)}
											onBlur={() => void renameTab(tab.id, editingValue)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													void renameTab(tab.id, editingValue);
												} else if (e.key === "Escape") {
													e.preventDefault();
													cancelEditing();
												}
												e.stopPropagation();
											}}
											onClick={(e) => e.stopPropagation()}
											className="max-w-[100px] rounded-sm bg-background/80 px-1 py-px text-[11px] font-medium text-foreground outline-none ring-1 ring-primary/30 focus:ring-primary/60"
										/>
									) : (
										<button
											type="button"
											onDoubleClick={(e) => {
												e.stopPropagation();
												startEditing(tab);
											}}
											className="max-w-[80px] truncate border-none bg-transparent p-0 text-inherit"
											title={tab.title}
										>
											{tab.title}
										</button>
									)}
									{tabs.length > 1 && !isEditing && (
										<span
											role="button"
											tabIndex={0}
											onClick={(e) => {
												e.stopPropagation();
												void closeTerminal(tab.id);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													e.stopPropagation();
													void closeTerminal(tab.id);
												}
											}}
											className="flex size-3.5 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-foreground/[0.08] group-hover:opacity-100 cursor-pointer"
										>
											<X className="size-2" />
										</span>
									)}
								</div>
							);
						})}
						<button
							type="button"
							onClick={() => void createTerminal()}
							className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground/40 transition-colors hover:bg-foreground/[0.04] hover:text-foreground/60"
							aria-label={t("terminal.newTab")}
						>
							<Plus className="size-3" />
						</button>
					</div>
				) : (
					<div className="ml-auto flex items-center gap-0.5">
						<Button
							size="icon-sm"
							variant="ghost"
							onClick={() => void createTerminal()}
							aria-label={t("terminal.newTab")}
						>
							<Plus className="size-3.5" />
						</Button>
					</div>
				)}

				<div className="flex shrink-0 items-center gap-0.5">
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={onClose}
						aria-label={t("bash.closeLabel")}
						className="text-muted-foreground"
					>
						<X className="size-3.5" />
					</Button>
				</div>
			</div>

			{/* Resize handle — sits between header and terminal area; drag up/down to resize */}
			<ResizeHandle
				direction="vertical"
				minSize={MIN_HEIGHT}
				maxSize={Math.max(
					MIN_HEIGHT,
					typeof window !== "undefined" ? Math.floor(window.innerHeight * 0.8) : 600,
				)}
				collapseThreshold={COLLAPSE_THRESHOLD}
				onCollapse={onClose}
				onResize={handleHeightChange}
				onResizeStart={handleResizeStart}
				onResizeEnd={handleResizeEnd}
			/>

			{/* Terminal area — always in DOM, height toggled via CSS to preserve xterm content */}
			<div
				ref={containerRef}
				className={cn(
					"relative overflow-hidden",
					!isResizing && "transition-[height] duration-200 ease-out",
					expanded ? "" : "h-0",
				)}
				style={expanded ? { height: `${height}px` } : undefined}
			>
				{tabs.map((tab) => (
					<div
						key={tab.id}
						id={`xterm-${tab.id}`}
						className={cn(
							"absolute inset-0 px-3 py-1.5",
							activeTabId === tab.id ? "visible" : "invisible",
						)}
					/>
				))}
				{tabs.length === 0 && expanded && (
					<div className="flex h-full flex-col items-center justify-center gap-2">
						<TerminalIcon className="size-5 text-muted-foreground/30" />
						<span className="text-[13px] text-muted-foreground/50">{t("terminal.noSessions")}</span>
					</div>
				)}
			</div>
		</div>
	);
}
