import { getSharedServices } from "./shared-services.js";

export interface ProviderEntry {
	provider: string;
	type: "api_key" | "oauth";
	maskedKey?: string;
}

/**
 * Known API-key providers we surface in the picker. Free-form provider ids
 * are still accepted via the input box, but these populate the dropdown.
 */
const KNOWN_PROVIDERS = [
	"anthropic",
	"openai",
	"google",
	"google-vertex",
	"openai-codex",
	"azure-openai-responses",
	"deepseek",
	"xai",
	"groq",
	"cerebras",
	"openrouter",
	"vercel-ai-gateway",
	"mistral",
	"moonshotai",
	"moonshotai-cn",
	"minimax",
	"minimax-cn",
	"zai",
	"fireworks",
	"together",
	"huggingface",
	"amazon-bedrock",
	"github-copilot",
	"kimi-coding",
];

export function listKnownProviders(): string[] {
	return KNOWN_PROVIDERS;
}

export function listConfiguredProviders(): ProviderEntry[] {
	const { authStorage } = getSharedServices();
	const all = authStorage.getAll();
	const entries: ProviderEntry[] = [];
	for (const [provider, cred] of Object.entries(all)) {
		if (cred.type === "api_key") {
			entries.push({
				provider,
				type: "api_key",
				maskedKey: maskKey(cred.key),
			});
		} else if (cred.type === "oauth") {
			entries.push({ provider, type: "oauth" });
		}
	}
	entries.sort((a, b) => a.provider.localeCompare(b.provider));
	return entries;
}

export function setApiKey(provider: string, key: string): void {
	const trimmed = key.trim();
	if (!trimmed) throw new Error("API key cannot be empty");
	const { authStorage } = getSharedServices();
	authStorage.set(provider, { type: "api_key", key: trimmed });
}

export function removeProvider(provider: string): void {
	const { authStorage } = getSharedServices();
	authStorage.remove(provider);
}

function maskKey(key: string): string {
	if (!key) return "";
	if (key.length <= 10) return `${key.slice(0, 2)}…${key.slice(-2)}`;
	return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
