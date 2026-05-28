import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(__dirname, "src/renderer"),
		},
	},
	plugins: [react()],
	test: {
		globals: true,
		environment: "jsdom",
		include: ["src/renderer/**/*.test.{ts,tsx}"],
		setupFiles: ["src/test/setup-web.ts"],
		css: false,
	},
});
