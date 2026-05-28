import { randomUUID } from "node:crypto";
import type {
	ExtensionUIContext,
	ExtensionUIDialogOptions,
	ExtensionWidgetOptions,
	TerminalInputHandler,
	WorkingIndicatorOptions,
} from "@earendil-works/pi-coding-agent";
import { type BrowserWindow } from "electron";

// ─── Types shared with renderer ─────────────────────────────────────────────

export interface ExtensionUIRequestBase {
	type: "extension_ui_request";
	id: string;
}

export interface ExtensionUISelectRequest extends ExtensionUIRequestBase {
	method: "select";
	title: string;
	options: string[];
	timeout?: number;
}

export interface ExtensionUIConfirmRequest extends ExtensionUIRequestBase {
	method: "confirm";
	title: string;
	message: string;
	timeout?: number;
}

export interface ExtensionUIInputRequest extends ExtensionUIRequestBase {
	method: "input";
	title: string;
	placeholder?: string;
	timeout?: number;
}

export interface ExtensionUIEditorRequest extends ExtensionUIRequestBase {
	method: "editor";
	title: string;
	prefill?: string;
}

export interface ExtensionUINotifyRequest extends ExtensionUIRequestBase {
	method: "notify";
	message: string;
	notifyType?: "info" | "warning" | "error";
}

export interface ExtensionUISetStatusRequest extends ExtensionUIRequestBase {
	method: "setStatus";
	statusKey: string;
	statusText: string | undefined;
}

export interface ExtensionUISetWidgetRequest extends ExtensionUIRequestBase {
	method: "setWidget";
	widgetKey: string;
	widgetLines: string[] | undefined;
	widgetPlacement?: "aboveEditor" | "belowEditor";
}

export interface ExtensionUISetTitleRequest extends ExtensionUIRequestBase {
	method: "setTitle";
	title: string;
}

export interface ExtensionUISetEditorTextRequest extends ExtensionUIRequestBase {
	method: "set_editor_text";
	text: string;
}

export type ExtensionUIRequest =
	| ExtensionUISelectRequest
	| ExtensionUIConfirmRequest
	| ExtensionUIInputRequest
	| ExtensionUIEditorRequest
	| ExtensionUINotifyRequest
	| ExtensionUISetStatusRequest
	| ExtensionUISetWidgetRequest
	| ExtensionUISetTitleRequest
	| ExtensionUISetEditorTextRequest;

// ─── Response types ─────────────────────────────────────────────────────────

export interface ExtensionUIResponseValue {
	type: "extension_ui_response";
	id: string;
	value: string;
}

export interface ExtensionUIResponseConfirmed {
	type: "extension_ui_response";
	id: string;
	confirmed: boolean;
}

export interface ExtensionUIResponseCancelled {
	type: "extension_ui_response";
	id: string;
	cancelled: true;
}

export type ExtensionUIResponse =
	| ExtensionUIResponseValue
	| ExtensionUIResponseConfirmed
	| ExtensionUIResponseCancelled;

// ─── Pending request tracker ────────────────────────────────────────────────

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer?: ReturnType<typeof setTimeout>;
}

// ─── Bridge implementation ───────────────────────────────────────────────────

/**
 * Creates an ExtensionUIContext that bridges pi extensions to the Electron renderer
 * via IPC. Interactive methods (select/confirm/input/editor) create pending promises
 * and emit requests to the renderer. Fire-and-forget methods (notify/setStatus/etc.)
 * just emit events.
 */
export class ExtensionUIBridge {
	private pending = new Map<string, PendingRequest>();
	private sender: ((request: ExtensionUIRequest & { sessionId: string }) => void) | null = null;
	private sessionId = "";

	/**
	 * Bind the bridge to a BrowserWindow + sessionId so it can send IPC messages
	 * to the renderer with the session context.
	 */
	bindWindow(win: BrowserWindow, sessionId: string): void {
		this.sessionId = sessionId;
		this.sender = (request: ExtensionUIRequest & { sessionId: string }) => {
			if (!win.isDestroyed()) {
				win.webContents.send("pi:extension-ui:request", request);
			}
		};
	}

	/**
	 * Handle a response from the renderer.
	 */
	handleResponse(response: ExtensionUIResponse): void {
		const pending = this.pending.get(response.id);
		if (!pending) return;

		this.pending.delete(response.id);
		if (pending.timer) clearTimeout(pending.timer);

		if ("cancelled" in response && response.cancelled) {
			pending.resolve(undefined);
		} else if ("value" in response) {
			pending.resolve(response.value);
		} else if ("confirmed" in response) {
			pending.resolve(response.confirmed);
		} else {
			pending.resolve(undefined);
		}
	}

	/**
	 * Clean up all pending requests.
	 */
	dispose(): void {
		for (const [_id, pending] of this.pending) {
			if (pending.timer) clearTimeout(pending.timer);
			pending.resolve(undefined);
		}
		this.pending.clear();
		this.sender = null;
	}

	private emit(request: ExtensionUIRequest): void {
		this.sender?.({ ...request, sessionId: this.sessionId });
	}

