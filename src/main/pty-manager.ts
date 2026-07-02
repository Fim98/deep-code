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
	buffer: string;
}

const BUFFER_LIMIT = 1024 * 1024 * 2;
const BUFFER_TRIM_SIZE = 64 * 1024;

class PtyManager extends EventEmitter {
	private instances = new Map<string, PtyInstance>();
	private shimDir: string;

	constructor() {
		super();
		// Create a zsh shim directory with a .zshenv that disables PROMPT_SP.
		// This prevents zsh from outputting the reverse-video "%" marker on startup.
		// The shim .zshrc sources the real ~/.zshrc so oh-my-zsh etc. still loads.
		this.shimDir = join(tmpdir(), "antcode-zsh-shim");
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
		const zshrcContent = `# antcode shim\nunsetopt prompt_sp 2>/dev/null\nif [ -f "${realRc}" ]; then\n  source "${realRc}"\nfi\n`;
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
			TERM_PROGRAM: "AntCode",
			ANTCODE_TERMINAL: "1",
		} as Record<string, string>;
		const utf8Locale = this.getUtf8Locale(env);
		env.LANG = utf8Locale;
		env.LC_CTYPE = utf8Locale;
		if (env.LC_ALL && !this.isUtf8Locale(env.LC_ALL)) {
			env.LC_ALL = utf8Locale;
		}

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
			buffer: "",
		};

		this.instances.set(id, instance);

		// Forward data events
		ptyProcess.onData((data) => {
			this.appendBuffer(instance, data);
			this.updateTitleFromOutput(instance, data);
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

	rename(id: string, title: string): boolean {
		const instance = this.instances.get(id);
		if (!instance) return false;
		const trimmed = title.trim();
		if (!trimmed) return false;
		if (trimmed === instance.title) return true;
		instance.title = trimmed;
		this.emit("title", { id, title: trimmed });
		return true;
	}

	killAll(): void {
		for (const [id] of this.instances) {
			this.kill(id);
		}
	}

	get(id: string): PtyInstance | undefined {
		return this.instances.get(id);
	}

	list(): Array<{ id: string; cwd: string; shell: string; title: string; buffer: string }> {
		return Array.from(this.instances.values()).map((inst) => ({
			id: inst.id,
			cwd: inst.cwd,
			shell: inst.shell,
			title: inst.title,
			buffer: inst.buffer,
		}));
	}

	private getDefaultShell(): string {
		if (process.platform === "win32") {
			return process.env.COMSPEC || "powershell.exe";
		}
		return process.env.SHELL || "/bin/bash";
	}

	private appendBuffer(instance: PtyInstance, data: string): void {
		instance.buffer += data;
		if (instance.buffer.length <= BUFFER_LIMIT) return;
		instance.buffer = instance.buffer.slice(-(BUFFER_LIMIT - BUFFER_TRIM_SIZE));
	}

	private updateTitleFromOutput(instance: PtyInstance, data: string): void {
		// biome-ignore lint/suspicious/noControlCharactersInRegex: parsing ANSI OSC title sequences
		const pattern = /\x1b\](?:0|1|2);([^\x07\x1b]*)(?:\x07|\x1b\\)/g;
		let match: RegExpExecArray | null;
		// biome-ignore lint/suspicious/noAssignInExpressions: standard RegExp.exec loop idiom
		while ((match = pattern.exec(data))) {
			const title = match[1]
				// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI control bytes from titles
				?.replace(/[\u0000-\u001f\u007f]/g, "")
				.trim()
				.slice(0, 120);
			if (!title || title === instance.title) continue;
			instance.title = title;
			this.emit("title", { id: instance.id, title });
		}
	}

	private isUtf8Locale(value: string | undefined): boolean {
		return /utf-?8/i.test(value ?? "");
	}

	private getUtf8Locale(env: Record<string, string>): string {
		const candidates = [env.LC_ALL, env.LC_CTYPE, env.LANG];
		return candidates.find((value) => this.isUtf8Locale(value)) || "en_US.UTF-8";
	}
}

export const ptyManager = new PtyManager();
