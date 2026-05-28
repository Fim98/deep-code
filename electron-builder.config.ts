import type { Configuration } from "electron-builder";

const config: Configuration = {
	appId: "com.deepcode.app",
	productName: "deepcode",
	asar: true,
	asarUnpack: [
		// Native addons cannot be loaded from inside an asar archive
		"**/*.node",
		"**/node_modules/undici/**",
	],
	directories: {
		output: "release",
	},
	files: [
		"out/**/*",
		"package.json",
		// Exclude test and dev-only files from the bundle
		"!**/*.test.*",
		"!**/*.spec.*",
		"!vitest.config.*",
		"!src/test/**",
	],
	extraResources: [
		{
			from: "resources",
			to: "resources",
			filter: ["**/*"],
		},
	],
	mac: {
		category: "public.app-category.developer-tools",
		icon: "resources/app-icon-apple.icns",
		target: [
			{
				target: "dmg",
				arch: ["x64", "arm64"],
			},
			{
				target: "zip",
				arch: ["x64", "arm64"],
			},
		],
	},
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
	},
	nsis: {
		oneClick: false,
		perMachine: false,
		allowToChangeInstallationDirectory: true,
	},
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
	},
	// electron-builder expands these macros at package time.
	// biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder artifact macro syntax
	artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
};

export default config;
