import { beforeEach, describe, expect, it } from "vitest";
import type {
	ExtensionUIConfirmRequest,
	ExtensionUIEditorRequest,
	ExtensionUIInputRequest,
	ExtensionUINotifyRequest,
	ExtensionUISelectRequest,
	ExtensionUISetEditorTextRequest,
	ExtensionUISetStatusRequest,
	ExtensionUISetTitleRequest,
	ExtensionUISetWidgetRequest,
} from "@/lib/rpc";
import { useExtensionUI } from "./extension-ui";

beforeEach(() => {
	useExtensionUI.setState({
		currentDialog: null,
		notifications: [],
		statuses: {},
		widgets: {},
		editorTextOverride: null,
		titleOverride: null,
	});
});

describe("extension-ui store", () => {
	describe("interactive dialogs", () => {
		it("sets select request as current dialog", () => {
			const request: ExtensionUISelectRequest = {
				type: "extension_ui_request",
				id: "req-1",
				sessionId: "sess-1",
				method: "select",
				title: "Pick model",
				options: ["gpt-4", "claude"],
			};

			useExtensionUI.getState().handleRequest(request);

			const state = useExtensionUI.getState();
			expect(state.currentDialog).toEqual(request);
		});

		it("sets confirm request as current dialog", () => {
			const request: ExtensionUIConfirmRequest = {
				type: "extension_ui_request",
				id: "req-2",
				sessionId: "sess-1",
				method: "confirm",
				title: "Delete file?",
				message: "This cannot be undone.",
			};

			useExtensionUI.getState().handleRequest(request);

			const state = useExtensionUI.getState();
			expect(state.currentDialog).toEqual(request);
		});

		it("sets input request as current dialog", () => {
			const request: ExtensionUIInputRequest = {
				type: "extension_ui_request",
				id: "req-3",
				sessionId: "sess-1",
				method: "input",
				title: "Enter name",
				placeholder: "e.g. my-project",
			};

			useExtensionUI.getState().handleRequest(request);

			expect(useExtensionUI.getState().currentDialog).toEqual(request);
		});

		it("sets editor request as current dialog", () => {
			const request: ExtensionUIEditorRequest = {
				type: "extension_ui_request",
				id: "req-4",
				sessionId: "sess-1",
				method: "editor",
				title: "Edit config",
				prefill: '{ "key": "value" }',
			};

			useExtensionUI.getState().handleRequest(request);

			expect(useExtensionUI.getState().currentDialog).toEqual(request);
		});
	});

	describe("respondDialog", () => {
		it("clears current dialog on respond", () => {
			const request: ExtensionUISelectRequest = {
				type: "extension_ui_request",
				id: "req-5",
				sessionId: "sess-1",
				method: "select",
				title: "Pick",
				options: ["a", "b"],
			};

			useExtensionUI.getState().handleRequest(request);
			expect(useExtensionUI.getState().currentDialog).not.toBeNull();

			useExtensionUI.getState().respondDialog({ value: "a" });

			expect(useExtensionUI.getState().currentDialog).toBeNull();
		});

		it("does nothing when no dialog is open", () => {
			// Should not throw
			useExtensionUI.getState().respondDialog({ value: "x" });
			expect(useExtensionUI.getState().currentDialog).toBeNull();
		});
	});

	describe("notifications", () => {
		it("adds notification to queue", () => {
			const request: ExtensionUINotifyRequest = {
				type: "extension_ui_request",
				id: "notify-1",
				sessionId: "sess-1",
				method: "notify",
				message: "Build complete",
				notifyType: "info",
			};

			useExtensionUI.getState().handleRequest(request);

			const { notifications } = useExtensionUI.getState();
			expect(notifications).toHaveLength(1);
			expect(notifications[0].message).toBe("Build complete");
			expect(notifications[0].notifyType).toBe("info");
		});

		it("dismisses notification by id", () => {
			const request: ExtensionUINotifyRequest = {
				type: "extension_ui_request",
				id: "notify-2",
				sessionId: "sess-1",
				method: "notify",
				message: "Error occurred",
				notifyType: "error",
			};

			useExtensionUI.getState().handleRequest(request);
			expect(useExtensionUI.getState().notifications).toHaveLength(1);

			useExtensionUI.getState().dismissNotification("notify-2");
			expect(useExtensionUI.getState().notifications).toHaveLength(0);
		});
	});

	describe("setStatus", () => {
		it("sets status by key", () => {
			const request: ExtensionUISetStatusRequest = {
				type: "extension_ui_request",
				id: "status-1",
				sessionId: "sess-1",
				method: "setStatus",
				statusKey: "git",
				statusText: "main branch",
			};

			useExtensionUI.getState().handleRequest(request);

			const { statuses } = useExtensionUI.getState();
			expect(statuses.git).toEqual({ sessionId: "sess-1", text: "main branch" });
		});

		it("clears status when text is undefined", () => {
			// Set first
			useExtensionUI.getState().handleRequest({
				type: "extension_ui_request",
				id: "s1",
				sessionId: "sess-1",
				method: "setStatus",
				statusKey: "git",
				statusText: "working",
			});
			expect(useExtensionUI.getState().statuses.git).toBeDefined();

			// Clear
			useExtensionUI.getState().handleRequest({
				type: "extension_ui_request",
				id: "s2",
				sessionId: "sess-1",
				method: "setStatus",
				statusKey: "git",
				statusText: undefined,
			});
			expect(useExtensionUI.getState().statuses.git).toBeUndefined();
		});
	});

	describe("setWidget", () => {
		it("adds widget with lines", () => {
			const request: ExtensionUISetWidgetRequest = {
				type: "extension_ui_request",
				id: "w1",
				sessionId: "sess-1",
				method: "setWidget",
				widgetKey: "coverage",
				widgetLines: ["80% coverage", "12 tests passed"],
				widgetPlacement: "aboveEditor",
			};

			useExtensionUI.getState().handleRequest(request);

			const { widgets } = useExtensionUI.getState();
			expect(widgets.coverage).toBeDefined();
			expect(widgets.coverage.lines).toEqual(["80% coverage", "12 tests passed"]);
			expect(widgets.coverage.placement).toBe("aboveEditor");
		});

		it("removes widget when lines is undefined", () => {
			useExtensionUI.getState().handleRequest({
				type: "extension_ui_request",
				id: "w1",
				sessionId: "sess-1",
				method: "setWidget",
				widgetKey: "coverage",
				widgetLines: ["line 1"],
			});
			expect(useExtensionUI.getState().widgets.coverage).toBeDefined();

			useExtensionUI.getState().handleRequest({
				type: "extension_ui_request",
				id: "w2",
				sessionId: "sess-1",
				method: "setWidget",
				widgetKey: "coverage",
				widgetLines: undefined,
			});
			expect(useExtensionUI.getState().widgets.coverage).toBeUndefined();
		});
	});

	describe("setTitle", () => {
		it("sets title override", () => {
			const request: ExtensionUISetTitleRequest = {
				type: "extension_ui_request",
				id: "t1",
				sessionId: "sess-1",
				method: "setTitle",
				title: "My Custom Title",
			};

			useExtensionUI.getState().handleRequest(request);

			expect(useExtensionUI.getState().titleOverride).toBe("My Custom Title");
		});
	});

	describe("setEditorText", () => {
		it("sets editor text override", () => {
			const request: ExtensionUISetEditorTextRequest = {
				type: "extension_ui_request",
				id: "e1",
				sessionId: "sess-1",
				method: "set_editor_text",
				text: "prefilled content",
			};

			useExtensionUI.getState().handleRequest(request);

			expect(useExtensionUI.getState().editorTextOverride).toBe("prefilled content");
		});
	});

	describe("clearAll", () => {
		it("resets all state", () => {
			// Populate everything
			useExtensionUI.getState().handleRequest({
				type: "extension_ui_request",
				id: "d1",
				sessionId: "sess-1",
				method: "select",
				title: "Pick",
				options: ["a"],
			});
			useExtensionUI.getState().handleRequest({
				type: "extension_ui_request",
				id: "n1",
				sessionId: "sess-1",
				method: "notify",
				message: "hi",
			});
			useExtensionUI.getState().handleRequest({
				type: "extension_ui_request",
				id: "s1",
				sessionId: "sess-1",
				method: "setStatus",
				statusKey: "git",
				statusText: "ok",
			});
			useExtensionUI.getState().handleRequest({
				type: "extension_ui_request",
				id: "t1",
				sessionId: "sess-1",
				method: "setTitle",
				title: "Title",
			});

			useExtensionUI.getState().clearAll();

			const state = useExtensionUI.getState();
			expect(state.currentDialog).toBeNull();
			expect(state.notifications).toHaveLength(0);
			expect(state.statuses).toEqual({});
			expect(state.widgets).toEqual({});
			expect(state.editorTextOverride).toBeNull();
			expect(state.titleOverride).toBeNull();
		});
	});
});
