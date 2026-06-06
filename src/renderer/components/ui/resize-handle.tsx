import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface CommonProps {
	/** Called with new size in pixels during drag */
	onResize: (size: number) => void;
	className?: string;
	/** Fired once when the user starts dragging */
	onResizeStart?: () => void;
	/** Fired once when the user releases the mouse */
	onResizeEnd?: () => void;
}

type HorizontalProps = CommonProps & {
	direction: "horizontal";
	/** Minimum width in pixels */
	minSize?: number;
	/** Maximum width in pixels */
	maxSize?: number;
};

type VerticalProps = CommonProps & {
	direction: "vertical";
	/** Minimum height in pixels */
	minSize?: number;
	/** Maximum height in pixels */
	maxSize?: number;
	/**
	 * If the user drags below this many pixels, the panel auto-collapses.
	 * The handler receives a boolean indicating whether the panel should be closed.
	 */
	collapseThreshold?: number;
	onCollapse?: () => void;
};

export type ResizeHandleProps = HorizontalProps | VerticalProps;

const DEFAULT_MIN = 100;
const DEFAULT_MAX = 1000;

export function ResizeHandle(props: ResizeHandleProps) {
	const { onResize, className } = props;
	const dragging = useRef(false);
	const startPos = useRef(0);
	const startSize = useRef(0);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			dragging.current = true;
			startPos.current = props.direction === "horizontal" ? e.clientX : e.clientY;
			startSize.current = 0;

			const handle = e.currentTarget as HTMLElement;
			if (props.direction === "horizontal") {
				const sibling = handle.nextElementSibling as HTMLElement | null;
				if (sibling) startSize.current = sibling.getBoundingClientRect().width;
			} else {
				// For vertical: the sibling BELOW is the resizable region.
				const sibling = handle.nextElementSibling as HTMLElement | null;
				if (sibling) startSize.current = sibling.getBoundingClientRect().height;
			}

			const minSize = props.minSize ?? DEFAULT_MIN;
			const maxSize = props.maxSize ?? DEFAULT_MAX;

			document.body.style.userSelect = "none";
			document.body.style.cursor = props.direction === "horizontal" ? "col-resize" : "row-resize";
			props.onResizeStart?.();

			const onMouseMove = (ev: MouseEvent) => {
				if (!dragging.current) return;
				if (props.direction === "horizontal") {
					const delta = startPos.current - ev.clientX; // Drag left = grow
					const next = Math.max(minSize, Math.min(maxSize, startSize.current + delta));
					onResize(next);
				} else {
					const delta = startPos.current - ev.clientY; // Drag up = grow
					const next = Math.max(0, Math.min(maxSize, startSize.current + delta));
					onResize(next);
					if (props.collapseThreshold !== undefined && next < props.collapseThreshold) {
						props.onCollapse?.();
					}
				}
			};

			const onMouseUp = () => {
				dragging.current = false;
				document.body.style.userSelect = "";
				document.body.style.cursor = "";
				document.removeEventListener("mousemove", onMouseMove);
				document.removeEventListener("mouseup", onMouseUp);
				props.onResizeEnd?.();
			};

			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);
		},
		[onResize, props],
	);

	const isHorizontal = props.direction === "horizontal";

	return (
		<div
			onMouseDown={handleMouseDown}
			className={cn(
				"group relative z-10 flex shrink-0 items-center justify-center",
				isHorizontal
					? "w-1.5 cursor-col-resize hover:bg-primary/10 active:bg-primary/15"
					: "h-1.5 cursor-row-resize hover:bg-primary/10 active:bg-primary/15",
				"transition-colors duration-100",
				className,
			)}
		>
			<div
				className={cn(
					"rounded-full bg-border/60 opacity-0 transition-opacity group-hover:opacity-100",
					isHorizontal ? "h-8 w-0.5" : "h-0.5 w-8",
				)}
			/>
		</div>
	);
}
