import { ExternalLink, Eye, EyeOff, Key, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { type ProviderEntry, pi } from "@/lib/rpc";
import { emitToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const MODELS_DOCS_URL = "https://pi.dev/docs/latest/models";
const AUTH_CONFIG_PATH = "~/.pi/agent/auth.json";

const oauthProviderIds = new Set(["anthropic", "openai-codex", "github-copilot"]);

const providerHints: Record<string, { label: string; hint: string; env?: string }> = {
	anthropic: {
		label: "Anthropic",
		hint: "Claude models. Supports /login for Claude Pro/Max or API key auth.",
		env: "ANTHROPIC_API_KEY",
	},
	openai: {
		label: "OpenAI",
		hint: "GPT models through OpenAI APIs.",
		env: "OPENAI_API_KEY",
	},
	google: {
		label: "Google Gemini",
		hint: "Gemini via Google Generative AI.",
		env: "GEMINI_API_KEY",
	},
	"openai-codex": {
		label: "OpenAI Codex",
		hint: "ChatGPT Plus/Pro subscription provider. Use /login.",
	},
	openrouter: {
		label: "OpenRouter",
		hint: "One key for many hosted model routes.",
		env: "OPENROUTER_API_KEY",
	},
	"vercel-ai-gateway": {
		label: "Vercel AI Gateway",
		hint: "Gateway routing for supported model providers.",
		env: "AI_GATEWAY_API_KEY",
	},
	deepseek: {
		label: "DeepSeek",
		hint: "DeepSeek hosted models.",
		env: "DEEPSEEK_API_KEY",
	},
	"github-copilot": {
		label: "GitHub Copilot",
		hint: "Copilot subscription provider. Use /login.",
	},
	moonshotai: {
		label: "Moonshot AI",
		hint: "Kimi models through Moonshot.",
		env: "MOONSHOT_API_KEY",
	},
	"moonshotai-cn": {
		label: "Moonshot AI CN",
		hint: "Kimi models in the China region.",
		env: "MOONSHOT_API_KEY",
	},
};

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
			const [c, k] = await Promise.all([pi.auth.list(), pi.auth.knownProviders()]);
			setConfigured(c);
			setKnown(k);
		} catch (e) {
			emitToast(`Failed to load providers: ${formatError(e)}`);
		} finally {
			setLoading(false);
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

	async function handleSave(provider: string, key: string) {
		try {
			await pi.auth.setKey(provider, key);
			await refresh();
		} catch (e) {
			emitToast(formatError(e));
			throw e;
		}
	}

	const configuredSet = useMemo(() => new Set(configured.map((c) => c.provider)), [configured]);
	const availableProviders = useMemo(
		() => known.filter((provider) => !configuredSet.has(provider)),
		[known, configuredSet],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[84vh] max-w-2xl gap-0 overflow-hidden p-0">
				<DialogHeader className="border-b border-border/40 px-7 py-6">
					<div className="flex items-start gap-4">
						<div className="flex size-11 shrink-0 items-center justify-center rounded-[18px] bg-primary-soft text-primary">
							<Key className="size-5" />
						</div>
						<div className="min-w-0">
							<DialogTitle className="text-[24px] font-medium tracking-tight">
								Provider Settings
							</DialogTitle>
							<DialogDescription className="mt-2 max-w-2xl text-[13px] leading-6">
								Configured credentials from <span className="font-mono">/login</span> appear here.
								Custom providers and models are configured separately.
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>
				<ScrollArea className="max-h-[calc(84vh-125px)]">
					<div className="space-y-5 px-7 py-6">
						<section className="space-y-4">
							<SettingsSectionHeader
								title="Configured Providers"
								description={`Credentials are stored in ${AUTH_CONFIG_PATH}. Use /login to add supported providers.`}
							/>
							<div className="grid gap-3">
								{loading && configured.length === 0 ? (
									<EmptyHint text="Loading providers..." />
								) : configured.length === 0 ? (
									<EmptyHint text="No credentials configured yet." />
								) : (
									configured.map((entry) => (
										<ConfiguredRow
											key={entry.provider}
											entry={entry}
											onRemove={() => handleRemove(entry.provider)}
										/>
									))
								)}
							</div>
						</section>
						<PresetProviderForm providers={availableProviders} onSave={handleSave} />
						<CustomModelsHint />
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}

function SettingsSectionHeader({ title, description }: { title: string; description: string }) {
	return (
		<div className="space-y-1">
			<div className="select-none text-[11px] font-medium uppercase tracking-[0.14em] text-primary/70">
				{title}
			</div>
			<p className="text-[13px] leading-6 text-muted-foreground">{description}</p>
		</div>
	);
}

function EmptyHint({ text }: { text: string }) {
	return (
		<div className="rounded-[24px] border border-dashed border-border/60 bg-card/60 px-5 py-6 text-center text-[13px] text-muted-foreground">
			{text}
		</div>
	);
}

function ConfiguredRow({
	entry,
	onRemove,
}: {
	entry: ProviderEntry;
	onRemove: () => Promise<void>;
}) {
	return (
		<div className="rounded-[24px] border border-border/60 bg-card px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
			<div className="flex items-center gap-4">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-[16px] bg-foreground/[0.04] text-muted-foreground">
					{entry.type === "oauth" ? <ShieldCheck className="size-4" /> : <Key className="size-4" />}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-2">
						<div className="truncate text-[15px] font-medium text-foreground">
							{providerLabel(entry.provider)}
						</div>
						<Badge variant={entry.type === "oauth" ? "success" : "primary"}>
							{entry.type === "oauth" ? "OAuth" : "API key"}
						</Badge>
					</div>
					<div className="mt-1 truncate text-[12px] text-muted-foreground">
						<span className="font-mono">{entry.provider}</span>
						<span className="px-1.5 text-muted-foreground/50">·</span>
						{entry.type === "oauth" ? "Managed by /login" : entry.maskedKey}
					</div>
				</div>
				<div className="flex items-center gap-1">
					<Button
						type="button"
						size="icon-sm"
						variant="ghost"
						onClick={onRemove}
						aria-label="Remove"
						className="size-8 rounded-[14px] hover:text-destructive"
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>
			</div>
		</div>
	);
}

function PresetProviderForm({
	providers,
	onSave,
}: {
	providers: string[];
	onSave: (provider: string, key: string) => Promise<void>;
}) {
	const [provider, setProvider] = useState(providers[0] ?? "");
	const [key, setKey] = useState("");
	const [reveal, setReveal] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (providers.length === 0) {
			setProvider("");
			return;
		}
		if (!providers.includes(provider)) setProvider(providers[0]);
	}, [provider, providers]);

	const hint = providerHints[provider];
	const supportsOAuth = oauthProviderIds.has(provider);

	async function submit() {
		if (!provider || !key.trim()) return;
		setSaving(true);
		try {
			await onSave(provider, key.trim());
			setKey("");
		} finally {
			setSaving(false);
		}
	}

	return (
		<section className="space-y-4">
			<SettingsSectionHeader
				title="Add Provider"
				description="Choose a preset provider. Use /login in chat for OAuth providers, or store an API key here."
			/>
			<div className="rounded-[24px] border border-border/60 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
				{providers.length === 0 ? (
					<div className="text-[13px] leading-6 text-muted-foreground">
						All preset providers are already configured.
					</div>
				) : (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void submit();
						}}
						className="space-y-4"
					>
						<div className="grid gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
							<div className="space-y-1.5">
								<div className="px-1 text-[11px] font-medium text-muted-foreground">Provider</div>
								<Select value={provider} onValueChange={setProvider}>
									<SelectTrigger className="text-[13px]">
										<SelectValue placeholder="Select provider" />
									</SelectTrigger>
									<SelectContent>
										{providers.map((item) => (
											<SelectItem key={item} value={item}>
												{providerLabel(item)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5">
								<label
									htmlFor="provider-api-key"
									className="px-1 text-[11px] font-medium text-muted-foreground"
								>
									API key or env name
								</label>
								<div className="flex items-center gap-2">
									<Input
										id="provider-api-key"
										value={key}
										onChange={(e) => setKey(e.target.value)}
										type={reveal ? "text" : "password"}
										placeholder={hint?.env ?? "API key or ENV_VAR_NAME"}
										className="text-[13px]"
									/>
									<Button
										type="button"
										size="icon"
										variant="ghost"
										onClick={() => setReveal((value) => !value)}
										aria-label={reveal ? "Hide API key" : "Show API key"}
									>
										{reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
									</Button>
								</div>
							</div>
						</div>
						<div
							className={cn(
								"rounded-[18px] px-4 py-3 text-[12px] leading-5",
								supportsOAuth
									? "bg-primary-soft text-primary"
									: "bg-foreground/[0.025] text-muted-foreground",
							)}
						>
							<span className="font-medium text-foreground">{providerLabel(provider)}.</span>{" "}
							{hint?.hint ?? "Preset provider."}
							{supportsOAuth ? (
								<>
									{" "}
									For OAuth, send <span className="font-mono">/login</span> in chat and select this
									provider.
								</>
							) : null}
						</div>
						<div className="flex justify-end">
							<Button
								type="submit"
								size="md"
								disabled={!provider || !key.trim() || saving}
								className={cn("rounded-[18px]", saving && "opacity-60")}
							>
								<Plus className="size-4" />
								Save API key
							</Button>
						</div>
					</form>
				)}
			</div>
		</section>
	);
}

function CustomModelsHint() {
	return (
		<div className="flex items-center justify-between gap-4 rounded-[24px] border border-border/60 bg-card px-5 py-4 text-[13px] leading-6 text-muted-foreground shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
			<div className="min-w-0">
				Custom providers, local models, and proxies use{" "}
				<span className="font-mono text-foreground/80">models.json</span>. See the Pi models
				documentation for setup details.
			</div>
			<Button
				type="button"
				variant="secondary"
				size="sm"
				className="shrink-0 rounded-full"
				onClick={() => window.open(MODELS_DOCS_URL, "_blank")}
			>
				<ExternalLink className="size-3.5" />
				Docs
			</Button>
		</div>
	);
}

function providerLabel(provider: string): string {
	return providerHints[provider]?.label ?? provider;
}

function formatError(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
