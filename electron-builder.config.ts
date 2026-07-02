import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Arch } from "builder-util";
import type { AfterPackContext, Configuration } from "electron-builder";

async function removeIfPresent(path: string) {
	await rm(path, { force: true, recursive: true });
}

async function removeUnusedNativePackages(context: AfterPackContext) {
	if (context.electronPlatformName !== "darwin") return;

	const modulesDir = join(
		context.appOutDir,
		`${context.packager.appInfo.productFilename}.app`,
		"Contents",
		"Resources",
		"app.asar.unpacked",
		"node_modules",
	);
	const clipboardDir = join(modulesDir, "@mariozechner");

	if (context.arch === Arch.arm64) {
		await removeIfPresent(join(clipboardDir, "clipboard-darwin-x64"));
	} else if (context.arch === Arch.x64) {
		await removeIfPresent(join(clipboardDir, "clipboard-darwin-arm64"));
	}
}

const config: Configuration = {
	appId: "com.antcode.app",
	productName: "antcode",

	// asar 打包
	asar: true,
	// 只解包 .node 原生模块（undici 是纯 JS，不需要解包）
	asarUnpack: ["**/*.node"],

	// 打包时移除 package.json 中的 scripts 和 keywords（减少体积）
	removePackageScripts: true,
	removePackageKeywords: true,

	directories: {
		output: "release",
	},

	afterPack: removeUnusedNativePackages,

	// ---------- 全局文件过滤 ----------
	files: [
		"out/**/*",
		"package.json",

		// 排除测试文件
		"!**/*.test.*",
		"!**/*.spec.*",
		"!**/*.mock.*",
		"!**/__tests__/**",
		"!**/test/**",
		"!**/tests/**",
		"!vitest.config.*",
		"!src/test/**",

		// 排除文档（约节省 10~20MB）
		"!**/*.md",
		"!**/*.mdx",

		// 排除 JavaScript 源码映射（最大头之一！约节省 170MB）
		"!**/*.js.map",
		"!**/*.css.map",

		// 排除 TypeScript 编译产物
		"!**/tsconfig.json",
		"!**/tsconfig.*.json",
		"!**/*.tsbuildinfo",

		// 排除调试符号（node-pty 的 Windows .pdb 文件，约节省 66MB）
		"!**/*.pdb",
		"!**/*.pdb/**",

		// 排除包管理锁文件
		"!**/package-lock.json",
		"!**/yarn.lock",
		"!**/pnpm-lock.yaml",

		// 排除编辑器/工具配置
		"!**/.gitignore",
		"!**/.npmignore",
		"!**/.editorconfig",
		"!**/.eslintrc*",
		"!**/.prettierrc*",
		"!**/.babelrc*",
		"!**/.eslintignore",

		// 排除 CI 配置
		"!**/.github/**",
		"!**/.circleci/**",
		"!**/.travis.yml",
		"!**/appveyor.yml",
	],

	extraResources: [
		{
			from: "resources",
			to: "resources",
			filter: ["**/*"],
		},
	],

	// ---------- macOS ----------
	mac: {
		category: "public.app-category.developer-tools",
		icon: "resources/app-icon-apple.icns",
		target: [
			{
				target: "dmg",
				arch: ["arm64", "x64"],
			},
			{
				target: "zip",
				arch: ["arm64", "x64"],
			},
		],
		files: [
			// node-pty：排除 Windows 平台的预编译二进制（~60MB）
			"!node_modules/node-pty/prebuilds/win32*/**",
			"!node_modules/node-pty/third_party/**",
			// 如果是 Apple Silicon，还可以排除 x64 的预编译
			"!node_modules/node-pty/prebuilds/darwin-x64/**",

			// pi-tui：mac 包不需要 Windows 原生扩展
			"!node_modules/@earendil-works/pi-tui/native/win32/**",

			// clipboard：mac 包不需要 Linux / Windows 原生扩展
			"!node_modules/@mariozechner/clipboard-linux*/**",
			"!node_modules/@mariozechner/clipboard-win32*/**",
		],
	},

	// ---------- Windows ----------
	win: {
		icon: "resources/app-icon-apple.ico",
		target: [
			{
				target: "nsis",
				arch: ["x64", "arm64"],
			},
			{
				target: "zip",
				arch: ["x64", "arm64"],
			},
		],
		files: [
			// node-pty：排除 macOS/Linux 的预编译二进制
			"!node_modules/node-pty/prebuilds/darwin*/**",
			"!node_modules/node-pty/prebuilds/linux*/**",
		],
	},

	nsis: {
		oneClick: false,
		perMachine: false,
		allowToChangeInstallationDirectory: true,
	},

	// ---------- Linux ----------
	linux: {
		icon: "resources/app-icon-apple.png",
		category: "Development",
		target: [
			{
				target: "AppImage",
				arch: ["x64", "arm64"],
			},
			{
				target: "zip",
				arch: ["x64", "arm64"],
			},
		],
		files: [
			// node-pty：排除 macOS/Windows 的预编译二进制
			"!node_modules/node-pty/prebuilds/darwin*/**",
			"!node_modules/node-pty/prebuilds/win32*/**",
			"!node_modules/node-pty/third_party/**",
		],
	},

	// 最大压缩（构建会慢一些，但安装包更小）
	compression: "maximum",

	// biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder artifact macro syntax
	artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
};

export default config;
