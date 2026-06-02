import { createRequire } from "node:module";
import { app, BrowserWindow } from "electron";
import type { AppUpdater, UpdateInfo } from "electron-updater";

const require = createRequire(import.meta.url);

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let checkTimer: ReturnType<typeof setInterval> | undefined;
let autoUpdater: AppUpdater | undefined;
let initialized = false;

interface UpdateState {
	status:
		| "idle"
		| "checking"
		| "available"
		| "not-available"
		| "error"
		| "downloading"
		| "downloaded";
	version?: string;
	error?: string;
}

const listeners = new Set<(state: UpdateState) => void>();

function emit(state: UpdateState) {
	for (const fn of listeners) fn(state);
	// Also push to renderer via IPC event
	const win = BrowserWindow.getAllWindows()[0];
	if (win && !win.isDestroyed()) {
		win.webContents.send("pi:update:state", state);
	}
}

function getAutoUpdater(): AppUpdater | undefined {
	if (autoUpdater) return autoUpdater;
	try {
		const updaterModule = require("electron-updater") as { autoUpdater?: AppUpdater };
		autoUpdater = updaterModule.autoUpdater;
		return autoUpdater;
	} catch (err) {
		emit({
			status: "error",
			error: err instanceof Error ? err.message : String(err),
		});
		return undefined;
	}
}

export function initAutoUpdater(): void {
	// Don't run in dev mode
	if (!app.isPackaged) return;
	if (initialized) return;

	const updater = getAutoUpdater();
	if (!updater) return;
	initialized = true;

	updater.autoDownload = true;
	updater.autoInstallOnAppQuit = true;

	updater.on("checking-for-update", () => {
		emit({ status: "checking" });
	});

	updater.on("update-available", (info: UpdateInfo) => {
		emit({ status: "available", version: info.version });
	});

	updater.on("update-not-available", () => {
		emit({ status: "not-available" });
	});

	updater.on("error", (err: Error) => {
		emit({ status: "error", error: err.message });
	});

	updater.on("download-progress", () => {
		emit({ status: "downloading" });
	});

	updater.on("update-downloaded", (info: UpdateInfo) => {
		emit({ status: "downloaded", version: info.version });
	});

	// Check immediately, then every 6 hours
	scheduleCheck();
	checkTimer = setInterval(scheduleCheck, CHECK_INTERVAL_MS);
}

export function scheduleCheck(): void {
	if (!app.isPackaged) return;
	const updater = getAutoUpdater();
	if (!updater) return;
	updater.checkForUpdates().catch(() => {
		// Silently ignore — we emit error state above
	});
}

export function quitAndInstall(): void {
	const updater = getAutoUpdater();
	if (!updater) return;
	updater.quitAndInstall();
}

export function onUpdateState(fn: (state: UpdateState) => void): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

export function destroyUpdater(): void {
	if (checkTimer) {
		clearInterval(checkTimer);
		checkTimer = undefined;
	}
	listeners.clear();
}
