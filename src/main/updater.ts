import { app, BrowserWindow } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let checkTimer: ReturnType<typeof setInterval> | undefined;

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

export function initAutoUpdater(): void {
	// Don't run in dev mode
	if (!app.isPackaged) return;

	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = true;

	autoUpdater.on("checking-for-update", () => {
		emit({ status: "checking" });
	});

	autoUpdater.on("update-available", (info: UpdateInfo) => {
		emit({ status: "available", version: info.version });
	});

	autoUpdater.on("update-not-available", () => {
		emit({ status: "not-available" });
	});

	autoUpdater.on("error", (err: Error) => {
		emit({ status: "error", error: err.message });
	});

	autoUpdater.on("download-progress", () => {
		emit({ status: "downloading" });
	});

	autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
		emit({ status: "downloaded", version: info.version });
	});

	// Check immediately, then every 6 hours
	scheduleCheck();
	checkTimer = setInterval(scheduleCheck, CHECK_INTERVAL_MS);
}

export function scheduleCheck(): void {
	if (!app.isPackaged) return;
	autoUpdater.checkForUpdates().catch(() => {
		// Silently ignore — we emit error state above
	});
}

export function quitAndInstall(): void {
	autoUpdater.quitAndInstall();
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
