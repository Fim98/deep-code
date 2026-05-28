/**
 * Vitest setup for renderer (jsdom) tests.
 *
 * - Registers @testing-library/jest-dom matchers.
 * - Provides a mock `window.pi` bridge backed by vitest mocks.
 * - Stubs `window.matchMedia` (jsdom doesn't implement it).
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// jest-dom matchers
// ---------------------------------------------------------------------------
// `@testing-library/jest-dom/vitest` auto-extends expect via side-effect import.

// ---------------------------------------------------------------------------
// Mock `window.pi` bridge
// ---------------------------------------------------------------------------
const mockPi = {
	ping: vi.fn().mockResolvedValue("pong"),
	workspaces: {
		list: vi.fn().mockResolvedValue([]),
		getActive: vi.fn().mockResolvedValue(null),
		setActive: vi.fn().mockResolvedValue(undefined),
		add: vi.fn().mockResolvedValue({}),
		remove: vi.fn().mockResolvedValue(undefined),
		pickDirectory: vi.fn().mockResolvedValue(null),
	},
	sessions: {
		list: vi.fn().mockResolvedValue([]),
		open: vi.fn().mockResolvedValue({}),
		close: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
		tree: vi.fn().mockResolvedValue({ tree: [], leafId: null }),
		exportHtml: vi.fn().mockResolvedValue(null),
	},
	shell: {
		showItemInFolder: vi.fn().mockResolvedValue(undefined),
	},
	logs: {
		get: vi.fn().mockResolvedValue([]),
		clear: vi.fn().mockResolvedValue(undefined),
	},
	fileTree: {
		list: vi.fn().mockResolvedValue([]),
	},
	window: {
		new: vi.fn().mockResolvedValue(undefined),
	},
	rpc: {
		send: vi.fn().mockResolvedValue({ success: true }),
		subscribe: vi.fn().mockReturnValue(() => {}),
	},
	theme: {
		setSource: vi.fn().mockResolvedValue("light"),
		get: vi.fn().mockResolvedValue({ source: "system", shouldUseDark: false }),
		onUpdate: vi.fn().mockReturnValue(() => {}),
	},
	auth: {
		list: vi.fn().mockResolvedValue([]),
		knownProviders: vi.fn().mockResolvedValue([]),
		setKey: vi.fn().mockResolvedValue(undefined),
		remove: vi.fn().mockResolvedValue(undefined),
	},
	settings: {
		get: vi.fn().mockResolvedValue({
			defaultProvider: undefined,
			defaultModel: undefined,
			defaultThinkingLevel: "off",
			transport: "sse",
			steeringMode: "all",
			followUpMode: "all",
			theme: undefined,
			compactionEnabled: true,
			retryEnabled: true,
			hideThinkingBlock: false,
			showImages: true,
			imageAutoResize: true,
			blockImages: false,
			enabledModels: undefined,
		}),
		set: vi.fn().mockResolvedValue(undefined),
		agentDir: vi.fn().mockResolvedValue("/tmp/test-agent"),
	},
	appInfo: {
		version: vi.fn().mockResolvedValue("0.0.0-test"),
	},
	updater: {
		check: vi.fn().mockResolvedValue(undefined),
		install: vi.fn().mockResolvedValue(undefined),
		onState: vi.fn().mockReturnValue(() => {}),
	},
};

Object.defineProperty(window, "pi", {
	value: mockPi,
	writable: true,
	configurable: true,
});

// ---------------------------------------------------------------------------
// Stub `window.matchMedia` (jsdom does not implement it)
// ---------------------------------------------------------------------------
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// ---------------------------------------------------------------------------
// Stub IntersectionObserver (used by scroll-area, virtualized lists, etc.)
// ---------------------------------------------------------------------------
class MockIntersectionObserver {
	readonly root = null;
	readonly rootMargin = "";
	readonly thresholds: number[] = [];
	disconnect = vi.fn();
	observe = vi.fn();
	unobserve = vi.fn();
	takeRecords = vi.fn().mockReturnValue([]);
}
Object.defineProperty(window, "IntersectionObserver", {
	writable: true,
	value: MockIntersectionObserver,
});

// ---------------------------------------------------------------------------
// Stub ResizeObserver (used by Radix ScrollArea)
// ---------------------------------------------------------------------------
class MockResizeObserver {
	disconnect = vi.fn();
	observe = vi.fn();
	unobserve = vi.fn();
}
Object.defineProperty(window, "ResizeObserver", {
	writable: true,
	value: MockResizeObserver,
});

// ---------------------------------------------------------------------------
// Stub Element.prototype.scrollIntoView (jsdom does not implement it)
// ---------------------------------------------------------------------------
Element.prototype.scrollIntoView = vi.fn();

// ---------------------------------------------------------------------------
// Suppress noisy console.error in jsdom (optional, Radix portals etc.)
// ---------------------------------------------------------------------------
const origError = console.error;
console.error = (...args: unknown[]) => {
	const msg = typeof args[0] === "string" ? args[0] : "";
	// Suppress known harmless warnings
	if (msg.includes("ReactDOM.render is no longer supported")) return;
	if (msg.includes("Warning:")) return;
	origError(...args);
};
