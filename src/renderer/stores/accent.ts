import { create } from "zustand";

export interface AccentPreset {
	id: string;
	label: string;
	swatch: string;
	primary: string;
	primaryHover: string;
	primarySoft: string;
	accent: string;
	accentForeground: string;
	ring: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
	{
		id: "indigo",
		label: "Indigo",
		swatch: "#5b5bf7",
		primary: "#5b5bf7",
		primaryHover: "#6b6bff",
		primarySoft: "#ececff",
		accent: "rgba(91, 91, 247, 0.08)",
		accentForeground: "#5b5bf7",
		ring: "#5b5bf7",
	},
	{
		id: "blue",
		label: "Blue",
		swatch: "#2563eb",
		primary: "#2563eb",
		primaryHover: "#3b82f6",
		primarySoft: "#eff6ff",
		accent: "rgba(37, 99, 235, 0.08)",
		accentForeground: "#2563eb",
		ring: "#2563eb",
	},
	{
		id: "emerald",
		label: "Emerald",
		swatch: "#059669",
		primary: "#059669",
		primaryHover: "#10b981",
		primarySoft: "#ecfdf5",
		accent: "rgba(5, 150, 105, 0.08)",
		accentForeground: "#059669",
		ring: "#059669",
	},
	{
		id: "rose",
		label: "Rose",
		swatch: "#e11d48",
		primary: "#e11d48",
		primaryHover: "#f43f5e",
		primarySoft: "#fff1f2",
		accent: "rgba(225, 29, 72, 0.08)",
		accentForeground: "#e11d48",
		ring: "#e11d48",
	},
	{
		id: "amber",
		label: "Amber",
		swatch: "#d97706",
		primary: "#d97706",
		primaryHover: "#f59e0b",
		primarySoft: "#fffbeb",
		accent: "rgba(217, 119, 6, 0.08)",
		accentForeground: "#d97706",
		ring: "#d97706",
	},
];

const STORAGE_KEY = "antcode.accent";

function readAccent(): string {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw && ACCENT_PRESETS.some((p) => p.id === raw)) return raw;
	} catch {}
	return "indigo";
}

interface Store {
	activeId: string;
	setAccent: (id: string) => void;
}

function applyAccent(preset: AccentPreset) {
	const root = document.documentElement;
	root.style.setProperty("--primary", preset.primary);
	root.style.setProperty("--primary-hover", preset.primaryHover);
	root.style.setProperty("--primary-soft", preset.primarySoft);
	root.style.setProperty("--accent", preset.accent);
	root.style.setProperty("--accent-foreground", preset.accentForeground);
	root.style.setProperty("--ring", preset.ring);
}

export const useAccent = create<Store>((set) => ({
	activeId: readAccent(),
	setAccent: (id: string) => {
		const preset = ACCENT_PRESETS.find((p) => p.id === id);
		if (!preset) return;
		try {
			localStorage.setItem(STORAGE_KEY, id);
		} catch {}
		applyAccent(preset);
		set({ activeId: id });
	},
}));

/** Call once at app boot to apply the stored accent preset. */
export function initAccent(): void {
	const id = readAccent();
	const preset = ACCENT_PRESETS.find((p) => p.id === id);
	if (preset) applyAccent(preset);
}
