import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect } from "react";
import { emitToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { type InteractiveRequest, useExtensionUI } from "@/stores/extension-ui";
import { useSessions } from "@/stores/session-state";
import { ConfirmDialog } from "./ConfirmDialog";
import { EditorDialog } from "./EditorDialog";
import { InputDialog } from "./InputDialog";
import { SelectDialog } from "./SelectDialog";

/**
 * Top-level component that renders Extension UI dialogs, notifications,
 * and widgets. Must be mounted once in App.tsx.
 */
export function ExtensionUIHost() {
	const currentDialog = useExtensionUI((s) => s.currentDialog);
	const notifications = useExtensionUI((s) => s.notifications);
	const widgets = useExtensionUI((s) => s.widgets);
	const statuses = useExtensionUI((s) => s.statuses);
	const titleOverride = useExtensionUI((s) => s.titleOverride);
	const respondDialog = useExtensionUI((s) => s.respondDialog);
	const dismissNotification = useExtensionUI((s) => s.dismissNotification);
	const currentSessionId = useSessions((s) => s.currentSessionId);

	// Apply title override to document title
	useEffect(() => {
		if (titleOverride) {
			document.title = titleOverride;
		}
	}, [titleOverride]);

	const _handleSelect = useCallback(
		(value: string) => {
			respondDialog({ value });
		},
		[respondDialog],
	);

	const _handleConfirm = useCallback(() => {
		respondDialog({ confirmed: true });
	}, [respondDialog]);

	const _handleCancel = useCallback(() => {
		respondDialog({ cancelled: true });
	}, [respondDialog]);

	const _handleInputSubmit = useCallback(
		(value: string) => {
			respondDialog({ value });
		},
		[respondDialog],
	);

	const _handleEditorSubmit = useCallback(
		(value: string) => {
			respondDialog({ value });
		},
		[respondDialog],
	);

	// Auto-dismiss notifications after 5 seconds
	useEffect(() => {
		if (notifications.length === 0) return;
		const timers = notifications.map((n) =>
			setTimeout(() => {
				dismissNotification(n.id);
			}, 5000),
		);
		return () => timers.forEach(clearTimeout);
	}, [notifications, dismissNotification]);

	// Emit notify events as toasts as well
	useEffect(() => {
		for (const n of notifications) {
			// Only emit toast once per notification (use a marker)
			if (!(n as any)._toasted) {
				// Map extension notify types to toast kinds
				const kind = n.notifyType === "error" ? "error" : "info";
				emitToast(n.message, kind);
				(n as any)._toasted = true;
			}
		}
	}, [notifications]);

	return (
		<>
			{/* Modal dialog — only one at a time */}
			{currentDialog && <DialogRenderer dialog={currentDialog} />}

			{/* Widget overlays (above/below editor area) */}
			<WidgetOverlay currentSessionId={currentSessionId} widgets={widgets} />

			{/* Status bar from extensions */}
			<StatusBar currentSessionId={currentSessionId} statuses={statuses} />
		</>
	);
}

// ─── Dialog Router ──────────────────────────────────────────────────────────

function DialogRenderer({ dialog }: { dialog: InteractiveRequest }) {
	const respondDialog = useExtensionUI((s) => s.respondDialog);

	const handleSelect = useCallback((value: string) => respondDialog({ value }), [respondDialog]);
	const handleConfirm = useCallback(() => respondDialog({ confirmed: true }), [respondDialog]);
	const handleCancel = useCallback(() => respondDialog({ cancelled: true }), [respondDialog]);
	const handleInputSubmit = useCallback(
		(value: string) => respondDialog({ value }),
		[respondDialog],
	);
	const handleEditorSubmit = useCallback(
		(value: string) => respondDialog({ value }),
		[respondDialog],
	);

	switch (dialog.method) {
		case "select":
			return <SelectDialog request={dialog} onSelect={handleSelect} onCancel={handleCancel} />;
		case "confirm":
			return <ConfirmDialog request={dialog} onConfirm={handleConfirm} onCancel={handleCancel} />;
		case "input":
			return <InputDialog request={dialog} onSubmit={handleInputSubmit} onCancel={handleCancel} />;
		case "editor":
			return (
				<EditorDialog request={dialog} onSubmit={handleEditorSubmit} onCancel={handleCancel} />
			);
	}
}

// ─── Widget Overlay ─────────────────────────────────────────────────────────

function WidgetOverlay({
	currentSessionId,
	widgets,
}: {
	currentSessionId: string | null;
	widgets: Record<string, { sessionId: string; lines: string[]; placement: string }>;
}) {
	const entries = currentSessionId
		? Object.entries(widgets).filter(([, widget]) => widget.sessionId === currentSessionId)
		: [];
	if (entries.length === 0) return null;

	return (
		<AnimatePresence>
			{entries.map(([key, widget]) => (
				<motion.div
					key={key}
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -8 }}
					transition={{ duration: 0.2 }}
					className={cn(
						"mx-auto w-full max-w-3xl px-4",
						widget.placement === "belowEditor" ? "mt-2" : "mb-2",
					)}
				>
					<div className="rounded-[12px] border border-border/40 bg-card/80 px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-xl">
						<pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
							{widget.lines.join("\n")}
						</pre>
					</div>
				</motion.div>
			))}
		</AnimatePresence>
	);
}

// ─── Status Bar ─────────────────────────────────────────────────────────────

function StatusBar({
	currentSessionId,
	statuses,
}: {
	currentSessionId: string | null;
	statuses: Record<string, { sessionId: string; text: string }>;
}) {
	const entries = currentSessionId
		? Object.entries(statuses).filter(([, status]) => status.sessionId === currentSessionId)
		: [];
	if (entries.length === 0) return null;

	return (
		<div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-1">
			{entries.map(([key, status]) => (
				<span
					key={key}
					className="rounded-full bg-card/90 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm"
				>
					{status.text}
				</span>
			))}
		</div>
	);
}
