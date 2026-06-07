import {
	DefaultPackageManager,
	type ProgressCallback,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { hasProjectTrustInputs, ProjectTrustStore } from "./project-trust.js";
import { getSharedServices } from "./shared-services.js";

export interface DesktopPackageEntry {
	source: string;
	scope: "user" | "project";
	filtered: boolean;
	installedPath?: string;
}

function createPackageManager(cwd: string, onProgress?: ProgressCallback): DefaultPackageManager {
	const { agentDir } = getSharedServices();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	const maybeTrustAwareSettings = settingsManager as SettingsManager & {
		setProjectTrusted?: (trusted: boolean) => void;
	};
	const projectTrusted =
		!hasProjectTrustInputs(cwd) || new ProjectTrustStore(agentDir).get(cwd) === true;
	maybeTrustAwareSettings.setProjectTrusted?.(projectTrusted);
	const manager = new DefaultPackageManager({ cwd, agentDir, settingsManager });
	manager.setProgressCallback(onProgress);
	return manager;
}

export function listPiPackages(cwd: string): DesktopPackageEntry[] {
	return createPackageManager(cwd).listConfiguredPackages();
}

export async function installPiPackage(
	args: {
		cwd: string;
		source: string;
		local?: boolean;
	},
	onProgress?: ProgressCallback,
): Promise<DesktopPackageEntry[]> {
	const pm = createPackageManager(args.cwd, onProgress);
	await pm.installAndPersist(args.source, { local: args.local });
	return pm.listConfiguredPackages();
}

export async function removePiPackage(
	args: {
		cwd: string;
		source: string;
		local?: boolean;
	},
	onProgress?: ProgressCallback,
): Promise<DesktopPackageEntry[]> {
	const pm = createPackageManager(args.cwd, onProgress);
	await pm.removeAndPersist(args.source, { local: args.local });
	return pm.listConfiguredPackages();
}

export async function updatePiPackages(
	args: {
		cwd: string;
		source?: string;
	},
	onProgress?: ProgressCallback,
): Promise<DesktopPackageEntry[]> {
	const pm = createPackageManager(args.cwd, onProgress);
	await pm.update(args.source);
	return pm.listConfiguredPackages();
}
