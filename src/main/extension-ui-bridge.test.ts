import { describe, expect, it, vi } from "vitest";
import { ExtensionUIBridge } from "./extension-ui-bridge.js";

// Mock BrowserWindow
function createMockWindow() {
	const sent: any[] = [];
	return {
		isDestroyed: () => false,
		webContents: {
			send: (_channel: string, request: any) => sent.push(request),
		},
		sent,
	};
}

describe("ExtensionUIBridge", () => {
	it("creates a UI context", () => {
		const bridge = new ExtensionUIBridge();
		const ctx = bridge.createUIContext();
		expect(ctx).toBeDefined();
		expect(typeof ctx.select).toBe("function");
		expect(typeof ctx.confirm).toBe("function");
		expect(typeof ctx.input).toBe("function");
		expect(typeof ctx.editor).toBe("function");
		expect(typeof ctx.notify).toBe("function");
		expect(typeof ctx.setStatus).toBe("function");
		expect(typeof ctx.setTitle).toBe("function");
	});

	it("emits notify events (fire-and-forget)", () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "test-session");
		const ctx = bridge.createUIContext();

		ctx.notify("Hello world", "info");

		expect(win.sent).toHaveLength(1);
		expect(win.sent[0].method).toBe("notify");
		expect(win.sent[0].message).toBe("Hello world");
		expect(win.sent[0].notifyType).toBe("info");
		expect(win.sent[0].sessionId).toBe("test-session");
		expect(win.sent[0].type).toBe("extension_ui_request");
	});

	it("emits setStatus events", () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		ctx.setStatus("git", "main branch");

		expect(win.sent).toHaveLength(1);
		expect(win.sent[0].method).toBe("setStatus");
		expect(win.sent[0].statusKey).toBe("git");
		expect(win.sent[0].statusText).toBe("main branch");
		expect(win.sent[0].sessionId).toBe("sess-1");
	});

	it("emits setStatus with undefined to clear", () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		ctx.setStatus("git", undefined);

		expect(win.sent).toHaveLength(1);
		expect(win.sent[0].statusText).toBeUndefined();
	});

	it("emits setTitle events", () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		ctx.setTitle("My Project");

		expect(win.sent).toHaveLength(1);
		expect(win.sent[0].method).toBe("setTitle");
		expect(win.sent[0].title).toBe("My Project");
	});

	it("emits set_editor_text events", () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		ctx.setEditorText("some text");

		expect(win.sent).toHaveLength(1);
		expect(win.sent[0].method).toBe("set_editor_text");
		expect(win.sent[0].text).toBe("some text");
	});

	it("emits setWidget events with string arrays", () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		ctx.setWidget("status", ["line 1", "line 2"]);

		expect(win.sent).toHaveLength(1);
		expect(win.sent[0].method).toBe("setWidget");
		expect(win.sent[0].widgetKey).toBe("status");
		expect(win.sent[0].widgetLines).toEqual(["line 1", "line 2"]);
	});

	it("emits select request and resolves on response", async () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		const promise = ctx.select("Pick one", ["a", "b", "c"]);

		// Check request was emitted
		expect(win.sent).toHaveLength(1);
		expect(win.sent[0].method).toBe("select");
		expect(win.sent[0].options).toEqual(["a", "b", "c"]);

		const requestId = win.sent[0].id;

		// Simulate response from renderer
		bridge.handleResponse({
			type: "extension_ui_response",
			id: requestId,
			value: "b",
		});

		const result = await promise;
		expect(result).toBe("b");
	});

	it("resolves undefined on cancelled response", async () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		const promise = ctx.select("Pick one", ["x", "y"]);
		const requestId = win.sent[0].id;

		bridge.handleResponse({
			type: "extension_ui_response",
			id: requestId,
			cancelled: true,
		});

		const result = await promise;
		expect(result).toBeUndefined();
	});

	it("resolves boolean on confirm response", async () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		const promise = ctx.confirm("Sure?", "Are you sure?");
		const requestId = win.sent[0].id;

		bridge.handleResponse({
			type: "extension_ui_response",
			id: requestId,
			confirmed: true,
		});

		const result = await promise;
		expect(result).toBe(true);
	});

	it("resolves default on aborted signal", async () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		const controller = new AbortController();
		controller.abort();

		const result = await ctx.select("Pick", ["a"], { signal: controller.signal });
		expect(result).toBeUndefined();
		// No request should be emitted when signal already aborted
		expect(win.sent).toHaveLength(0);
	});

	it("resolves default on timeout", async () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		vi.useFakeTimers();

		const promise = ctx.confirm("Sure?", "msg", { timeout: 100 });
		expect(win.sent).toHaveLength(1);

		vi.advanceTimersByTime(150);

		const result = await promise;
		expect(result).toBe(false);

		vi.useRealTimers();
	});

	it("editor resolves with string value", async () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		const promise = ctx.editor("Edit code", "initial text");
		expect(win.sent).toHaveLength(1);
		expect(win.sent[0].method).toBe("editor");
		expect(win.sent[0].prefill).toBe("initial text");

		const requestId = win.sent[0].id;
		bridge.handleResponse({
			type: "extension_ui_response",
			id: requestId,
			value: "modified text",
		});

		const result = await promise;
		expect(result).toBe("modified text");
	});

	it("dispose resolves all pending requests", async () => {
		const bridge = new ExtensionUIBridge();
		const win = createMockWindow();
		bridge.bindWindow(win as any, "sess-1");
		const ctx = bridge.createUIContext();

		const p1 = ctx.select("Pick", ["a"]);
		const p2 = ctx.confirm("Sure?", "msg");

		bridge.dispose();

		const [r1, r2] = await Promise.all([p1, p2]);
		expect(r1).toBeUndefined();
		expect(r2).toBeUndefined();
	});

	it("ignores unknown response ids", () => {
		const bridge = new ExtensionUIBridge();
		// Should not throw
		bridge.handleResponse({
			type: "extension_ui_response",
			id: "nonexistent",
			value: "x",
		});
	});

	it("noop methods do not throw", () => {
		const bridge = new ExtensionUIBridge();
		const ctx = bridge.createUIContext();

		expect(() => ctx.onTerminalInput(() => undefined)).not.toThrow();
		expect(() => ctx.setWorkingMessage("loading")).not.toThrow();
		expect(() => ctx.setWorkingVisible(false)).not.toThrow();
		expect(() => ctx.setWorkingIndicator()).not.toThrow();
		expect(() => ctx.setHiddenThinkingLabel("thinking")).not.toThrow();
		expect(() => ctx.setFooter(undefined)).not.toThrow();
		expect(() => ctx.setHeader(undefined)).not.toThrow();
		expect(() => ctx.addAutocompleteProvider((x: any) => x)).not.toThrow();
		expect(() => ctx.setEditorComponent(undefined)).not.toThrow();
		expect(ctx.getEditorComponent()).toBeUndefined();
		expect(ctx.getEditorText()).toBe("");
		expect(ctx.getToolsExpanded()).toBe(false);
		expect(() => ctx.setToolsExpanded(true)).not.toThrow();
	});
});
