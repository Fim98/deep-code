/**
 * @vitest-environment jsdom
 */
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResizeHandle } from "./resize-handle";

function flushMouseMove(clientX: number, clientY: number) {
	fireEvent(
		document,
		new MouseEvent("mousemove", {
			bubbles: true,
			clientX,
			clientY,
		}),
	);
}

function flushMouseUp() {
	fireEvent(document, new MouseEvent("mouseup", { bubbles: true }));
}

/**
 * jsdom doesn't perform layout, so getBoundingClientRect() returns 0 for width/height.
 * We patch it on the resizable sibling for the duration of the test.
 */
function mockLayout(sizes: { width?: number; height?: number }) {
	const original = HTMLElement.prototype.getBoundingClientRect;
	HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
		// Only patch the sibling (the element AFTER the handle in the DOM tree)
		const rect = original.call(this) as DOMRect;
		return {
			...rect,
			width: sizes.width ?? rect.width,
			height: sizes.height ?? rect.height,
		} as DOMRect;
	};
	return () => {
		HTMLElement.prototype.getBoundingClientRect = original;
	};
}

describe("ResizeHandle", () => {
	afterEach(() => {
		// Cleanup cursor / user-select side effects
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	});

	it("supports horizontal direction with minSize/maxSize", () => {
		const restore = mockLayout({ width: 200 });
		const onResize = vi.fn();
		render(
			<div>
				<ResizeHandle direction="horizontal" minSize={100} maxSize={500} onResize={onResize} />
				<div data-testid="sibling" style={{ width: "200px" }} />
			</div>,
		);
		const handle = document.querySelector(".cursor-col-resize");
		expect(handle).toBeTruthy();

		fireEvent.mouseDown(handle as Element, { clientX: 100 });
		// Drag right by 50px (delta = -50, new width = 200 - 50 = 150)
		flushMouseMove(150, 0);
		expect(onResize).toHaveBeenLastCalledWith(150);
		flushMouseUp();
		restore();
	});

	it("supports vertical direction and reports positive height when dragging up", () => {
		const restore = mockLayout({ height: 200 });
		const onResize = vi.fn();
		render(
			<div>
				<ResizeHandle direction="vertical" minSize={100} maxSize={600} onResize={onResize} />
				<div data-testid="sibling" style={{ height: "200px" }} />
			</div>,
		);
		const handle = document.querySelector(".cursor-row-resize");
		expect(handle).toBeTruthy();

		fireEvent.mouseDown(handle as Element, { clientY: 100 });
		// Drag up by 50px (delta = 50, new height = 200 + 50 = 250)
		flushMouseMove(0, 50);
		expect(onResize).toHaveBeenLastCalledWith(250);
		flushMouseUp();
		restore();
	});

	it("clamps vertical resize to maxSize", () => {
		const restore = mockLayout({ height: 200 });
		const onResize = vi.fn();
		render(
			<div>
				<ResizeHandle direction="vertical" minSize={100} maxSize={300} onResize={onResize} />
				<div data-testid="sibling" style={{ height: "200px" }} />
			</div>,
		);
		const handle = document.querySelector(".cursor-row-resize");
		fireEvent.mouseDown(handle as Element, { clientY: 100 });
		// Drag up massively; should clamp to 300
		flushMouseMove(0, -5000);
		expect(onResize).toHaveBeenLastCalledWith(300);
		flushMouseUp();
		restore();
	});

	it("fires onCollapse when the user drags below collapseThreshold", () => {
		const restore = mockLayout({ height: 200 });
		const onResize = vi.fn();
		const onCollapse = vi.fn();
		render(
			<div>
				<ResizeHandle
					direction="vertical"
					minSize={100}
					maxSize={600}
					collapseThreshold={80}
					onResize={onResize}
					onCollapse={onCollapse}
				/>
				<div data-testid="sibling" style={{ height: "200px" }} />
			</div>,
		);
		const handle = document.querySelector(".cursor-row-resize");
		fireEvent.mouseDown(handle as Element, { clientY: 100 });
		// Drag down 150px (new height = 50 < 80 threshold)
		flushMouseMove(0, 250);
		expect(onCollapse).toHaveBeenCalled();
		flushMouseUp();
		restore();
	});

	it("fires onResizeStart and onResizeEnd exactly once per drag", () => {
		const restore = mockLayout({ height: 200 });
		const onResizeStart = vi.fn();
		const onResizeEnd = vi.fn();
		render(
			<div>
				<ResizeHandle
					direction="vertical"
					minSize={100}
					maxSize={600}
					onResize={() => {}}
					onResizeStart={onResizeStart}
					onResizeEnd={onResizeEnd}
				/>
				<div data-testid="sibling" style={{ height: "200px" }} />
			</div>,
		);
		const handle = document.querySelector(".cursor-row-resize");
		fireEvent.mouseDown(handle as Element, { clientY: 100 });
		flushMouseMove(0, 80);
		flushMouseMove(0, 60);
		flushMouseUp();
		expect(onResizeStart).toHaveBeenCalledTimes(1);
		expect(onResizeEnd).toHaveBeenCalledTimes(1);
		restore();
	});
});
