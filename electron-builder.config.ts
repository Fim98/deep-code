import type { Configuration } from "electron-builder";

const config: Configuration = {
	appId: "com.deepcode.app",
	productName: "deepcode",
	asar: true,
	directories: {
		output: "release",
	},
	files: ["out/**/*", "package.json"],
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
	// electron-builder expands these macros at package time.
	// biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder artifact macro syntax
	artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
};

export default config;
