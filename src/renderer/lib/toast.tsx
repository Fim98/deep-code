import { Toaster, toast } from "sonner";

export interface ToastOptions {
	action?: { label: string; onClick: () => void };
}

export function emitToast(message: string, kind: "error" | "info" | ToastOptions = "error") {
	if (typeof kind === "object") {
		toast.info(message, kind.action ? { action: kind.action } : undefined);
		return;
	}
	if (kind === "error") {
		toast.error(message);
		return;
	}
	toast.info(message);
}

/** Install a global window.onerror + unhandledrejection handler that emits toasts. */
export function installGlobalErrorToasts() {
	window.addEventListener("error", (e) => {
		emitToast(e.message || String(e.error));
	});
	window.addEventListener("unhandledrejection", (e) => {
		const r = e.reason;
		emitToast(typeof r === "string" ? r : r?.message ? String(r.message) : String(r));
	});
}

export function ToastHost() {
	return (
		<Toaster
			position="bottom-right"
			toastOptions={{
				className: "rounded-[18px] border border-border bg-card text-card-foreground shadow-md",
				style: {
					fontSize: "13px",
				},
			}}
		/>
	);
}
