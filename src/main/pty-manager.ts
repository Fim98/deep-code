/**
 * PTY Manager - manages pseudo-terminal instances using node-pty.
 * Each PTY is identified by a unique ID and can be spawned, written to,
 * resized, or killed.
 */

import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as pty from "node-pty";

export interface PtyOptions {
	cwd?: string;
	shell?: string;
	env?: Record<string, string>;
	cols?: number;
	rows?: number;
}

export interface PtyInstance {
	id: string;
	process: pty.IPty;
	cwd: string;
	shell: string;
	title: string;
}

class PtyManager extends EventEmitter {
	private instances = new Map<string, PtyInstance>();
	private shimDir: string;

	constructor() {
		super();
		// Create a zsh shim directory with a .zshenv that disables PROMPT_SP.
		// This prevents zsh from outputting the reverse-video "%" marker on startup.
		// The shim .zshrc sources the real ~/.zshrc so oh-my-zsh etc. still loads.
		this.shimDir = join(tmpdir(), "deepcode-zsh-shim");
		if (!existsSync(this.shimDir)) mkdirSync(this.shimDir, { recursive: true });

		// .zshenv — loaded first, before anything else. Disable PROMPT_SP here.
		const zshenvPath = join(this.shimDir, ".zshenv");
		const zshenvContent = "unsetopt prompt_sp 2>/dev/null\n";
		try {
			if (!existsSync(zshenvPath) || readFileSync(zshenvPath, "utf-8") !== zshenvContent) {
				writeFileSync(zshenvPath, zshenvContent);
			}
		} catch {
			/* ignore */
		}

		// .zshrc — source the real ~/.zshrc
		const homeDir = process.env.HOME || "";
		const zshrcPath = join(this.shimDir, ".zshrc");
		const realRc = join(homeDir, ".zshrc");
		const zshrcContent = `# deepcode shim\nunsetopt prompt_sp 2>/dev/null\nif [ -f "${realRc}" ]; then\n  source "${realRc}"\nfi\n`;
		try {
			if (!existsSync(zshrcPath) || readFileSync(zshrcPath, "utf-8") !== zshrcContent) {
				writeFileSync(zshrcPath, zshrcContent);
			}
		} catch {
			/* ignore */
		}
	}

	spawn(options: PtyOptions = {}): PtyInstance {
		const id = randomUUID();
		const shell = options.shell || this.getDefaultShell();
		const cwd = options.cwd || process.env.HOME || "/";
		const cols = options.cols || 80;
		const rows = options.rows || 24;

		const env: Record<string, string> = {
			...process.env,
			...options.env,
			TERM: "xterm-256color",
			COLORTERM: "truecolor",
		} as Record<string, string>;

		// For zsh, point ZDOTDIR to our shim directory which contains:
		// - .zshenv: unsetopt prompt_sp (prevents the reverse-video "%" flash)
		// - .zshrc: sources the real ~/.zshrc (oh-my-zsh, etc.)
		// No shell args needed — node-pty allocates a TTY, zsh auto-detects interactive mode.
		const shellBase = shell.split("/").pop() ?? "";
		if (shellBase === "zsh") {
			env.ZDOTDIR = this.shimDir;
		}
		const shellArgs: string[] = [];

		const ptyProcess = pty.spawn(shell, shellArgs, {
			name: "xterm-256color",
			cols,
			rows,
			cwd,
			env,
		});

		const instance: PtyInstance = {
			id,
			process: ptyProcess,
			cwd,
			shell,
			title: shell,
		};

		this.instances.set(id, instance);

		// Forward data events
		ptyProcess.onData((data) => {
			this.emit("data", { id, data });
		});

		// Forward exit events
		ptyProcess.onExit(({ exitCode, signal }) => {
			this.emit("exit", { id, exitCode, signal });
			this.instances.delete(id);
		});

		return instance;
	}

	write(id: string, data: string): void {
		const instance = this.instances.get(id);
		if (instance) {
			instance.process.write(data);
		}
	}

	resize(id: string, cols: number, rows: number): void {
		const instance = this.instances.get(id);
		if (instance) {
			try {
				instance.process.resize(cols, rows);
			} catch (err) {
				console.error(`[PTY] Failed to resize ${id}:`, err);
			}
		}
	}

	kill(id: string): void {
		const instance = this.instances.get(id);
		if (instance) {
			instance.process.kill();
			this.instances.delete(id);
		}
	}

	killAll(): void {
		for (const [id] of this.instances) {
			this.kill(id);
		}
	}

	get(id: string): PtyInstance | undefined {
		return this.instances.get(id);
	}

	list(): Array<{ id: string; cwd: string; shell: string; title: string }> {
		return Array.from(this.instances.values()).map((inst) => ({
			id: inst.id,
			cwd: inst.cwd,
			shell: inst.shell,
			title: inst.title,
		}));
	}

	private getDefaultShell(): string {
		if (process.platform === "win32") {
			return process.env.COMSPEC || "powershell.exe";
		}
		return process.env.SHELL || "/bin/bash";
	}
}

export const ptyManager = new PtyManager();
