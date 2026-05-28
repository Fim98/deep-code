import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock shared-services to provide an in-memory auth storage
const mockCredentials = new Map<string, { type: string; key?: string }>();
const mockAuthStorage = {
	getAll: vi.fn(() => {
		const result: Record<string, { type: string; key?: string }> = {};
		for (const [k, v] of mockCredentials) result[k] = v;
		return result;
	}),
	set: vi.fn((provider: string, cred: { type: string; key?: string }) => {
		mockCredentials.set(provider, cred);
	}),
	remove: vi.fn((provider: string) => {
		mockCredentials.delete(provider);
	}),
	get: vi.fn((provider: string) => mockCredentials.get(provider)),
};

vi.mock("./shared-services.js", () => ({
	getSharedServices: vi.fn(() => ({
		authStorage: mockAuthStorage,
		modelRegistry: {},
		agentDir: "/tmp/test-agent",
	})),
}));

import { listConfiguredProviders, listKnownProviders, removeProvider, setApiKey } from "./auth";

describe("auth", () => {
	beforeEach(() => {
		mockCredentials.clear();
		vi.clearAllMocks();
	});

	describe("listKnownProviders", () => {
		it("returns a non-empty array of known providers", () => {
			const providers = listKnownProviders();
			expect(providers.length).toBeGreaterThan(0);
			expect(providers).toContain("anthropic");
			expect(providers).toContain("openai");
		});
	});

	describe("listConfiguredProviders", () => {
		it("returns empty when no providers configured", () => {
			expect(listConfiguredProviders()).toEqual([]);
		});

		it("returns api_key providers with masked key", () => {
			mockCredentials.set("anthropic", { type: "api_key", key: "sk-ant-1234567890abcdef" });
			const result = listConfiguredProviders();
			expect(result).toHaveLength(1);
			expect(result[0].provider).toBe("anthropic");
			expect(result[0].type).toBe("api_key");
			expect(result[0].maskedKey).toBeDefined();
			// Masked key should not be the full key
			expect(result[0].maskedKey).not.toBe("sk-ant-1234567890abcdef");
		});

		it("returns oauth providers without key", () => {
			mockCredentials.set("anthropic", { type: "oauth" });
			const result = listConfiguredProviders();
			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("oauth");
			expect(result[0].maskedKey).toBeUndefined();
		});

		it("sorts providers alphabetically", () => {
			mockCredentials.set("openai", { type: "api_key", key: "sk-openai-12345678" });
			mockCredentials.set("anthropic", { type: "api_key", key: "sk-ant-12345678" });
			const result = listConfiguredProviders();
			expect(result[0].provider).toBe("anthropic");
			expect(result[1].provider).toBe("openai");
		});
	});

	describe("setApiKey", () => {
		it("stores the API key", () => {
			setApiKey("openai", "sk-test-key-12345");
			expect(mockAuthStorage.set).toHaveBeenCalledWith("openai", {
				type: "api_key",
				key: "sk-test-key-12345",
			});
		});

		it("trims whitespace", () => {
			setApiKey("openai", "  sk-test-key-12345  ");
			expect(mockAuthStorage.set).toHaveBeenCalledWith("openai", {
				type: "api_key",
				key: "sk-test-key-12345",
			});
		});

		it("throws on empty key", () => {
			expect(() => setApiKey("openai", "")).toThrow("empty");
			expect(() => setApiKey("openai", "   ")).toThrow("empty");
		});
	});

	describe("removeProvider", () => {
		it("removes the provider", () => {
			mockCredentials.set("openai", { type: "api_key", key: "sk-test" });
			removeProvider("openai");
			expect(mockAuthStorage.remove).toHaveBeenCalledWith("openai");
		});
	});
});
