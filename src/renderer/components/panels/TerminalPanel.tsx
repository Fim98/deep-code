import { ChevronDown, ChevronUp, Plus, Terminal as TerminalIcon, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { pi } from "@/lib/rpc";
import { cn } from "@/lib/utils";
import { useTheme } from "@/stores/theme";

import "@xterm/xterm/css/xterm.css";

interface TerminalTab {
	id: string;
	shell: string;
	cwd: string;
	title: string;
}

interface Props {
	cwd?: string;
	expanded: boolean;
	onToggle: () => void;
	onClose: () => void;
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
	const terminalsRef = useRef<Map<string, any>>(new Map());
	const containerRef = useRef<HTMLDivElement>(null);
	const fitAddonRef = useRef<Map<string, any>>(new Map());
	const isDark = useTheme((s) => s.applied === "dark");

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

		setTabs((prev) => [...prev, newTab]);
		setActiveTabId(result.id);
		return result.id;
	}, [cwd]);

	const closeTerminal = useCallback(
		async (id: string) => {
			await pi.pty.kill(id);
			terminalsRef.current.get(id)?.dispose();
			terminalsRef.current.delete(id);
			fitAddonRef.current.delete(id);
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
		[activeTabId, onClose],
	);

	const initTerminal = useCallback(
		async (tabId: string) => {
			const container = document.getElementById(`xterm-${tabId}`);
			if (!container) return;

			const { Terminal } = await import("@xterm/xterm");
			const { FitAddon } = await import("@xterm/addon-fit");
			const { WebLinksAddon } = await import("@xterm/addon-web-links");

			const existing = terminalsRef.current.get(tabId);
			if (existing) existing.dispose();

			const terminal = new Terminal({
				cursorBlink: true,
				cursorStyle: "bar",
				fontSize: 13,
				lineHeight: 1.25,
				fontFamily:
					"'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
				theme: getXtermTheme(isDark),
				allowTransparency: false,
				scrollback: 10000,
				convertEol: true,
			});

			const fitAddon = new FitAddon();
			terminal.loadAddon(fitAddon);
			terminal.loadAddon(new WebLinksAddon());
			terminal.open(container);

			terminalsRef.current.set(tabId, terminal);
			fitAddonRef.current.set(tabId, fitAddon);

			terminal.onData((data) => {
				void pi.pty.write(tabId, data);
			});

			terminal.onResize(({ cols, rows }) => {
				void pi.pty.resize(tabId, cols, rows);
			});

			terminal.focus();
		},
		[isDark],
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
			terminalsRef.current.get(id)?.write(data);
		});
		const unsubExit = pi.pty.onExit(({ id }) => {
			setTabs((prev) => prev.filter((t) => t.id !== id));
			terminalsRef.current.get(id)?.dispose();
			terminalsRef.current.delete(id);
			fitAddonRef.current.delete(id);
		});
		return () => {
			unsubData();
			unsubExit();
		};
	}, []);

	// Auto-create first terminal on mount
	useEffect(() => {
		if (tabs.length === 0) void createTerminal();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Init terminal when tab becomes active
	useEffect(() => {
		if (activeTabId && !terminalsRef.current.has(activeTabId)) {
			const timer = setTimeout(() => void initTerminal(activeTabId), 80);
			return () => clearTimeout(timer);
		}
	}, [activeTabId, tabs.length, initTerminal]);

	// Fit on expand + resize observer (always active even when collapsed,
	// so when it expands the container has correct dimensions)
	useEffect(() => {
		const doFit = () => {
			if (activeTabId && expanded) {
				try {
					// biome-ignore lint/suspicious/noFocusedTests: xterm.js fit() method, not a test
					fitAddonRef.current.get(activeTabId)?.fit();
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
	}, [activeTabId, expanded]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			for (const [id] of terminalsRef.current) void pi.pty.kill(id);
		};
	}, []);

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
						{tabs.map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTabId(tab.id)}
								className={cn(
									"group relative flex h-6 shrink-0 items-center gap-1 rounded-[6px] px-2 text-[11px] font-medium transition-colors duration-100",
									activeTabId === tab.id
										? "bg-foreground/[0.06] text-foreground"
										: "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground/70",
								)}
							>
								<TerminalIcon className="size-2.5 shrink-0 opacity-50" />
								<span className="max-w-[80px] truncate">{tab.title}</span>
								{tabs.length > 1 && (
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
							</button>
						))}
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

			{/* Terminal area — always in DOM, height toggled via CSS to preserve xterm content */}
			<div
				ref={containerRef}
				className={cn(
					"relative overflow-hidden transition-[height] duration-200 ease-out",
					expanded ? "h-[260px]" : "h-0",
				)}
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
