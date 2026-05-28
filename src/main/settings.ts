import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { getSharedServices } from "./shared-services.js";

let settingsManager: SettingsManager | undefined;

function getSettingsManager(): SettingsManager {
	if (!settingsManager) {
		const { agentDir } = getSharedServices();
		// Use a placeholder cwd for global settings; project settings
		// would need the active workspace cwd, which we handle separately.
		settingsManager = SettingsManager.create(process.cwd(), agentDir);
	}
	return settingsManager;
}

export interface DesktopSettings {
	defaultProvider: string | undefined;
	defaultModel: string | undefined;
	defaultThinkingLevel: string | undefined;
	transport: string;
	steeringMode: string;
	followUpMode: string;
	theme: string | undefined;
	compactionEnabled: boolean;
	retryEnabled: boolean;
	hideThinkingBlock: boolean;
	showImages: boolean;
	imageAutoResize: boolean;
	blockImages: boolean;
	enabledModels: string[] | undefined;
}

export function getDesktopSettings(): DesktopSettings {
	const sm = getSettingsManager();
	return {
		defaultProvider: sm.getDefaultProvider(),
		defaultModel: sm.getDefaultModel(),
		defaultThinkingLevel: sm.getDefaultThinkingLevel(),
		transport: sm.getTransport(),
		steeringMode: sm.getSteeringMode(),
		followUpMode: sm.getFollowUpMode(),
		theme: sm.getTheme(),
		compactionEnabled: sm.getCompactionEnabled(),
		retryEnabled: sm.getRetryEnabled(),
		hideThinkingBlock: sm.getHideThinkingBlock(),
		showImages: sm.getShowImages(),
		imageAutoResize: sm.getImageAutoResize(),
		blockImages: sm.getBlockImages(),
		enabledModels: sm.getEnabledModels(),
	};
}

export function setDesktopSetting(key: string, value: unknown): void {
	const sm = getSettingsManager();
	switch (key) {
		case "defaultProvider":
			sm.setDefaultProvider(value as string);
			break;
		case "defaultModel":
			sm.setDefaultModel(value as string);
			break;
		case "defaultThinkingLevel":
			sm.setDefaultThinkingLevel(value as "off" | "minimal" | "low" | "medium" | "high" | "xhigh");
			break;
		case "transport":
			sm.setTransport(value as "sse" | "websocket");
			break;
		case "steeringMode":
			sm.setSteeringMode(value as "all" | "one-at-a-time");
			break;
		case "followUpMode":
			sm.setFollowUpMode(value as "all" | "one-at-a-time");
			break;
		case "theme":
			if (value) sm.setTheme(value as string);
			break;
		case "compactionEnabled":
			sm.setCompactionEnabled(value as boolean);
			break;
		case "retryEnabled":
			sm.setRetryEnabled(value as boolean);
			break;
		case "hideThinkingBlock":
			sm.setHideThinkingBlock(value as boolean);
			break;
		case "showImages":
			sm.setShowImages(value as boolean);
			break;
		case "imageAutoResize":
			sm.setImageAutoResize(value as boolean);
			break;
		case "blockImages":
			sm.setBlockImages(value as boolean);
			break;
		case "enabledModels":
			sm.setEnabledModels(value as string[] | undefined);
			break;
		default:
			throw new Error(`Unknown setting: ${key}`);
	}
}

export function getAgentDirPath(): string {
	return getSharedServices().agentDir;
}
