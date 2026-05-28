import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
		build: {
			rollupOptions: {
				input: { index: resolve(__dirname, "src/main/index.ts") },
			},
		},
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
		build: {
			rollupOptions: {
				input: { index: resolve(__dirname, "src/preload/index.ts") },
				output: { format: "cjs" },
			},
		},
	},
	renderer: {
		root: resolve(__dirname, "src/renderer"),
		resolve: {
			alias: {
				"@": resolve(__dirname, "src/renderer"),
			},
		},
		plugins: [react()],
		build: {
			rollupOptions: {
				input: { index: resolve(__dirname, "src/renderer/index.html") },
				output: {
					manualChunks(id) {
						if (!id.includes("node_modules")) return undefined;
						if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
							return "react";
						}
						if (id.includes("@radix-ui")) return "radix-ui";
						if (id.includes("lucide-react")) return "icons";
						if (id.includes("motion")) return "motion";
						if (id.includes("streamdown") || id.includes("shiki") || id.includes("mermaid")) {
							return "markdown";
						}
						return "vendor";
					},
				},
			},
		},
	},
});
