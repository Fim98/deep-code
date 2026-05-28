import { describe, expect, it, vi } from "vitest";

const mockSetDefaultProvider = vi.fn();
const mockSetDefaultModel = vi.fn();
const mockSetDefaultThinkingLevel = vi.fn();
const mockSetTransport = vi.fn();
const mockSetSteeringMode = vi.fn();
const mockSetFollowUpMode = vi.fn();
const mockSetTheme = vi.fn();
const mockSetCompactionEnabled = vi.fn();
const mockSetRetryEnabled = vi.fn();
const mockSetShowImages = vi.fn();
const mockSetImageAutoResize = vi.fn();
const mockSetBlockImages = vi.fn();
const mockSetEnabledModels = vi.fn();

const mockSettingsManager = {
	getDefaultProvider: vi.fn().mockReturnValue(undefined),
	getDefaultModel: vi.fn().mockReturnValue(undefined),
	getDefaultThinkingLevel: vi.fn().mockReturnValue("off"),
	getTransport: vi.fn().mockReturnValue("sse"),
	getSteeringMode: vi.fn().mockReturnValue("all"),
	getFollowUpMode: vi.fn().mockReturnValue("all"),
	getTheme: vi.fn().mockReturnValue(undefined),
	getCompactionEnabled: vi.fn().mockReturnValue(true),
	getRetryEnabled: vi.fn().mockReturnValue(true),
	getHideThinkingBlock: vi.fn().mockReturnValue(false),
	getShowImages: vi.fn().mockReturnValue(true),
	getImageAutoResize: vi.fn().mockReturnValue(true),
	getBlockImages: vi.fn().mockReturnValue(false),
	getEnabledModels: vi.fn().mockReturnValue(undefined),
	setDefaultProvider: mockSetDefaultProvider,
	setDefaultModel: mockSetDefaultModel,
	setDefaultThinkingLevel: mockSetDefaultThinkingLevel,
	setTransport: mockSetTransport,
	setSteeringMode: mockSetSteeringMode,
	setFollowUpMode: mockSetFollowUpMode,
	setTheme: mockSetTheme,
	setCompactionEnabled: mockSetCompactionEnabled,
	setRetryEnabled: mockSetRetryEnabled,
	setShowImages: mockSetShowImages,
	setImageAutoResize: mockSetImageAutoResize,
	setBlockImages: mockSetBlockImages,
	setEnabledModels: mockSetEnabledModels,
};

vi.mock("./shared-services.js", () => ({
	getSharedServices: vi.fn(() => ({
		authStorage: {},
		modelRegistry: {},
		agentDir: "/tmp/test-agent",
	})),
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
	SettingsManager: {
		create: vi.fn(() => mockSettingsManager),
	},
}));

import { getAgentDirPath, getDesktopSettings, setDesktopSetting } from "./settings";

describe("settings", () => {
	describe("getDesktopSettings", () => {
		it("returns all settings from SettingsManager", () => {
			const settings = getDesktopSettings();
			expect(settings.compactionEnabled).toBe(true);
			expect(settings.retryEnabled).toBe(true);
			expect(settings.showImages).toBe(true);
			expect(settings.imageAutoResize).toBe(true);
			expect(settings.blockImages).toBe(false);
		});
	});

	describe("setDesktopSetting", () => {
		it("sets defaultProvider", () => {
			setDesktopSetting("defaultProvider", "anthropic");
			expect(mockSetDefaultProvider).toHaveBeenCalledWith("anthropic");
		});

		it("sets defaultModel", () => {
			setDesktopSetting("defaultModel", "claude-sonnet-4-20250514");
			expect(mockSetDefaultModel).toHaveBeenCalledWith("claude-sonnet-4-20250514");
		});

		it("sets defaultThinkingLevel", () => {
			setDesktopSetting("defaultThinkingLevel", "high");
			expect(mockSetDefaultThinkingLevel).toHaveBeenCalledWith("high");
		});

		it("sets compactionEnabled", () => {
			setDesktopSetting("compactionEnabled", false);
			expect(mockSetCompactionEnabled).toHaveBeenCalledWith(false);
		});

		it("sets retryEnabled", () => {
			setDesktopSetting("retryEnabled", true);
			expect(mockSetRetryEnabled).toHaveBeenCalledWith(true);
		});

		it("sets showImages", () => {
			setDesktopSetting("showImages", false);
			expect(mockSetShowImages).toHaveBeenCalledWith(false);
		});

		it("sets imageAutoResize", () => {
			setDesktopSetting("imageAutoResize", false);
			expect(mockSetImageAutoResize).toHaveBeenCalledWith(false);
		});

		it("sets blockImages", () => {
			setDesktopSetting("blockImages", true);
			expect(mockSetBlockImages).toHaveBeenCalledWith(true);
		});

		it("sets enabledModels", () => {
			setDesktopSetting("enabledModels", ["anthropic/*"]);
			expect(mockSetEnabledModels).toHaveBeenCalledWith(["anthropic/*"]);
		});

		it("throws for unknown setting key", () => {
			expect(() => setDesktopSetting("unknownKey", "value")).toThrow("Unknown setting");
		});
	});

	describe("getAgentDirPath", () => {
		it("returns the agent directory path", () => {
			expect(getAgentDirPath()).toBe("/tmp/test-agent");
		});
	});
});
