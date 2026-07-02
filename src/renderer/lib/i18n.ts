/**
 * Lightweight i18n for antcode — function-based, no runtime library.
 *
 * Pattern: flat key→value dictionaries. The `t()` function resolves a key
 * against the active dictionary, falling back to English. Supports simple
 * `{{param}}` interpolation (e.g. `"Hello {{name}}"` → `"Hello World"`).
 */

import { useCallback, useSyncExternalStore } from "react";
import { en } from "../i18n/en";
import { zhCN } from "../i18n/zh-CN";

export type Locale = "en" | "zh-CN";

type Dict = Record<string, string>;

const DICTS: Record<Locale, Dict> = { en, "zh-CN": zhCN };

const STORAGE_KEY = "antcode.locale";

// ─── Detection ──────────────────────────────────────────────────────────────

function detectLocale(): Locale {
	if (typeof navigator === "undefined") return "en";
	const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
	for (const lang of langs) {
		if (!lang) continue;
		const lower = lang.toLowerCase();
		if (lower.startsWith("zh")) return "zh-CN";
		if (lower.startsWith("en")) return "en";
	}
	return "en";
}

function readStored(): Locale | undefined {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === "en" || raw === "zh-CN") return raw;
	} catch {}
	return undefined;
}

// ─── Store (minimal, no zustand — just a module-level singleton) ────────────

let currentLocale: Locale = readStored() ?? detectLocale();
const listeners = new Set<() => void>();

function notify() {
	for (const fn of listeners) fn();
}

export function getLocale(): Locale {
	return currentLocale;
}

export function setLocale(locale: Locale): void {
	if (locale === currentLocale) return;
	if (locale !== "en" && locale !== "zh-CN") return;
	currentLocale = locale;
	try {
		localStorage.setItem(STORAGE_KEY, locale);
	} catch {}
	document.documentElement.lang = locale;
	notify();
}

function subscribe(cb: () => void): () => void {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

function getSnapshot(): Locale {
	return currentLocale;
}

// ─── Translation ────────────────────────────────────────────────────────────

function _translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
	const dict = DICTS[locale] ?? DICTS.en;
	let text = dict[key] ?? DICTS.en[key] ?? key;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
		}
	}
	return text;
}

/**
 * Standalone translate function — uses the current locale at call time.
 * Use this outside React components (e.g. in callbacks, event handlers).
 */
export function t(key: string, params?: Record<string, string | number>): string {
	return _translate(currentLocale, key, params);
}

// ─── React hook ─────────────────────────────────────────────────────────────

/**
 * Returns the current locale and a `t()` translator function.
 *
 * ```tsx
 * const { t, locale, setLocale } = useI18n();
 * return <span>{t("settings.title")}</span>;
 * ```
 */
export function useI18n() {
	const locale = useSyncExternalStore(subscribe, getSnapshot);

	const translate = useCallback(
		(key: string, params?: Record<string, string | number>): string => {
			return _translate(locale, key, params);
		},
		[locale],
	);

	return { locale, setLocale, t: translate };
}

// ─── Labels ─────────────────────────────────────────────────────────────────

export const LOCALE_LABELS: Record<Locale, string> = {
	en: "English",
	"zh-CN": "简体中文",
};

export const LOCALES: Locale[] = ["en", "zh-CN"];

// ─── Boot ───────────────────────────────────────────────────────────────────

/** Call once at app startup to apply the stored/detected locale. */
export function initI18n(): void {
	document.documentElement.lang = currentLocale;
}
