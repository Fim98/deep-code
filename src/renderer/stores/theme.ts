import { create } from "zustand";

export type ThemeChoice = "system" | "light" | "dark";
export type AppliedTheme = "light" | "dark";

interface Store {
	choice: ThemeChoice;
	applied: AppliedTheme;
	setChoice: (c: ThemeChoice) => void;
}

const STORAGE_KEY = "pi.theme";

function readChoice(): ThemeChoice {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === "light" || raw === "dark" || raw === "system") return raw;
	} catch {}
	return "system";
}

function resolveSystem(): AppliedTheme {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function resolve(choice: ThemeChoice): AppliedTheme {
	return choice === "system" ? resolveSystem() : choice;
}

export const useTheme = create<Store>((set, get) => ({
	choice: readChoice(),
	applied: resolve(readChoice()),
	setChoice: (c) => {
		try {
			localStorage.setItem(STORAGE_KEY, c);
		} catch {}
		const applied = resolve(c);
		set({ choice: c, applied });
		apply(applied);
		void window.pi?.theme?.setSource?.(c);
	},
}));

function apply(applied: AppliedTheme) {
	const root = document.documentElement;
	root.classList.toggle("dark", applied === "dark");
	root.dataset.theme = applied;
}

/** Call once at app boot. Subscribes to system-theme changes when in "system" mode. */
export function installThemeWatcher() {
	const initial = useTheme.getState();
	apply(initial.applied);
	void window.pi?.theme?.setSource?.(initial.choice);

	const mq = window.matchMedia("(prefers-color-scheme: dark)");
	const onSystem = () => {
		const { choice } = useTheme.getState();
		if (choice !== "system") return;
		const applied = resolveSystem();
		useTheme.setState({ applied });
		apply(applied);
	};
	mq.addEventListener("change", onSystem);
}
