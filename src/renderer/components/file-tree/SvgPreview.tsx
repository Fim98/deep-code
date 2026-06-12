import DOMPurify from "dompurify";
import { ExternalLink, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
	content: string;
	filePath: string;
	onOpenExternal: () => void;
	className?: string;
}

export function SvgPreview({ content, filePath, onOpenExternal, className }: Props) {
	const [error, setError] = useState(false);
	const [scale, setScale] = useState(1);

	const sanitizedSvg = useMemo(() => {
		if (error) return null;
		try {
			// DOMPurify strips dangerous SVG elements (script, event handlers, etc.)
			const clean = DOMPurify.sanitize(content, {
				USE_PROFILES: { svg: true, svgFilters: true },
				ADD_TAGS: ["use"],
			});

			// Add style to make SVG responsive
			return clean.replace(
				/<svg /,
				'<svg style="max-width: 100%; max-height: 100%; display: block;" ',
			);
		} catch {
			setError(true);
			return null;
		}
	}, [content, error]);

	if (error || !sanitizedSvg) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
				<div className="flex size-12 items-center justify-center rounded-[16px] bg-foreground/[0.04]">
					<ExternalLink className="size-5 text-muted-foreground/40" />
				</div>
				<div>
					<div className="text-[13px] font-medium text-foreground">Cannot preview SVG</div>
					<div className="mt-1 text-[12px] text-muted-foreground">
						The file may contain unsafe elements
					</div>
				</div>
				<Button size="sm" variant="secondary" onClick={onOpenExternal} className="rounded-full">
					<ExternalLink className="size-3.5" />
					Open externally
				</Button>
			</div>
		);
	}

	return (
		<ScrollArea className={className}>
			<div className="flex h-full flex-col items-center">
				{/* Zoom controls */}
				<div className="flex shrink-0 items-center gap-1 px-4 py-2">
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
						title="Zoom out"
						className="size-7"
					>
						<ZoomOut className="size-3" />
					</Button>
					<span className="text-[12px] text-muted-foreground tabular-nums">
						{Math.round(scale * 100)}%
					</span>
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={() => setScale((s) => Math.min(4, s + 0.25))}
						title="Zoom in"
						className="size-7"
					>
						<ZoomIn className="size-3" />
					</Button>
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={() => setScale(1)}
						title="Reset zoom"
						className="size-7"
					>
						<RotateCcw className="size-3" />
					</Button>
				</div>
				{/* SVG content */}
				<div
					className="flex-1 flex items-center justify-center p-6"
					style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
					dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
				/>
			</div>
		</ScrollArea>
	);
}
