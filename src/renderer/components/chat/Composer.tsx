import { Code, ImagePlus, Send, Square, X } from "lucide-react";
import {
	type ClipboardEvent,
	type DragEvent,
	type KeyboardEvent,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	PromptInput,
	PromptInputBody,
	PromptInputFooter,
	type PromptInputMessage,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { pi } from "@/lib/rpc";
import { cn } from "@/lib/utils";
import { useSessions } from "@/stores/session-state";

interface ImageContent {
	type: "image";
	data: string;
	mimeType: string;
}

interface Attachment {
	id: string;
	file: File;
	preview: string; // data URL for thumbnail
}

interface SlashCommand {
	name: string;
	description?: string;
	source: string;
}

interface Props {
	sessionId: string;
	isStreaming: boolean;
}

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function isImageFile(file: File): boolean {
	return ACCEPTED_IMAGE_TYPES.includes(file.type);
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

function dataUrlToBase64(dataUrl: string): string {
	return dataUrl.split(",")[1] ?? "";
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function Composer({ sessionId, isStreaming }: Props) {
	const { t } = useI18n();
	const [text, setText] = useState("");
	const [attachments, setAttachments] = useState<Attachment[]>([]);
	const [dragOver, setDragOver] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null) as RefObject<HTMLInputElement>;
	const [commands, setCommands] = useState<SlashCommand[]>([]);
	const [slashIndex, setSlashIndex] = useState(0);
	const [slashOpen, setSlashOpen] = useState(false);
	const slashRef = useRef<HTMLDivElement>(null);
	const addPendingSubmission = useSessions((s) => s.addPendingSubmission);
	const removePendingSubmission = useSessions((s) => s.removePendingSubmission);

	// Fetch available commands when session changes
	useEffect(() => {
		pi.rpc.send(sessionId, { type: "get_commands" }).then((r) => {
			if (r.success && r.command === "get_commands") {
				setCommands(r.data.commands as SlashCommand[]);
			}
		});
	}, [sessionId]);

	// Determine slash query: text must start with "/" and cursor must be in the first token
	const slashQuery = useMemo(() => {
		if (!text.startsWith("/")) return null;
		const spaceIdx = text.indexOf(" ");
		if (spaceIdx !== -1) return null; // already typed a space → not a slash command
		return text.slice(1); // everything after the "/"
	}, [text]);

	const filteredCommands = useMemo(() => {
		if (slashQuery === null) return [];
		const q = slashQuery.toLowerCase();
		if (!q) return commands.slice(0, 12);
		return commands
			.filter((c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q))
			.slice(0, 12);
	}, [slashQuery, commands]);

	useEffect(() => {
		setSlashOpen(filteredCommands.length > 0);
		setSlashIndex(0);
	}, [filteredCommands.length]);

	const selectSlashCommand = useCallback((cmd: SlashCommand) => {
		setText(`/${cmd.name} `);
		setSlashOpen(false);
	}, []);

	const addFiles = useCallback(async (files: FileList | File[]) => {
		const newAttachments: Attachment[] = [];
		for (const file of Array.from(files)) {
			if (!isImageFile(file)) continue;
			if (file.size > MAX_FILE_SIZE) continue;
			const preview = await fileToDataUrl(file);
			newAttachments.push({
				id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
				file,
				preview,
			});
		}
		if (newAttachments.length > 0) {
			setAttachments((prev) => [...prev, ...newAttachments]);
		}
	}, []);

	const removeAttachment = useCallback((id: string) => {
		setAttachments((prev) => prev.filter((a) => a.id !== id));
	}, []);

	async function submit(message?: PromptInputMessage) {
		const content = (message?.text ?? text).trim();

		// If streaming and no content and no attachments, abort
		if (!content && attachments.length === 0) {
			if (isStreaming) {
				await pi.rpc.send(sessionId, { type: "abort" });
			}
			return;
		}

		// Build images array from attachments
		let images: ImageContent[] | undefined;
		if (attachments.length > 0) {
			images = await Promise.all(
				attachments.map(async (att) => {
					const dataUrl = await fileToDataUrl(att.file);
					return {
						type: "image" as const,
						data: dataUrlToBase64(dataUrl),
						mimeType: att.file.type,
					};
				}),
			);
		}

		const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const kind = isStreaming ? "steer" : "prompt";
		addPendingSubmission(sessionId, { id: pendingId, content, kind });
		setText("");
		setAttachments([]);

		try {
			const cmd: Record<string, unknown> = {
				type: isStreaming ? "steer" : "prompt",
				message: content,
			};
			if (images) cmd.images = images;
			const response = await pi.rpc.send(sessionId, cmd as any);
			if (!response.success) removePendingSubmission(sessionId, pendingId);
		} catch (error) {
			removePendingSubmission(sessionId, pendingId);
			throw error;
		}
	}

	function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		const nativeEvent = e.nativeEvent;
		if (nativeEvent.isComposing || nativeEvent.keyCode === 229) return;

		// Slash command navigation
		if (slashOpen) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSlashIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setSlashIndex((i) => Math.max(i - 1, 0));
				return;
			}
			if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault();
				const cmd = filteredCommands[slashIndex];
				if (cmd) selectSlashCommand(cmd);
				return;
			}
			if (e.key === "Escape") {
				e.preventDefault();
				setSlashOpen(false);
				return;
			}
		}

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void submit();
		}
	}

	function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
		const items = e.clipboardData?.items;
		if (!items) return;
		const imageFiles: File[] = [];
		for (const item of Array.from(items)) {
			if (item.type.startsWith("image/")) {
				const file = item.getAsFile();
				if (file) imageFiles.push(file);
			}
		}
		if (imageFiles.length > 0) {
			e.preventDefault();
			void addFiles(imageFiles);
		}
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		setDragOver(true);
	}

	function onDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		setDragOver(false);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		setDragOver(false);
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			void addFiles(files);
		}
	}

	const hasAttachments = attachments.length > 0;

	return (
		<div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} className="relative">
			{/* Drag overlay */}
			{dragOver && (
				<div className="absolute inset-0 z-10 flex items-center justify-center rounded-[32px] border-2 border-dashed border-primary/50 bg-primary/5 backdrop-blur-sm">
					<div className="flex flex-col items-center gap-2 text-primary">
						<ImagePlus className="size-6" />
						<span className="text-[13px] font-medium">{t("composer.dropImages")}</span>
					</div>
				</div>
			)}

			{/* Slash command popup */}
			{slashOpen && (
				<div
					ref={slashRef}
					className="absolute bottom-full left-4 right-4 z-20 mb-2 max-h-[280px] overflow-y-auto rounded-[18px] border border-border/60 bg-card shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
				>
					<div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
						{t("composer.slashCommands")}
					</div>
					{filteredCommands.map((cmd, idx) => (
						<button
							key={cmd.name}
							type="button"
							onMouseDown={(e) => {
								e.preventDefault();
								selectSlashCommand(cmd);
							}}
							onMouseEnter={() => setSlashIndex(idx)}
							className={cn(
								"flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75",
								idx === slashIndex
									? "bg-foreground/[0.05] text-foreground"
									: "text-foreground/70 hover:bg-foreground/[0.03]",
							)}
						>
							<Code className="size-3.5 shrink-0 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<div className="truncate text-[13px] font-medium">
									<span className="text-primary">/</span>
									{cmd.name}
								</div>
								{cmd.description ? (
									<div className="truncate text-[11px] text-muted-foreground">
										{cmd.description}
									</div>
								) : null}
							</div>
							<span className="shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
								{cmd.source}
							</span>
						</button>
					))}
					<div className="border-t border-border/40 px-4 py-1.5 text-[10px] text-muted-foreground/50">
						{t("composer.slashHint")}
					</div>
				</div>
			)}

			<PromptInput onSubmit={(message) => void submit(message)}>
				{/* Attachment chips */}
				{hasAttachments && (
					<div className="flex flex-wrap gap-2 px-3 pt-2">
						{attachments.map((att) => (
							<div
								key={att.id}
								className="group/att relative flex items-center gap-2 rounded-[14px] border border-border/60 bg-card px-2 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
							>
								<img
									src={att.preview}
									alt={att.file.name}
									className="size-10 rounded-[8px] object-cover"
								/>
								<div className="min-w-0 max-w-[120px]">
									<div className="truncate text-[11px] font-medium text-foreground/80">
										{att.file.name}
									</div>
									<div className="text-[10px] text-muted-foreground">
										{formatFileSize(att.file.size)}
									</div>
								</div>
								<button
									type="button"
									onClick={() => removeAttachment(att.id)}
									className={cn(
										"flex size-5 shrink-0 items-center justify-center rounded-full",
										"text-muted-foreground/60 transition-colors",
										"hover:bg-foreground/[0.08] hover:text-destructive",
									)}
									aria-label={t("composer.removeAttachment")}
								>
									<X className="size-3" />
								</button>
							</div>
						))}
					</div>
				)}

				<PromptInputBody>
					<PromptInputTextarea
						aria-label="Message"
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={onKeyDown}
						onPaste={onPaste}
						placeholder={isStreaming ? t("composer.steerPlaceholder") : t("composer.placeholder")}
					/>
				</PromptInputBody>
				<PromptInputFooter>
					<div className="flex items-center gap-2">
						{/* Attach image button */}
						<Button
							type="button"
							size="icon-sm"
							variant="ghost"
							onClick={() => fileInputRef.current?.click()}
							aria-label={t("composer.attachImage")}
							className="size-8 rounded-[12px] text-muted-foreground"
						>
							<ImagePlus className="size-3.5" />
						</Button>
						<input
							ref={fileInputRef}
							type="file"
							accept={ACCEPTED_IMAGE_TYPES.join(",")}
							multiple
							className="hidden"
							onChange={(e) => {
								if (e.target.files) {
									void addFiles(e.target.files);
									e.target.value = "";
								}
							}}
						/>
					</div>
					<div className="flex-1 text-[11px] text-muted-foreground">
						{isStreaming ? t("composer.steerHint") : t("composer.sendHint")}
					</div>
					<PromptInputTools className="flex-none">
						<PromptInputSubmit
							size="sm"
							variant={
								isStreaming && !text.trim() && !hasAttachments ? "destructive-soft" : "primary"
							}
							disabled={!text.trim() && !isStreaming && !hasAttachments}
							status={isStreaming ? "streaming" : "ready"}
						>
							{isStreaming && !text.trim() ? (
								<Square className="size-3.5" />
							) : (
								<Send className="size-3.5" />
							)}
							{isStreaming && !text.trim()
								? t("composer.abort")
								: isStreaming
									? t("composer.steer")
									: t("composer.send")}
						</PromptInputSubmit>
					</PromptInputTools>
				</PromptInputFooter>
			</PromptInput>
		</div>
	);
}
