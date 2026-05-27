import { existsSync } from "node:fs";
import { join } from "node:path";
import { BrowserWindow, app, nativeImage, nativeTheme } from "electron";
import { registerIpcHandlers } from "./ipc.js";

const isDev = !app.isPackaged;
const defaultAppIcon = "app-icon-apple.png";
const windowIconByPlatform: Partial<Record<NodeJS.Platform, string>> = {
	win32: "app-icon-apple.ico",
};
let mainWindow: BrowserWindow | undefined;

function findResourcePath(fileName: string) {
	const basePaths = isDev ? [process.cwd(), app.getAppPath()] : [process.resourcesPath, app.getAppPath()];
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

async function createWindow(): Promise<BrowserWindow> {
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

	if (isDev && process.env.ELECTRON_RENDERER_URL) {
		await win.loadURL(process.env.ELECTRON_RENDERER_URL);
		win.webContents.openDevTools({ mode: "detach" });
	} else {
		await win.loadFile(join(__dirname, "../renderer/index.html"));
	}

	const refreshBg = () => {
		if (win.isDestroyed()) return;
		win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#1c1c1e" : "#f5f5f7");
	};
	nativeTheme.on("updated", refreshBg);

	mainWindow = win;
	win.on("closed", () => {
		nativeTheme.off("updated", refreshBg);
		if (mainWindow === win) mainWindow = undefined;
	});
	return win;
}

app.whenReady().then(async () => {
	registerIpcHandlers(() => mainWindow);
	const icon = getNativeIcon();
	if (process.platform === "darwin" && icon) app.dock?.setIcon(icon);
	await createWindow();

	app.on("activate", async () => {
		if (BrowserWindow.getAllWindows().length === 0) await createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
