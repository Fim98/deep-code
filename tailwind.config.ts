import type { Config } from "tailwindcss";

export default {
	darkMode: ["class", '[data-theme="dark"]'],
	content: ["./src/renderer/**/*.{ts,tsx,html}"],
	theme: {
		extend: {
			colors: {
				border: "var(--border)",
				input: "var(--field-background)",
				ring: "var(--focus)",
				background: "var(--background)",
				foreground: "var(--foreground)",
				primary: {
					DEFAULT: "var(--accent)",
					foreground: "var(--accent-foreground)",
				},
				secondary: {
					DEFAULT: "var(--default)",
					foreground: "var(--default-foreground)",
				},
				muted: {
					DEFAULT: "var(--surface-secondary)",
					foreground: "var(--muted)",
				},
				accent: {
					DEFAULT: "var(--accent-soft)",
					foreground: "var(--accent-soft-foreground)",
				},
				destructive: {
					DEFAULT: "var(--danger)",
					foreground: "var(--danger-foreground)",
				},
				card: {
					DEFAULT: "var(--surface)",
					foreground: "var(--surface-foreground)",
				},
				popover: {
					DEFAULT: "var(--overlay)",
					foreground: "var(--overlay-foreground)",
				},
				sidebar: {
					DEFAULT: "var(--background)",
					foreground: "var(--foreground)",
				},
			},
			borderRadius: {
				lg: "calc(var(--radius) * 1.5)",
				md: "var(--radius)",
				sm: "calc(var(--radius) * 0.75)",
			},
			fontFamily: {
				sans: [
					"-apple-system",
					"BlinkMacSystemFont",
					"\"SF Pro Display\"",
					"\"SF Pro Text\"",
					"\"Helvetica Neue\"",
					"sans-serif",
				],
			},
		},
	},
	plugins: [],
} satisfies Config;
