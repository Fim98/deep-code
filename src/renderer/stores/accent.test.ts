import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ACCENT_PRESETS, useAccent } from "./accent";

describe("accent store", () => {
	beforeEach(() => {
		localStorage.clear();
		// Reset to default
		useAccent.setState({ activeId: "indigo" });
		document.documentElement.style.removeProperty("--primary");
	});

	afterEach(() => {
		document.documentElement.style.removeProperty("--primary");
		document.documentElement.style.removeProperty("--primary-hover");
		document.documentElement.style.removeProperty("--primary-soft");
		document.documentElement.style.removeProperty("--accent");
		document.documentElement.style.removeProperty("--accent-foreground");
		document.documentElement.style.removeProperty("--ring");
	});

	it("defaults to indigo", () => {
		expect(useAccent.getState().activeId).toBe("indigo");
	});

	it("ACCENT_PRESETS has at least 3 presets", () => {
		expect(ACCENT_PRESETS.length).toBeGreaterThanOrEqual(3);
	});

	it("all presets have required fields", () => {
		for (const p of ACCENT_PRESETS) {
			expect(p.id).toBeTruthy();
			expect(p.label).toBeTruthy();
			expect(p.swatch).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.primary).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.primaryHover).toBeTruthy();
			expect(p.primarySoft).toBeTruthy();
			expect(p.ring).toBeTruthy();
		}
	});

	it("setAccent changes activeId", () => {
		useAccent.getState().setAccent("blue");
		expect(useAccent.getState().activeId).toBe("blue");
	});

	it("setAccent persists to localStorage", () => {
		useAccent.getState().setAccent("emerald");
		expect(localStorage.getItem("deepcode.accent")).toBe("emerald");
	});

	it("setAccent applies CSS variables to document root", () => {
		const blue = ACCENT_PRESETS.find((p) => p.id === "blue")!;
		useAccent.getState().setAccent("blue");
		expect(document.documentElement.style.getPropertyValue("--primary")).toBe(blue.primary);
		expect(document.documentElement.style.getPropertyValue("--ring")).toBe(blue.ring);
	});

	it("setAccent ignores unknown preset ids", () => {
		useAccent.getState().setAccent("indigo");
		useAccent.getState().setAccent("nonexistent");
		expect(useAccent.getState().activeId).toBe("indigo");
	});
});
