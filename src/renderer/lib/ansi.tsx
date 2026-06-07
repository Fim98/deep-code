/**
 * Minimal ANSI escape sequence parser that converts terminal output
 * to React elements with inline styles.
 *
 * Supports:
 * - SGR (Select Graphic Rendition) codes: bold, dim, italic, underline, colors
 * - 256-color mode (38;5;n / 48;5;n)
 * - True color mode (38;2;r;g;b / 48;2;r;g;b)
 * - Reset codes
 */

import * as React from "react";

// Standard 8 ANSI colors → CSS color values
const ANSI_COLORS = [
	"#1a1a2e", // 0 black
	"#e74c3c", // 1 red
	"#2ecc71", // 2 green
	"#f39c12", // 3 yellow
	"#3498db", // 4 blue
	"#9b59b6", // 5 magenta
	"#1abc9c", // 6 cyan
	"#ecf0f1", // 7 white
];

// Bright ANSI colors
const ANSI_BRIGHT_COLORS = [
	"#555555", // 0 bright black
	"#ff6b6b", // 1 bright red
	"#51cf66", // 2 bright green
	"#ffd43b", // 3 bright yellow
	"#74c0fc", // 4 bright blue
	"#cc5de8", // 5 bright magenta
	"#3bc9db", // 6 bright cyan
	"#ffffff", // 7 bright white
];

function color256(n: number): string {
	if (n < 8) return ANSI_COLORS[n];
	if (n < 16) return ANSI_BRIGHT_COLORS[n - 8];
	if (n < 232) {
		// 216 color cube
		const idx = n - 16;
		const r = Math.floor(idx / 36);
		const g = Math.floor((idx % 36) / 6);
		const b = idx % 6;
		const toVal = (v: number) => (v === 0 ? 0 : 55 + v * 40);
		return `rgb(${toVal(r)}, ${toVal(g)}, ${toVal(b)})`;
	}
	// Grayscale
	const gray = 8 + (n - 232) * 10;
	return `rgb(${gray}, ${gray}, ${gray})`;
}

type Style = React.CSSProperties;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseAnsi(text: string): React.ReactNode[] {
	const nodes: React.ReactNode[] = [];
	// Match ANSI escape sequences or plain text
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences use \x1b
	const regex = /\x1b\[([0-9;]*)m|([^\x1b]+)/g;
	let style: Style = {};
	let key = 0;

	for (const match of text.matchAll(regex)) {
		if (match[2]) {
			// Plain text
			nodes.push(
				Object.keys(style).length > 0 ? (
					<span key={key++} style={style}>
						{match[2]}
					</span>
				) : (
					match[2]
				),
			);
		} else if (match[1] !== undefined) {
			// SGR sequence
			const codes = match[1].split(";").map(Number);
			let i = 0;
			while (i < codes.length) {
				const code = codes[i];
				switch (code) {
					case 0: // Reset
						style = {};
						break;
					case 1: // Bold
						style.fontWeight = "bold";
						break;
					case 2: // Dim
						style.opacity = "0.7";
						break;
					case 3: // Italic
						style.fontStyle = "italic";
						break;
					case 4: // Underline
						style.textDecoration = "underline";
						break;
					case 22: // Normal intensity
						delete style.fontWeight;
						delete style.opacity;
						break;
					case 23: // Not italic
						delete style.fontStyle;
						break;
					case 24: // Not underline
						delete style.textDecoration;
						break;
					case 39: // Default foreground
						delete style.color;
						break;
					case 49: // Default background
						delete style.backgroundColor;
						break;
					default: {
						if (code >= 30 && code <= 37) {
							style.color = ANSI_COLORS[code - 30];
						} else if (code >= 40 && code <= 47) {
							style.backgroundColor = ANSI_COLORS[code - 40];
						} else if (code >= 90 && code <= 97) {
							style.color = ANSI_BRIGHT_COLORS[code - 90];
						} else if (code >= 100 && code <= 107) {
							style.backgroundColor = ANSI_BRIGHT_COLORS[code - 100];
						} else if (code === 38 && codes[i + 1] === 5) {
							// 256-color foreground
							style.color = color256(codes[i + 2]);
							i += 2;
						} else if (code === 48 && codes[i + 1] === 5) {
							// 256-color background
							style.backgroundColor = color256(codes[i + 2]);
							i += 2;
						} else if (code === 38 && codes[i + 1] === 2) {
							// True color foreground
							style.color = `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})`;
							i += 4;
						} else if (code === 48 && codes[i + 1] === 2) {
							// True color background
							style.backgroundColor = `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})`;
							i += 4;
						}
						break;
					}
				}
				i++;
			}
		}
	}

	return nodes;
}

export function AnsiText({ text }: { text: string }) {
	const hasAnsi = text.includes("\x1b[");
	if (!hasAnsi) return <>{text}</>;
	return <>{parseAnsi(text)}</>;
}
