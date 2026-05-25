import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
	id: number;
	kind: "error" | "info";
	message: string;
}

const listeners = new Set<(t: Toast) => void>();
let counter = 0;

export function emitToast(message: string, kind: Toast["kind"] = "error") {
	counter += 1;
	const toast = { id: counter, kind, message };
	for (const l of listeners) l(toast);
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
	const [items, setItems] = useState<Toast[]>([]);

	useEffect(() => {
		const handler = (t: Toast) => {
			setItems((list) => [...list, t]);
			setTimeout(() => {
				setItems((list) => list.filter((x) => x.id !== t.id));
			}, 6000);
		};
		listeners.add(handler);
		return () => {
			listeners.delete(handler);
		};
	}, []);

	if (items.length === 0) return null;
	return (
		<div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
			{items.map((t) => (
				<div
					key={t.id}
					className={cn(
						"pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border bg-popover/95 px-3.5 py-2.5 text-[12px] text-foreground shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2 fade-in-0",
						t.kind === "error" ? "border-destructive/40" : "border-border",
					)}
				>
					<AlertTriangle
						className={cn(
							"mt-px size-3.5 shrink-0",
							t.kind === "error" ? "text-destructive" : "text-muted-foreground",
						)}
					/>
					<div className="flex-1 leading-relaxed">{t.message}</div>
					<button
						type="button"
						onClick={() =>
							setItems((list) => list.filter((x) => x.id !== t.id))
						}
						className="-mr-1 mt-px text-muted-foreground hover:text-foreground"
					>
						<X className="size-3.5" />
					</button>
				</div>
			))}
		</div>
	);
}
