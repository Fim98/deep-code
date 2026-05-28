import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type KeyChord, useKeyboardShortcuts } from "./keyboard";

describe("useKeyboardShortcuts", () => {
	function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key,
				bubbles: true,
				...opts,
			}),
		);
	}

	it("fires handler on matching key chord", () => {
		const handler = vi.fn();
		const chords: KeyChord[] = [{ key: "k", meta: true, handler }];

		renderHook(() => useKeyboardShortcuts(chords));
		fireKey("k", { metaKey: true });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("does not fire when modifier doesn't match", () => {
		const handler = vi.fn();
		const chords: KeyChord[] = [{ key: "k", meta: true, handler }];

		renderHook(() => useKeyboardShortcuts(chords));
		fireKey("k"); // no meta

		expect(handler).not.toHaveBeenCalled();
	});

	it("does not fire when key doesn't match", () => {
		const handler = vi.fn();
		const chords: KeyChord[] = [{ key: "k", meta: true, handler }];

		renderHook(() => useKeyboardShortcuts(chords));
		fireKey("j", { metaKey: true });

		expect(handler).not.toHaveBeenCalled();
	});

	it("handles shift modifier", () => {
		const handler = vi.fn();
		const chords: KeyChord[] = [{ key: "n", meta: true, shift: true, handler }];

		renderHook(() => useKeyboardShortcuts(chords));
		fireKey("n", { metaKey: true, shiftKey: true });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("skips shortcuts when typing in input fields (without meta)", () => {
		const handler = vi.fn();
		const chords: KeyChord[] = [{ key: "k", handler }];

		renderHook(() => useKeyboardShortcuts(chords));

		// Create an input element and simulate typing in it
		const input = document.createElement("input");
		document.body.appendChild(input);
		input.focus();

		input.dispatchEvent(new KeyboardEvent("keydown", { key: "k", bubbles: true }));

		expect(handler).not.toHaveBeenCalled();
		document.body.removeChild(input);
	});

	it("still fires meta shortcuts when in input fields", () => {
		const handler = vi.fn();
		const chords: KeyChord[] = [{ key: "k", meta: true, handler }];

		renderHook(() => useKeyboardShortcuts(chords));

		const input = document.createElement("input");
		document.body.appendChild(input);
		input.focus();

		input.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));

		expect(handler).toHaveBeenCalledTimes(1);
		document.body.removeChild(input);
	});

	it("cleans up event listener on unmount", () => {
		const handler = vi.fn();
		const chords: KeyChord[] = [{ key: "k", meta: true, handler }];

		const { unmount } = renderHook(() => useKeyboardShortcuts(chords));
		unmount();

		fireKey("k", { metaKey: true });
		expect(handler).not.toHaveBeenCalled();
	});

	it("handles multiple chords, fires first match", () => {
		const handler1 = vi.fn();
		const handler2 = vi.fn();
		const chords: KeyChord[] = [
			{ key: "k", meta: true, handler: handler1 },
			{ key: "n", meta: true, handler: handler2 },
		];

		renderHook(() => useKeyboardShortcuts(chords));
		fireKey("k", { metaKey: true });

		expect(handler1).toHaveBeenCalledTimes(1);
		expect(handler2).not.toHaveBeenCalled();
	});
});
