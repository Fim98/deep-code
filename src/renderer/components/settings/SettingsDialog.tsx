import { useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Key, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { emitToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { pi, type ProviderEntry } from "@/lib/rpc";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: Props) {
	const [configured, setConfigured] = useState<ProviderEntry[]>([]);
	const [known, setKnown] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!open) return;
		void refresh();
	}, [open]);

	async function refresh() {
		setLoading(true);
		try {
			const [c, k] = await Promise.all([
				pi.auth.list(),
				pi.auth.knownProviders(),
			]);
			setConfigured(c);
			setKnown(k);
		} catch (e) {
			emitToast(`Failed to load providers: ${formatError(e)}`);
		} finally {
			setLoading(false);
		}
	}

	async function handleSave(provider: string, key: string) {
		try {
			await pi.auth.setKey(provider, key);
			await refresh();
		} catch (e) {
			emitToast(formatError(e));
			throw e;
		}
	}

	async function handleRemove(provider: string) {
		try {
			await pi.auth.remove(provider);
			await refresh();
		} catch (e) {
			emitToast(formatError(e));
		}
	}

	const configuredSet = useMemo(
		() => new Set(configured.map((c) => c.provider)),
		[configured],
	);
	const addableProviders = useMemo(
		() => known.filter((k) => !configuredSet.has(k)),
		[known, configuredSet],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
				<DialogHeader className="border-b border-border/40 px-6 py-4">
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>
						Configure provider API keys. Credentials live in{" "}
						<span className="font-mono">~/.pi/agent/auth.json</span>.
					</DialogDescription>
				</DialogHeader>
				<div className="px-6 pb-2 pt-4">
					<SectionHeader title="Providers" />
				</div>
				<ScrollArea className="max-h-[360px]">
					<div className="space-y-1 px-6 pb-4">
						{loading && configured.length === 0 ? (
							<EmptyHint text="Loading…" />
						) : configured.length === 0 ? (
							<EmptyHint text="No providers configured yet." />
						) : (
							configured.map((entry) => (
								<ConfiguredRow
									key={entry.provider}
									entry={entry}
									onReplace={(k) => handleSave(entry.provider, k)}
									onRemove={() => handleRemove(entry.provider)}
								/>
							))
						)}
					</div>
				</ScrollArea>
				<div className="border-t border-border/40 bg-foreground/[0.02] px-6 py-4">
					<SectionHeader title="Add provider" />
					<AddProviderForm
						addable={addableProviders}
						onAdd={async (provider, key) => {
							await handleSave(provider, key);
						}}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function SectionHeader({ title }: { title: string }) {
	return (
		<div className="mb-2 select-none text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
			{title}
		</div>
	);
}

function EmptyHint({ text }: { text: string }) {
	return (
		<div className="rounded-[14px] border border-dashed border-border/50 px-3 py-4 text-center text-[12px] text-muted-foreground">
			{text}
		</div>
	);
}

function ConfiguredRow({
	entry,
	onReplace,
	onRemove,
}: {
	entry: ProviderEntry;
	onReplace: (key: string) => Promise<void>;
	onRemove: () => Promise<void>;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const [reveal, setReveal] = useState(false);
	const [saving, setSaving] = useState(false);

	async function submit() {
		if (!draft.trim()) return;
		setSaving(true);
		try {
			await onReplace(draft.trim());
			setEditing(false);
			setDraft("");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="rounded-[14px] border border-border/40 bg-foreground/[0.02] px-3 py-2.5">
			<div className="flex items-center gap-2">
				<Key className="size-3.5 shrink-0 text-muted-foreground" />
				<div className="min-w-0 flex-1">
					<div className="truncate text-[13px] font-medium text-foreground">
						{entry.provider}
					</div>
					<div className="truncate font-mono text-[10.5px] text-muted-foreground">
						{entry.type === "oauth" ? "OAuth credential" : entry.maskedKey}
					</div>
				</div>
				<div className="flex items-center gap-1">
					{entry.type === "api_key" ? (
						<Button
							type="button"
							size="icon-sm"
							variant="ghost"
							onClick={() => setEditing((v) => !v)}
							aria-label={editing ? "Cancel" : "Replace key"}
						>
							{editing ? (
								<Check className="size-3.5" />
							) : (
								<Eye className="size-3.5" />
							)}
						</Button>
					) : null}
					<Button
						type="button"
						size="icon-sm"
						variant="ghost"
						onClick={onRemove}
						aria-label="Remove"
						className="hover:text-destructive"
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>
			</div>
			{editing ? (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void submit();
					}}
					className="mt-2 flex items-center gap-2"
				>
					<div className="flex flex-1 items-center gap-1.5">
						<Input
							autoFocus
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							type={reveal ? "text" : "password"}
							placeholder="New API key"
							className="flex-1 text-[12px] h-8"
						/>
						<Button
							type="button"
							size="icon-sm"
							variant="ghost"
							onClick={() => setReveal((v) => !v)}
							aria-label={reveal ? "Hide API key" : "Show API key"}
						>
							{reveal ? (
								<EyeOff className="size-3" />
							) : (
								<Eye className="size-3" />
							)}
						</Button>
					</div>
					<Button type="submit" size="sm" disabled={!draft.trim() || saving}>
						Save
					</Button>
				</form>
			) : null}
		</div>
	);
}

function AddProviderForm({
	addable,
	onAdd,
}: {
	addable: string[];
	onAdd: (provider: string, key: string) => Promise<void>;
}) {
	const [provider, setProvider] = useState<string>(addable[0] ?? "");
	const [custom, setCustom] = useState<string>("");
	const [useCustom, setUseCustom] = useState(false);
	const [key, setKey] = useState("");
	const [reveal, setReveal] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!useCustom && addable.length > 0 && !addable.includes(provider)) {
			setProvider(addable[0]);
		}
	}, [addable, provider, useCustom]);

	const effectiveProvider = useCustom ? custom.trim() : provider;

	async function submit() {
		if (!effectiveProvider || !key.trim()) return;
		setSaving(true);
		try {
			await onAdd(effectiveProvider, key.trim());
			setKey("");
			if (useCustom) setCustom("");
		} finally {
			setSaving(false);
		}
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
			className="space-y-2"
		>
			<div className="flex items-center gap-2">
				{useCustom || addable.length === 0 ? (
					<Input
						value={custom}
						onChange={(e) => setCustom(e.target.value)}
						placeholder="provider-id"
						className="flex-1 font-mono text-[12px] h-8"
					/>
				) : (
					<Select value={provider} onValueChange={setProvider}>
						<SelectTrigger className="flex-1 h-8 text-[12px]">
							<SelectValue placeholder="Select a provider" />
						</SelectTrigger>
						<SelectContent>
							{addable.map((p) => (
								<SelectItem key={p} value={p}>
									{p}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={() => setUseCustom((v) => !v)}
					className="h-8 px-2 text-[11px]"
				>
					{useCustom ? "From list" : "Custom"}
				</Button>
			</div>
			<div className="flex items-center gap-2">
				<div className="flex flex-1 items-center gap-1.5">
					<Input
						value={key}
						onChange={(e) => setKey(e.target.value)}
						type={reveal ? "text" : "password"}
						placeholder="API key"
						className="flex-1 text-[12px] h-8"
					/>
					<Button
						type="button"
						size="icon-sm"
						variant="ghost"
						onClick={() => setReveal((v) => !v)}
						aria-label={reveal ? "Hide API key" : "Show API key"}
					>
						{reveal ? (
							<EyeOff className="size-3" />
						) : (
							<Eye className="size-3" />
						)}
					</Button>
				</div>
				<Button
					type="submit"
					size="sm"
					disabled={!effectiveProvider || !key.trim() || saving}
					className={cn(saving && "opacity-60")}
				>
					<Plus className="size-3.5" />
					Save
				</Button>
			</div>
		</form>
	);
}

function formatError(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
