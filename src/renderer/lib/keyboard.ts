import { useEffect } from "react";

export interface KeyChord {
	key: string;
	meta?: boolean;
	shift?: boolean;
	handler: (e: KeyboardEvent) => void;
}

export function useKeyboardShortcuts(chords: KeyChord[]) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName?.toLowerCase();
			const editable = tag === "input" || tag === "textarea" || target?.isContentEditable;
			for (const c of chords) {
				if (e.key.toLowerCase() !== c.key.toLowerCase()) continue;
				if (!!c.meta !== (e.metaKey || e.ctrlKey)) continue;
				if (!!c.shift !== e.shiftKey) continue;
				if (editable && !c.meta) continue;
				e.preventDefault();
				c.handler(e);
				return;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [chords]);
}
