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
				xs: "10px",
				sm: "14px",
				md: "18px",
				lg: "24px",
				xl: "32px",
			},
			fontFamily: {
				sans: [
					"Inter",
					"SF Pro Display",
					"SF Pro Text",
					"-apple-system",
					"BlinkMacSystemFont",
					"Helvetica Neue",
					"system-ui",
					"sans-serif",
				],
			},
		},
	},
	plugins: [],
} satisfies Config;
