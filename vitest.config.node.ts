import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/main/**/*.test.ts"],
		setupFiles: ["src/test/setup-node.ts"],
	},
});
