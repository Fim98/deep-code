import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Clear localStorage before each test
beforeEach(() => {
	localStorage.clear();
	// Reset the module to re-read localStorage
	vi.resetModules();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("theme store", () => {
	it("defaults to system theme", async () => {
		const { useTheme } = await import("./theme");
		const state = useTheme.getState();
		expect(state.choice).toBe("system");
	});

	it("reads persisted choice from localStorage", async () => {
		localStorage.setItem("pi.theme", "dark");
		const { useTheme } = await import("./theme");
		expect(useTheme.getState().choice).toBe("dark");
		expect(useTheme.getState().applied).toBe("dark");
	});

	it("setChoice updates state and localStorage", async () => {
		const { useTheme } = await import("./theme");
		useTheme.getState().setChoice("dark");

		expect(useTheme.getState().choice).toBe("dark");
		expect(useTheme.getState().applied).toBe("dark");
		expect(localStorage.getItem("pi.theme")).toBe("dark");
	});

	it("setChoice('light') applies light theme", async () => {
		const { useTheme } = await import("./theme");
		useTheme.getState().setChoice("light");

		expect(useTheme.getState().applied).toBe("light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(document.documentElement.dataset.theme).toBe("light");
	});

	it("setChoice('dark') applies dark class to document", async () => {
		const { useTheme } = await import("./theme");
		useTheme.getState().setChoice("dark");

		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.dataset.theme).toBe("dark");
	});

	it("setChoice calls pi.theme.setSource", async () => {
		const mockPi = (window as any).pi;
		const { useTheme } = await import("./theme");
		useTheme.getState().setChoice("dark");
		expect(mockPi.theme.setSource).toHaveBeenCalledWith("dark");
	});

	it("ignores invalid localStorage values", async () => {
		localStorage.setItem("pi.theme", "invalid-theme");
		const { useTheme } = await import("./theme");
		expect(useTheme.getState().choice).toBe("system");
	});
});
