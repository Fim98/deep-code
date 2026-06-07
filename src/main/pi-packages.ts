import { DefaultPackageManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { hasProjectTrustInputs, ProjectTrustStore } from "./project-trust.js";
import { getSharedServices } from "./shared-services.js";

export interface DesktopPackageEntry {
	source: string;
	scope: "user" | "project";
	filtered: boolean;
	installedPath?: string;
}

function createPackageManager(cwd: string): DefaultPackageManager {
	const { agentDir } = getSharedServices();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	const maybeTrustAwareSettings = settingsManager as SettingsManager & {
		setProjectTrusted?: (trusted: boolean) => void;
	};
	const projectTrusted =
		!hasProjectTrustInputs(cwd) || new ProjectTrustStore(agentDir).get(cwd) === true;
	maybeTrustAwareSettings.setProjectTrusted?.(projectTrusted);
	return new DefaultPackageManager({ cwd, agentDir, settingsManager });
}

export function listPiPackages(cwd: string): DesktopPackageEntry[] {
	return createPackageManager(cwd).listConfiguredPackages();
}

export async function installPiPackage(args: {
	cwd: string;
	source: string;
	local?: boolean;
}): Promise<DesktopPackageEntry[]> {
	const pm = createPackageManager(args.cwd);
	await pm.installAndPersist(args.source, { local: args.local });
	return pm.listConfiguredPackages();
}

export async function removePiPackage(args: {
	cwd: string;
	source: string;
	local?: boolean;
}): Promise<DesktopPackageEntry[]> {
	const pm = createPackageManager(args.cwd);
	await pm.removeAndPersist(args.source, { local: args.local });
	return pm.listConfiguredPackages();
}

export async function updatePiPackages(args: {
	cwd: string;
	source?: string;
}): Promise<DesktopPackageEntry[]> {
	const pm = createPackageManager(args.cwd);
	await pm.update(args.source);
	return pm.listConfiguredPackages();
}
