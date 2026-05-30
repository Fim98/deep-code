import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
	/** Direction of resize: dragging left shrinks the panel on the right */
	direction?: "horizontal";
	/** Minimum width in pixels */
	minWidth?: number;
	/** Maximum width in pixels */
	maxWidth?: number;
	/** Called with new width during drag */
	onResize: (width: number) => void;
	className?: string;
}

export function ResizeHandle({
	minWidth = 280,
	maxWidth = 900,
	onResize,
	className,
}: ResizeHandleProps) {
	const dragging = useRef(false);
	const startX = useRef(0);
	const startWidth = useRef(0);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			dragging.current = true;
			startX.current = e.clientX;
			startWidth.current = 0; // Will be set by first mousemove using parent width

			// Find the resizable sibling (next sibling element)
			const handle = e.currentTarget as HTMLElement;
			const sibling = handle.nextElementSibling as HTMLElement | null;
			if (sibling) {
				startWidth.current = sibling.getBoundingClientRect().width;
			}

			// Disable text selection and pointer events during drag
			document.body.style.userSelect = "none";
			document.body.style.cursor = "col-resize";

			const onMouseMove = (ev: MouseEvent) => {
				if (!dragging.current) return;
				const delta = startX.current - ev.clientX; // Drag left = grow
				const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth.current + delta));
				onResize(newWidth);
			};

			const onMouseUp = () => {
				dragging.current = false;
				document.body.style.userSelect = "";
				document.body.style.cursor = "";
				document.removeEventListener("mousemove", onMouseMove);
				document.removeEventListener("mouseup", onMouseUp);
			};

			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);
		},
		[minWidth, maxWidth, onResize],
	);

	return (
		<div
			onMouseDown={handleMouseDown}
			className={cn(
				"group relative z-10 flex w-1.5 shrink-0 cursor-col-resize items-center justify-center",
				"hover:bg-primary/10 active:bg-primary/15",
				"transition-colors duration-100",
				className,
			)}
		>
			<div className="h-8 w-0.5 rounded-full bg-border/60 opacity-0 transition-opacity group-hover:opacity-100" />
		</div>
	);
}
