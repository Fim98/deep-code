import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { zhCN } from "../i18n/zh-CN";
import { getLocale, LOCALES, type Locale, setLocale } from "./i18n";

describe("i18n", () => {
	const originalLang = document.documentElement.lang;

	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		document.documentElement.lang = originalLang;
		setLocale("en");
	});

	it("en dictionary has all required keys", () => {
		expect(en["settings.title"]).toBe("Settings");
		expect(en["composer.send"]).toBe("Send");
		expect(en["sidebar.workspaces"]).toBe("Workspaces");
		expect(en["header.search"]).toBe("Search");
		expect(en["palette.placeholder"]).toBeDefined();
		expect(en["theme.light"]).toBe("Light");
	});

	it("zh-CN dictionary has all required keys", () => {
		expect(zhCN["settings.title"]).toBe("设置");
		expect(zhCN["composer.send"]).toBe("发送");
		expect(zhCN["sidebar.workspaces"]).toBe("工作区");
		expect(zhCN["header.search"]).toBe("搜索");
		expect(zhCN["theme.light"]).toBe("浅色");
	});

	it("zh-CN has matching keys for every en key", () => {
		const enKeys = Object.keys(en);
		const zhKeys = new Set(Object.keys(zhCN));
		const missing = enKeys.filter((k) => !zhKeys.has(k));
		expect(missing).toEqual([]);
	});

	it("setLocale updates getLocale", () => {
		setLocale("zh-CN");
		expect(getLocale()).toBe("zh-CN");
	});

	it("setLocale persists to localStorage", () => {
		setLocale("zh-CN");
		expect(localStorage.getItem("deepcode.locale")).toBe("zh-CN");
	});

	it("setLocale sets document lang attribute", () => {
		setLocale("zh-CN");
		expect(document.documentElement.lang).toBe("zh-CN");
		setLocale("en");
		expect(document.documentElement.lang).toBe("en");
	});

	it("ignores invalid locale values", () => {
		setLocale("en");
		setLocale("invalid" as Locale);
		expect(getLocale()).toBe("en");
	});

	it("LOCALES contains en and zh-CN", () => {
		expect(LOCALES).toContain("en");
		expect(LOCALES).toContain("zh-CN");
	});

	it("interpolation works in dictionaries", () => {
		// Verify template syntax in dictionaries
		expect(en["header.messages"]).toContain("{{count}}");
		expect(zhCN["header.messages"]).toContain("{{count}}");
		expect(en["sidebar.deleteConfirm"]).toContain("{{name}}");
		expect(zhCN["sidebar.deleteConfirm"]).toContain("{{name}}");
	});
});
