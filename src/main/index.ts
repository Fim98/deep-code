import { existsSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, nativeImage, nativeTheme, shell } from "electron";
import { installErrorHandlers } from "./error-log.js";
import { registerIpcHandlers } from "./ipc.js";
import { ptyManager } from "./pty-manager.js";
import { initTelemetry } from "./telemetry.js";
import { destroyUpdater, initAutoUpdater } from "./updater.js";

const isDev = !app.isPackaged;
const defaultAppIcon = "app-icon-apple.png";
const windowIconByPlatform: Partial<Record<NodeJS.Platform, string>> = {
	win32: "app-icon-apple.ico",
};
const windows = new Set<BrowserWindow>();

function findResourcePath(fileName: string) {
	const basePaths = isDev
		? [process.cwd(), app.getAppPath()]
		: [process.resourcesPath, app.getAppPath()];
	for (const basePath of basePaths) {
		const resourcePath = join(basePath, "resources", fileName);
		if (existsSync(resourcePath)) return resourcePath;
	}
	return undefined;
}

function getNativeIcon(fileName = defaultAppIcon) {
	const iconPath = findResourcePath(fileName);
	if (!iconPath) return undefined;
	const icon = nativeImage.createFromPath(iconPath);
	return icon.isEmpty() ? undefined : icon;
}

function getWindowIconPath() {
	return findResourcePath(windowIconByPlatform[process.platform] ?? defaultAppIcon);
}

export async function createWindow(): Promise<BrowserWindow> {
	const icon = getWindowIconPath();

	const win = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 960,
		minHeight: 600,
		icon,
		titleBarStyle: "hiddenInset",
		trafficLightPosition: { x: 16, y: 16 },
		vibrancy: "sidebar",
		visualEffectState: "active",
		backgroundColor: nativeTheme.shouldUseDarkColors ? "#1c1c1e" : "#f5f5f7",
		show: false,
		webPreferences: {
			preload: join(__dirname, "../preload/index.cjs"),
			contextIsolation: true,
			sandbox: false,
			nodeIntegration: false,
		},
	});

	win.once("ready-to-show", () => win.show());

	// Open all external links in the system default browser
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("http://") || url.startsWith("https://")) {
			shell.openExternal(url);
		}
		return { action: "deny" };
	});

	if (isDev && process.env.ELECTRON_RENDERER_URL) {
		await win.loadURL(process.env.ELECTRON_RENDERER_URL);
		// Only open DevTools for the first window
		if (windows.size === 0) {
			win.webContents.openDevTools({ mode: "detach" });
		}
	} else {
		await win.loadFile(join(__dirname, "../renderer/index.html"));
	}

	const refreshBg = () => {
		if (win.isDestroyed()) return;
		win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#1c1c1e" : "#f5f5f7");
	};
	nativeTheme.on("updated", refreshBg);

	windows.add(win);
	win.on("closed", () => {
		nativeTheme.off("updated", refreshBg);
		windows.delete(win);
	});
	return win;
}

function getAnyWindow(): BrowserWindow | undefined {
	return BrowserWindow.getFocusedWindow() ?? windows.values().next().value ?? undefined;
}

app.whenReady().then(async () => {
	installErrorHandlers();
	initTelemetry();
	registerIpcHandlers(getAnyWindow);
	initAutoUpdater();
	const icon = getNativeIcon();
	if (process.platform === "darwin" && icon) app.dock?.setIcon(icon);
	await createWindow();

	app.on("activate", async () => {
		if (BrowserWindow.getAllWindows().length === 0) await createWindow();
	});
});

app.on("window-all-closed", () => {
	destroyUpdater();
	ptyManager.killAll();
	if (process.platform !== "darwin") app.quit();
});
