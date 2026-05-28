import { create } from "zustand";
import {
	type ExtensionUIConfirmRequest,
	type ExtensionUIEditorRequest,
	type ExtensionUIInputRequest,
	type ExtensionUIRequest,
	type ExtensionUISelectRequest,
	type ExtensionUISetEditorTextRequest,
	type ExtensionUISetStatusRequest,
	type ExtensionUISetTitleRequest,
	type ExtensionUISetWidgetRequest,
	pi,
} from "@/lib/rpc";

// ─── Types ──────────────────────────────────────────────────────────────────

export type InteractiveRequest =
	| ExtensionUISelectRequest
	| ExtensionUIConfirmRequest
	| ExtensionUIInputRequest
	| ExtensionUIEditorRequest;

export interface NotifyItem {
	id: string;
	sessionId: string;
	message: string;
	notifyType?: "info" | "warning" | "error";
	createdAt: number;
}

interface ExtensionUIState {
	/** Current modal dialog (only one at a time) */
	currentDialog: InteractiveRequest | null;
	/** Notification queue */
	notifications: NotifyItem[];
	/** Extension statuses keyed by statusKey */
	statuses: Record<string, { sessionId: string; text: string }>;
	/** Extension widgets keyed by widgetKey */
	widgets: Record<
		string,
		{ sessionId: string; lines: string[]; placement: "aboveEditor" | "belowEditor" }
	>;
	/** Extension-set editor text override */
	editorTextOverride: string | null;
	/** Extension-set title override */
	titleOverride: string | null;
}

interface ExtensionUIActions {
	handleRequest: (request: ExtensionUIRequest) => void;
	respondDialog: (response: { value?: string; confirmed?: boolean; cancelled?: boolean }) => void;
	dismissNotification: (id: string) => void;
	clearAll: () => void;
}

type Store = ExtensionUIState & ExtensionUIActions;

// ─── Store ──────────────────────────────────────────────────────────────────

export const useExtensionUI = create<Store>((set, get) => ({
	currentDialog: null,
	notifications: [],
	statuses: {},
	widgets: {},
	editorTextOverride: null,
	titleOverride: null,

	handleRequest(request: ExtensionUIRequest) {
		switch (request.method) {
			case "select":
			case "confirm":
			case "input":
			case "editor": {
				// Queue the dialog — if there's already one, replace it
				// (extensions shouldn't stack dialogs, but be safe)
				set({ currentDialog: request });
				break;
			}

			case "notify": {
				const item: NotifyItem = {
					id: request.id,
					sessionId: request.sessionId,
					message: request.message,
					notifyType: request.notifyType,
					createdAt: Date.now(),
				};
				set((s) => ({
					notifications: [...s.notifications, item],
				}));
				break;
			}

			case "setStatus": {
				const req = request as ExtensionUISetStatusRequest;
				set((s) => {
					const next = { ...s.statuses };
					if (req.statusText === undefined) {
						delete next[req.statusKey];
					} else {
						next[req.statusKey] = { sessionId: req.sessionId, text: req.statusText };
					}
					return { statuses: next };
				});
				break;
			}

			case "setWidget": {
				const req = request as ExtensionUISetWidgetRequest;
				set((s) => {
					const next = { ...s.widgets };
					if (req.widgetLines === undefined) {
						delete next[req.widgetKey];
					} else {
						next[req.widgetKey] = {
							sessionId: req.sessionId,
							lines: req.widgetLines,
							placement: req.widgetPlacement ?? "aboveEditor",
						};
					}
					return { widgets: next };
				});
				break;
			}

			case "setTitle": {
				const req = request as ExtensionUISetTitleRequest;
				set({ titleOverride: req.title });
				break;
			}

			case "set_editor_text": {
				const req = request as ExtensionUISetEditorTextRequest;
				set({ editorTextOverride: req.text });
				break;
			}
		}
	},

	respondDialog(response) {
		const dialog = get().currentDialog;
		if (!dialog) return;

		const resp: Record<string, unknown> = {
			type: "extension_ui_response",
			id: dialog.id,
		};

		if (response.cancelled) {
			resp.cancelled = true;
		} else if (response.confirmed !== undefined) {
			resp.confirmed = response.confirmed;
		} else if (response.value !== undefined) {
			resp.value = response.value;
		} else {
			resp.cancelled = true;
		}

		void pi.extensionUI.respond(dialog.sessionId, resp);
		set({ currentDialog: null });
	},

	dismissNotification(id: string) {
		set((s) => ({
			notifications: s.notifications.filter((n) => n.id !== id),
		}));
	},

	clearAll() {
		set({
			currentDialog: null,
			notifications: [],
			statuses: {},
			widgets: {},
			editorTextOverride: null,
			titleOverride: null,
		});
	},
}));

// ─── Watcher ────────────────────────────────────────────────────────────────

let installed = false;

/** Call once at app boot. Subscribes to extension UI requests from main process. */
export function installExtensionUIWatcher() {
	if (installed) return;
	installed = true;

	pi.extensionUI.onRequest((request) => {
		useExtensionUI.getState().handleRequest(request);
	});
}
