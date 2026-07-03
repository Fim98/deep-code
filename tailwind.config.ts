import type { Config } from "tailwindcss";

export default {
	darkMode: ["class", '[data-theme="dark"]'],
	content: ["./src/renderer/**/*.{ts,tsx,html}"],
	theme: {
		extend: {
			colors: {
				border: "var(--border)",
				input: "var(--input)",
				ring: "var(--ring)",
				background: "var(--background)",
				foreground: "var(--foreground)",
				primary: {
					DEFAULT: "var(--primary)",
					foreground: "var(--primary-foreground)",
					hover: "var(--primary-hover)",
					soft: "var(--primary-soft)",
				},
				secondary: {
					DEFAULT: "var(--secondary)",
					foreground: "var(--secondary-foreground)",
				},
				muted: {
					DEFAULT: "var(--muted)",
					foreground: "var(--muted-foreground)",
				},
				accent: {
					DEFAULT: "var(--accent)",
					foreground: "var(--accent-foreground)",
				},
				destructive: {
					DEFAULT: "var(--destructive)",
					foreground: "var(--destructive-foreground)",
				},
				success: {
					DEFAULT: "var(--success)",
					foreground: "var(--success-foreground)",
				},
				warning: {
					DEFAULT: "var(--warning)",
				},
				card: {
					DEFAULT: "var(--card)",
					foreground: "var(--card-foreground)",
				},
				popover: {
					DEFAULT: "var(--popover)",
					foreground: "var(--popover-foreground)",
				},
				sidebar: {
					DEFAULT: "var(--sidebar)",
					foreground: "var(--sidebar-foreground)",
				},
			},
			borderRadius: {
				xs: "6px",
				sm: "8px",
				md: "12px",
				lg: "16px",
				xl: "20px",
			},
			fontFamily: {
				sans: [
					"Inter",
					"Söhne",
					"-apple-system",
					"BlinkMacSystemFont",
					"Helvetica Neue",
					"Segoe UI",
					"system-ui",
					"sans-serif",
				],
				mono: [
					"ui-monospace",
					"SF Mono",
					"Söhne Mono",
					"JetBrains Mono",
					"Fira Code",
					"Menlo",
					"Consolas",
					"monospace",
				],
			},
		},
	},
	plugins: [],
} satisfies Config;
