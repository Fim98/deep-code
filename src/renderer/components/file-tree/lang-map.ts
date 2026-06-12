import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { SQLite, sql } from "@codemirror/lang-sql";
import { vue } from "@codemirror/lang-vue";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { LanguageSupport, StreamLanguage } from "@codemirror/language";
import { csharp, dart, kotlin } from "@codemirror/legacy-modes/mode/clike";
import { cmake } from "@codemirror/legacy-modes/mode/cmake";
import { diff } from "@codemirror/legacy-modes/mode/diff";
// Legacy modes (no dedicated @codemirror/lang-* package)
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { protobuf } from "@codemirror/legacy-modes/mode/protobuf";
import { r } from "@codemirror/legacy-modes/mode/r";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import type { Extension } from "@codemirror/state";

/**
 * Map file extensions to CodeMirror LanguageSupport.
 * Returns null for extensions without a dedicated language package;
 * the editor will fall back to plain text highlighting.
 */
export function getLangSupport(ext: string, fileName: string): LanguageSupport | Extension | null {
	const lower = ext.toLowerCase();
	const lowerName = fileName.toLowerCase();

	// Special filenames
	if (lowerName === "dockerfile") return StreamLanguage.define(dockerFile);
	if (lowerName === ".gitignore" || lowerName.startsWith(".env"))
		return StreamLanguage.define(properties);

	switch (lower) {
		case "ts":
		case "mts":
		case "cts":
		case "tsx":
			return javascript({ typescript: true });
		case "js":
		case "mjs":
		case "cjs":
		case "jsx":
			return javascript();
		case "json":
		case "jsonc":
			return json();
		case "css":
			return css();
		case "scss":
			return css();
		case "less":
			return css();
		case "html":
		case "htm":
			return html();
		case "xml":
			return xml();
		case "svg":
			return xml();
		case "yaml":
		case "yml":
			return yaml();
		case "toml":
			return StreamLanguage.define(toml);
		case "sql":
			return sql({ dialect: SQLite });
		case "sh":
		case "bash":
		case "zsh":
		case "fish":
			return StreamLanguage.define(shell);
		case "py":
			return python();
		case "rb":
			return StreamLanguage.define(ruby);
		case "go":
			return go();
		case "rs":
			return rust();
		case "java":
			return java();
		case "c":
		case "h":
			return cpp();
		case "cpp":
		case "cc":
		case "hpp":
		case "cxx":
			return cpp();
		case "cs":
			return StreamLanguage.define(csharp);
		case "swift":
			return StreamLanguage.define(swift);
		case "kt":
		case "kts":
			return StreamLanguage.define(kotlin);
		case "lua":
			return StreamLanguage.define(lua);
		case "r":
			return StreamLanguage.define(r);
		case "php":
			return php();
		case "vue":
			return vue();
		case "md":
		case "mdx":
			return markdown();
		case "diff":
		case "patch":
			return StreamLanguage.define(diff);
		case "ini":
		case "cfg":
		case "conf":
			return StreamLanguage.define(properties);
		case "proto":
		case "protobuf":
			return StreamLanguage.define(protobuf);
		case "graphql":
		case "gql":
			return null; // No legacy mode available, falls back to plain text
		case "tex":
		case "latex":
			return StreamLanguage.define(stex);
		case "svelte":
			return html();
		case "astro":
			return html();
		case "tf":
			return null; // No HCL mode available, falls back to plain text
		case "dart":
			return StreamLanguage.define(dart);
		case "perl":
		case "pl":
			return StreamLanguage.define(perl);
		case "ps1":
			return StreamLanguage.define(powerShell);
		case "cmake":
			return StreamLanguage.define(cmake);
		default:
			return null;
	}
}

/** Whether a file should render SVG content inline. */
export function shouldRenderSvgInline(ext: string): boolean {
	return ext.toLowerCase() === "svg";
}

/** Whether a file should use markdown native rendering. */
export function shouldUseMarkdown(ext: string): boolean {
	return ["md", "mdx"].includes(ext.toLowerCase());
}

/** Whether a file should use CSV table rendering. */
export function shouldUseCsvTable(ext: string): boolean {
	return ["csv", "tsv"].includes(ext.toLowerCase());
}

/** Whether a file should use the native media player. */
export function shouldUseMediaPlayer(ext: string): boolean {
	const lower = ext.toLowerCase();
	return (
		["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(lower) ||
		["mp4", "mov", "webm", "avi", "mkv", "m4v"].includes(lower)
	);
}

/** Whether a file should use enhanced image preview with zoom. */
export function shouldUseImagePreview(ext: string): boolean {
	return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif", "tiff", "tif"].includes(
		ext.toLowerCase(),
	);
}
