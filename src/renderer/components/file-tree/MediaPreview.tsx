import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
	filePath: string;
	ext: string;
	onOpenExternal: () => void;
	className?: string;
}

/** Audio extensions */
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac", "wma"]);

export function MediaPreview({ filePath, ext, onOpenExternal, className }: Props) {
	const [error, setError] = useState(false);
	const isAudio = AUDIO_EXTS.has(ext.toLowerCase());
	const src = useMemo(() => `file://${filePath}`, [filePath]);

	if (error) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
				<div className="text-[13px] font-medium text-foreground">Cannot play media file</div>
				<Button size="sm" variant="secondary" onClick={onOpenExternal} className="rounded-full">
					<ExternalLink className="size-3.5" />
					Open externally
				</Button>
			</div>
		);
	}

	if (isAudio) {
		return (
			<div className={`flex h-full items-center justify-center p-8 ${className ?? ""}`}>
				<div className="flex flex-col items-center gap-6 rounded-[18px] bg-card p-8 shadow-[var(--shadow-sm)]">
					<div className="flex size-16 items-center justify-center rounded-full bg-primary-soft">
						<svg
							className="size-8 text-primary"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							role="img"
							aria-label="Audio"
						>
							<path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
							<circle cx="6" cy="18" r="3" />
							<circle cx="18" cy="16" r="3" />
						</svg>
					</div>
					<audio
						src={src}
						controls
						className="w-full max-w-[320px] rounded-[14px]"
						onError={() => setError(true)}
					/>
				</div>
			</div>
		);
	}

	// Video
	return (
		<div className={`flex h-full items-center justify-center p-6 ${className ?? ""}`}>
			<video
				src={src}
				controls
				className="max-h-full max-w-full rounded-[18px] shadow-[var(--shadow-sm)]"
				onError={() => setError(true)}
			/>
		</div>
	);
}
