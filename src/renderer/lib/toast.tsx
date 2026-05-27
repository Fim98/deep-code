import { Toast, toast } from "@heroui/react";

export function emitToast(message: string, kind: "error" | "info" = "error") {
	if (kind === "error") {
		toast.danger(message);
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
		emitToast(
			typeof r === "string" ? r : r?.message ? String(r.message) : String(r),
		);
	});
}

export function ToastHost() {
	return <Toast.Provider placement="bottom" />;
}