	/**
	 * Create a promise-based dialog request. Sends the request to the renderer
	 * and returns a promise that resolves when the user responds.
	 */
	private createDialog<T>(
		request: Record<string, unknown> & { method: string },
		defaultValue: T,
		opts?: ExtensionUIDialogOptions,
		parseResponse?: (value: unknown) => T,
	): Promise<T> {
		if (opts?.signal?.aborted) return Promise.resolve(defaultValue);

		const id = randomUUID();
		return new Promise<T>((resolve, reject) => {
			let timer: ReturnType<typeof setTimeout> | undefined;

			const cleanup = () => {
				if (timer) clearTimeout(timer);
				opts?.signal?.removeEventListener("abort", onAbort);
				this.pending.delete(id);
			};

			const onAbort = () => {
				cleanup();
				resolve(defaultValue);
			};
			opts?.signal?.addEventListener("abort", onAbort, { once: true });

			if (opts?.timeout) {
				timer = setTimeout(() => {
					cleanup();
					resolve(defaultValue);
				}, opts.timeout);
			}

			this.pending.set(id, {
				resolve: (value: unknown) => {
					cleanup();
					resolve(parseResponse ? parseResponse(value) : (value as T));
				},
				reject,
				timer,
			});

			this.emit({ ...request, id, type: "extension_ui_request" } as ExtensionUIRequest);
		});
	}

	/**
	 * Create an ExtensionUIContext backed by this bridge.
	 */
	createUIContext(): ExtensionUIContext {
		const self = this;

		return {
			select(title: string, options: string[], opts?: ExtensionUIDialogOptions) {
				return self.createDialog<string | undefined>(
					{ method: "select", title, options, timeout: opts?.timeout },
					undefined,
					opts,
				);
			},

			confirm(title: string, message: string, opts?: ExtensionUIDialogOptions) {
				return self.createDialog<boolean>(
					{ method: "confirm", title, message, timeout: opts?.timeout },
					false,
					opts,
				);
			},

			input(title: string, placeholder?: string, opts?: ExtensionUIDialogOptions) {
				return self.createDialog<string | undefined>(
					{ method: "input", title, placeholder, timeout: opts?.timeout },
					undefined,
					opts,
				);
			},

			notify(message: string, type?: "info" | "warning" | "error"): void {
				self.emit({
					type: "extension_ui_request",
					id: randomUUID(),
					method: "notify",
					message,
					notifyType: type,
				});
			},

			onTerminalInput(_handler: TerminalInputHandler): () => void {
				// Terminal input not supported in desktop mode
				return () => {};
			},

			setStatus(key: string, text: string | undefined): void {
				self.emit({
					type: "extension_ui_request",
					id: randomUUID(),
					method: "setStatus",
					statusKey: key,
					statusText: text,
				});
			},

			setWorkingMessage(_message?: string): void {
				// Working message not supported in desktop mode
			},

			setWorkingVisible(_visible: boolean): void {
				// Working visibility not supported in desktop mode
			},

			setWorkingIndicator(_options?: WorkingIndicatorOptions): void {
				// Working indicator not supported in desktop mode
			},

			setHiddenThinkingLabel(_label?: string): void {
				// Hidden thinking label not supported in desktop mode
			},

			setWidget(key: string, content: unknown, options?: ExtensionWidgetOptions): void {
				if (content === undefined || Array.isArray(content)) {
					self.emit({
						type: "extension_ui_request",
						id: randomUUID(),
						method: "setWidget",
						widgetKey: key,
						widgetLines: content as string[] | undefined,
						widgetPlacement: options?.placement,
					});
				}
				// Component factories not supported in desktop mode
			},

			setFooter(_factory: unknown): void {
				// Custom footer not supported in desktop mode
			},

			setHeader(_factory: unknown): void {
				// Custom header not supported in desktop mode
			},

			setTitle(title: string): void {
				self.emit({
					type: "extension_ui_request",
					id: randomUUID(),
					method: "setTitle",
					title,
				});
			},

			async custom() {
				return undefined as never;
			},

			pasteToEditor(text: string): void {
				this.setEditorText(text);
			},

			setEditorText(text: string): void {
				self.emit({
					type: "extension_ui_request",
					id: randomUUID(),
					method: "set_editor_text",
					text,
				});
			},

			getEditorText(): string {
				return "";
			},

			editor(title: string, prefill?: string) {
				return self.createDialog<string | undefined>(
					{ method: "editor", title, prefill },
					undefined,
				);
			},

			addAutocompleteProvider(_factory: any): void {
				// Not supported in desktop mode
			},

			setEditorComponent(_factory: any): void {
				// Not supported in desktop mode
			},

			getEditorComponent() {
				return undefined;
			},

			get theme() {
				// Return a minimal theme object
				return {} as any;
			},

			getAllThemes() {
				return [];
			},

			getTheme(_name: string) {
				return undefined;
			},

			setTheme(_theme: string | any) {
				return { success: false, error: "Theme switching not supported in desktop mode" };
			},

			getToolsExpanded() {
				return false;
			},

			setToolsExpanded(_expanded: boolean): void {
				// Not supported in desktop mode
			},
		};
	}
}
