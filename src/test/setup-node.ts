/**
 * Vitest setup for main-process (node) tests.
 *
 * Provides lightweight in-memory mocks for `electron`, `electron-store`,
 * and the pi SDK so that unit tests can run without a real Electron
 * runtime or filesystem side-effects.
 */
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock `electron`
// ---------------------------------------------------------------------------
vi.mock("electron", () => ({
	app: {
		getPath: vi.fn(() => "/tmp/antcode-test"),
		getName: vi.fn(() => "antcode-test"),
		getVersion: vi.fn(() => "0.0.0-test"),
	},
	ipcMain: {
		handle: vi.fn(),
		on: vi.fn(),
	},
	nativeTheme: {
		themeSource: "system",
		shouldUseDarkColors: false,
		on: vi.fn(),
	},
	dialog: {
		showOpenDialog: vi.fn(),
	},
	BrowserWindow: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock `electron-store` — in-memory Map-backed store
// ---------------------------------------------------------------------------
vi.mock("electron-store", () => {
	return {
		default: class MockStore<T extends Record<string, unknown>> {
			private data = new Map<string, unknown>();
			private defaults: T;

			constructor(opts?: { defaults?: T }) {
				this.defaults = (opts?.defaults ?? {}) as T;
				// seed defaults
				for (const [k, v] of Object.entries(this.defaults)) {
					this.data.set(k, v);
				}
			}

			get<K extends keyof T>(key: K): T[K] {
				if (this.data.has(key as string)) return this.data.get(key as string) as T[K];
				return this.defaults[key];
			}

			set(key: keyof T | Record<string, unknown>, value?: unknown): void {
				if (typeof key === "object") {
					for (const [k, v] of Object.entries(key)) this.data.set(k, v);
				} else {
					this.data.set(key as string, value);
				}
			}

			delete(key: keyof T): void {
				this.data.delete(key as string);
			}

			clear(): void {
				this.data.clear();
			}

			has(key: keyof T): boolean {
				return this.data.has(key as string);
			}

			get size(): number {
				return this.data.size;
			}

			get store(): T {
				const out: Record<string, unknown> = {};
				for (const [k, v] of this.data) out[k] = v;
				return out as T;
			}
		},
	};
});
