import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, nativeImage, nativeTheme, shell } from "electron";
import { installErrorHandlers } from "./error-log.js";
import { registerIpcHandlers } from "./ipc.js";
import { ptyManager } from "./pty-manager.js";
import { initTelemetry } from "./telemetry.js";
import { destroyUpdater, initAutoUpdater } from "./updater.js";

const isDev = !app.isPackaged;
const defaultAppIcon = "app-icon-apple.png";
const macDockIcon = "app-icon-apple.icns";
const windowIconByPlatform: Partial<Record<NodeJS.Platform, string>> = {
	win32: "app-icon-apple.ico",
};
const windows = new Set<BrowserWindow>();

function revealWindow(win: BrowserWindow) {
	if (win.isDestroyed()) return;
	if (win.isMinimized()) win.restore();
	if (!win.isVisible()) win.show();
	win.focus();
}

function getResourceCandidates(fileName: string) {
	const mainDir = dirname(fileURLToPath(import.meta.url));
	return [
		join(process.cwd(), "resources", fileName),
		join(mainDir, "../../resources", fileName),
		join(mainDir, "../../../resources", fileName),
		join(app.getAppPath(), "resources", fileName),
		join(process.resourcesPath, "resources", fileName),
		join(process.resourcesPath, fileName),
	];
}

function findResourcePath(fileName: string) {
	for (const resourcePath of getResourceCandidates(fileName)) {
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

function getWindowIcon() {
	const fileName = windowIconByPlatform[process.platform] ?? defaultAppIcon;
	return getNativeIcon(fileName);
}

function setDockIcon() {
	if (process.platform !== "darwin" || !app.dock) return;
	const dockIcon = getNativeIcon(macDockIcon) ?? getNativeIcon(defaultAppIcon);
	if (dockIcon) app.dock.setIcon(dockIcon);
}

export async function createWindow(): Promise<BrowserWindow> {
	const icon = getWindowIcon();

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
		show: true,
		webPreferences: {
			preload: join(__dirname, "../preload/index.cjs"),
			contextIsolation: true,
			sandbox: false,
			nodeIntegration: false,
		},
	});

	win.once("ready-to-show", () => revealWindow(win));
	win.webContents.once("did-finish-load", () => revealWindow(win));
	const showFallback = setTimeout(() => revealWindow(win), 1500);

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
		clearTimeout(showFallback);
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
	setDockIcon();
	await createWindow();

	app.on("activate", async () => {
		setDockIcon();
		const win = getAnyWindow();
		if (win) revealWindow(win);
		else await createWindow();
	});
});

app.on("window-all-closed", () => {
	destroyUpdater();
	ptyManager.killAll();
	if (process.platform !== "darwin") app.quit();
});
