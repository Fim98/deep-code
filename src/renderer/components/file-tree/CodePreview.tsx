import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useCmTheme } from "./codemirror-theme";
import { getLangSupport } from "./lang-map";

interface Props {
	content: string;
	ext: string;
	fileName: string;
	className?: string;
}

/** Auto-format JSON/JSONC content with 2-space indentation if it's minified */
function formatJsonIfNeeded(content: string, ext: string): string {
	const lower = ext.toLowerCase();
	if (lower !== "json" && lower !== "jsonc") return content;

	try {
		const parsed = JSON.parse(content);
		// If the formatted version is longer (i.e. it was minified), use formatted
		const formatted = JSON.stringify(parsed, null, 2);
		return formatted;
	} catch {
		// If parse fails, return original content
		return content;
	}
}

export function CodePreview({ content, ext, fileName, className }: Props) {
	const cmTheme = useCmTheme();
	const langSupport = useMemo(() => getLangSupport(ext, fileName), [ext, fileName]);

	const displayContent = useMemo(() => formatJsonIfNeeded(content, ext), [content, ext]);

	const extensions = useMemo(() => {
		const exts: Extension[] = [EditorView.lineWrapping];
		if (langSupport) exts.push(langSupport);
		return exts;
	}, [langSupport]);

	const handleCreateEditor = useCallback((view: EditorView) => {
		// Set initial scroll position to top
		view.scrollDOM.scrollTop = 0;
		return view;
	}, []);

	return (
		<CodeMirror
			value={displayContent}
			theme={cmTheme}
			extensions={extensions}
			readOnly={true}
			editable={false}
			basicSetup={{
				lineNumbers: true,
				foldGutter: true,
				highlightActiveLine: true,
				highlightActiveLineGutter: true,
				// Disable editing features
				history: false,
				autocompletion: false,
				closeBrackets: false,
				indentOnInput: false,
				bracketMatching: true,
			}}
			className={cn("pi-code-preview", className)}
			onCreateEditor={handleCreateEditor}
		/>
	);
}
