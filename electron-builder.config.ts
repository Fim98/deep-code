import type { Configuration } from "electron-builder";

const config: Configuration = {
	appId: "com.deepcode.app",
	productName: "deepcode",

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

		// 排除文档和变更日志（约节省 10~20MB）
		"!**/*.md",
		"!**/*.mdx",
		"!**/CHANGELOG*",
		"!**/CHANGE_LOG*",
		"!**/changelog*",

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
