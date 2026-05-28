import {
	Cog,
	ExternalLink,
	Eye,
	EyeOff,
	FileText,
	FolderOpen,
	Info,
	Key,
	LayoutGrid,
	Monitor,
	Moon,
	Plus,
	ShieldCheck,
	Sun,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LogViewerDialog } from "@/components/log-viewer/LogViewerDialog";
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
import { LOCALE_LABELS, LOCALES, useI18n } from "@/lib/i18n";
import { type DesktopSettings, type ProviderEntry, pi } from "@/lib/rpc";
import { emitToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ACCENT_PRESETS, useAccent } from "@/stores/accent";

// ─── Constants ───────────────────────────────────────────────────────────────

const MODELS_DOCS_URL = "https://pi.dev/docs/latest/models";
const AUTH_CONFIG_PATH = "~/.pi/agent/auth.json";

type TabId = "general" | "providers" | "models" | "about";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
	{ id: "general", label: "General", icon: <Cog className="size-4" /> },
	{ id: "providers", label: "Providers", icon: <Key className="size-4" /> },
	{ id: "models", label: "Models", icon: <LayoutGrid className="size-4" /> },
	{ id: "about", label: "About", icon: <Info className="size-4" /> },
];

// ─── Main Dialog ─────────────────────────────────────────────────────────────

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: Props) {
	const [tab, setTab] = useState<TabId>("general");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[84vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
				<DialogHeader className="shrink-0 border-b border-border/40 px-7 py-5">
					<div className="flex items-center gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-[16px] bg-primary-soft text-primary">
							<Cog className="size-5" />
						</div>
						<div>
							<DialogTitle className="text-[22px] font-medium tracking-tight">Settings</DialogTitle>
							<DialogDescription className="text-[13px] text-muted-foreground">
								Configure your deepcode experience
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>
				<div className="flex min-h-0 flex-1">
					{/* Left rail */}
					<nav className="flex w-[180px] shrink-0 flex-col gap-0.5 border-r border-border/30 p-3">
						{TABS.map((t) => (
							<button
								key={t.id}
								onClick={() => setTab(t.id)}
								className={cn(
									"flex cursor-pointer items-center gap-2.5 rounded-[12px] px-3 py-2 text-left text-[13px] font-medium transition-colors duration-100",
									tab === t.id
										? "bg-primary/10 text-primary"
										: "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground",
								)}
							>
								{t.icon}
								{t.label}
							</button>
						))}
					</nav>
					{/* Right panel */}
					<ScrollArea className="flex-1">
						<div className="px-7 py-6">
							{tab === "general" && <GeneralTab />}
							{tab === "providers" && <ProvidersTab />}
							{tab === "models" && <ModelsTab />}
							{tab === "about" && <AboutTab />}
						</div>
					</ScrollArea>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab() {
	const [settings, setSettings] = useState<DesktopSettings | null>(null);

	useEffect(() => {
		pi.settings.get().then(setSettings).catch(formatError);
	}, []);

	async function update(key: string, value: unknown) {
		try {
			await pi.settings.set(key, value);
			const next = await pi.settings.get();
			setSettings(next);
		} catch (e) {
			emitToast(formatError(e));
		}
	}

	const thinkingLevels = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

	return (
		<div className="space-y-8">
			{/* Theme */}
			<section className="space-y-3">
				<SectionHeader title="Appearance" />
				<SettingRow
					label="Theme"
					description="Choose light, dark, or follow your system preference"
				>
					<div className="flex gap-1.5">
						{(["system", "light", "dark"] as const).map((opt) => {
							const Icon = opt === "system" ? Monitor : opt === "light" ? Sun : Moon;
							return (
								<button
									key={opt}
									onClick={() => {
										void pi.theme.setSource(opt);
									}}
									className={cn(
										"flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium capitalize transition-colors",
										"bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08] hover:text-foreground",
									)}
								>
									<Icon className="size-3.5" />
									{opt}
								</button>
							);
						})}
					</div>
				</SettingRow>
				<SettingRow label="Accent color" description="Choose a primary color for the interface">
					<AccentPicker />
				</SettingRow>
				<SettingRow label="Language" description="Choose your preferred language">
					<LanguagePicker />
				</SettingRow>
			</section>

			{/* AI Behavior */}
			<section className="space-y-3">
				<SectionHeader title="AI Behavior" />
				<SettingRow
					label="Default thinking level"
					description="Controls how much reasoning the model does before responding"
				>
					<Select
						value={settings?.defaultThinkingLevel ?? "off"}
						onValueChange={(v) => update("defaultThinkingLevel", v)}
					>
						<SelectTrigger className="w-[140px] text-[13px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{thinkingLevels.map((lv) => (
								<SelectItem key={lv} value={lv}>
									{lv}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</SettingRow>
				<SettingRow
					label="Auto-compaction"
					description="Automatically compact context when it gets too long"
				>
					<ToggleSwitch
						checked={settings?.compactionEnabled ?? true}
						onChange={(v) => update("compactionEnabled", v)}
					/>
				</SettingRow>
				<SettingRow label="Auto-retry" description="Automatically retry failed requests">
					<ToggleSwitch
						checked={settings?.retryEnabled ?? true}
						onChange={(v) => update("retryEnabled", v)}
					/>
				</SettingRow>
			</section>

			{/* Images */}
			<section className="space-y-3">
				<SectionHeader title="Images" />
				<SettingRow
					label="Show images in results"
					description="Display images returned by tool calls"
				>
					<ToggleSwitch
						checked={settings?.showImages ?? true}
						onChange={(v) => update("showImages", v)}
					/>
				</SettingRow>
				<SettingRow
					label="Auto-resize images"
					description="Resize large images before sending to the model"
				>
					<ToggleSwitch
						checked={settings?.imageAutoResize ?? true}
						onChange={(v) => update("imageAutoResize", v)}
					/>
				</SettingRow>
			</section>

			{/* Telemetry */}
			<section className="space-y-3">
				<SectionHeader title="Privacy" />
				<TelemetryToggle />
			</section>

			{/* Keyboard shortcuts */}
			<section className="space-y-3">
				<SectionHeader title="Keyboard Shortcuts" />
				<div className="rounded-[18px] border border-border/60 bg-card p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
					<div className="space-y-2.5">
						<ShortcutRow keys={["⌘", "K"]} label="Command palette" />
						<ShortcutRow keys={["⌘", "N"]} label="New session" />
						<ShortcutRow keys={["⌘", "B"]} label="Toggle bash panel" />
						<ShortcutRow keys={["Enter"]} label="Send message" />
						<ShortcutRow keys={["Shift", "Enter"]} label="New line" />
					</div>
				</div>
			</section>
		</div>
	);
}

// ─── Providers Tab ───────────────────────────────────────────────────────────

const oauthProviderIds = new Set(["anthropic", "openai-codex", "github-copilot"]);

const providerHints: Record<string, { label: string; hint: string; env?: string }> = {
	anthropic: {
		label: "Anthropic",
		hint: "Claude models. Supports /login for Claude Pro/Max or API key auth.",
		env: "ANTHROPIC_API_KEY",
	},
	openai: { label: "OpenAI", hint: "GPT models through OpenAI APIs.", env: "OPENAI_API_KEY" },
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
	deepseek: { label: "DeepSeek", hint: "DeepSeek hosted models.", env: "DEEPSEEK_API_KEY" },
	"github-copilot": { label: "GitHub Copilot", hint: "Copilot subscription provider. Use /login." },
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

function ProvidersTab() {
	const [configured, setConfigured] = useState<ProviderEntry[]>([]);
	const [known, setKnown] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		void refresh();
	}, []);

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
		<div className="space-y-6">
			<section className="space-y-4">
				<SectionHeader
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
		</div>
	);
}

// ─── Models Tab ──────────────────────────────────────────────────────────────

function ModelsTab() {
	const [settings, setSettings] = useState<DesktopSettings | null>(null);
	const [editText, setEditText] = useState("");

	useEffect(() => {
		pi.settings.get().then((s) => {
			setSettings(s);
			setEditText((s.enabledModels ?? []).join("\n"));
		});
	}, []);

	async function saveEnabledModels() {
		const patterns = editText
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		try {
			await pi.settings.set("enabledModels", patterns.length > 0 ? patterns : undefined);
			const next = await pi.settings.get();
			setSettings(next);
			emitToast("Model filters saved");
		} catch (e) {
			emitToast(formatError(e));
		}
	}

	return (
		<div className="space-y-8">
			<section className="space-y-3">
				<SectionHeader
					title="Enabled Models"
					description="Filter which models are available. One pattern per line (e.g. provider/model-id). Leave empty to show all."
				/>
				<div className="rounded-[18px] border border-border/60 bg-card p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
					<textarea
						value={editText}
						onChange={(e) => setEditText(e.target.value)}
						placeholder="anthropic/claude-sonnet-4-20250514&#10;openai/gpt-4o"
						className="min-h-[120px] w-full resize-y rounded-[12px] border border-border/40 bg-background px-3 py-2.5 font-mono text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
					/>
					<div className="mt-3 flex justify-end">
						<Button
							size="sm"
							variant="primary"
							onClick={saveEnabledModels}
							className="rounded-full"
						>
							Save
						</Button>
					</div>
				</div>
			</section>

			<CustomModelsHint />

			<section className="space-y-3">
				<SectionHeader title="Image Handling" />
				<SettingRow
					label="Block images"
					description="Prevent images from being sent to the model (text placeholder instead)"
				>
					<ToggleSwitch
						checked={settings?.blockImages ?? false}
						onChange={async (v) => {
							await pi.settings.set("blockImages", v);
							const next = await pi.settings.get();
							setSettings(next);
						}}
					/>
				</SettingRow>
			</section>
		</div>
	);
}

// ─── About Tab ───────────────────────────────────────────────────────────────

function AboutTab() {
	const [version, setVersion] = useState("…");
	const [agentDir, setAgentDir] = useState("…");
	const [updateStatus, setUpdateStatus] = useState<string>("idle");
	const [checking, setChecking] = useState(false);
	const [logsOpen, setLogsOpen] = useState(false);

	useEffect(() => {
		pi.appInfo
			.version()
			.then(setVersion)
			.catch(() => setVersion("unknown"));
		pi.settings
			.agentDir()
			.then(setAgentDir)
			.catch(() => setAgentDir("unknown"));

		const unsub = pi.updater.onState((state) => {
			setUpdateStatus(state.status);
			if (state.status !== "checking") setChecking(false);
		});
		return unsub;
	}, []);

	async function handleCheck() {
		setChecking(true);
		setUpdateStatus("checking");
		try {
			await pi.updater.check();
		} catch {
			setUpdateStatus("error");
			setChecking(false);
		}
	}

	const statusLabel: Record<string, string> = {
		idle: "",
		checking: "Checking for updates…",
		available: "Update available, downloading…",
		"not-available": "You're up to date",
		error: "Update check failed",
		downloading: "Downloading update…",
		downloaded: "Update ready — restart to install",
	};

	return (
		<div className="space-y-8">
			<section className="space-y-4">
				<SectionHeader title="deepcode" />
				<div className="rounded-[18px] border border-border/60 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
					<div className="space-y-3">
						<InfoRow label="Version" value={version} />
						<InfoRow label="Agent directory" value={agentDir} mono />
					</div>
				</div>
			</section>

			<section className="space-y-4">
				<SectionHeader title="Updates" />
				<div className="flex items-center justify-between rounded-[18px] border border-border/60 bg-card px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
					<div className="min-w-0">
						<div className="text-[13px] font-medium text-foreground">
							{statusLabel[updateStatus] || "Check for updates"}
						</div>
						{updateStatus === "downloaded" ? (
							<div className="mt-0.5 text-[11px] text-muted-foreground">
								Click restart to apply the latest version.
							</div>
						) : null}
					</div>
					<div className="flex shrink-0 gap-2">
						{updateStatus === "downloaded" ? (
							<Button
								type="button"
								size="sm"
								variant="primary"
								className="rounded-full"
								onClick={() => void pi.updater.install()}
							>
								Restart
							</Button>
						) : (
							<Button
								type="button"
								size="sm"
								variant="secondary"
								className="rounded-full"
								disabled={checking}
								onClick={handleCheck}
							>
								{checking ? "Checking…" : "Check for Updates"}
							</Button>
						)}
					</div>
				</div>
			</section>

			<section className="space-y-4">
				<SectionHeader title="Configuration Files" />
				<div className="space-y-2.5">
					<ConfigFileRow label="Auth" path={`${agentDir}/auth.json`} />
					<ConfigFileRow label="Settings (global)" path={`${agentDir}/settings.json`} />
					<ConfigFileRow label="Models" path={`${agentDir}/models.json`} />
				</div>
			</section>

			<section className="space-y-3">
				<SectionHeader title="Diagnostics" />
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="secondary"
						size="sm"
						className="rounded-full"
						onClick={() => setLogsOpen(true)}
					>
						<FileText className="size-3.5" />
						View Logs
					</Button>
				</div>
			</section>

			<section className="space-y-3">
				<SectionHeader title="Links" />
				<div className="flex flex-wrap gap-2">
					<ExternalButton label="Pi Documentation" url="https://pi.dev/docs" />
					<ExternalButton label="GitHub" url="https://github.com/Fim98/deep-code" />
					<ExternalButton label="Report Issue" url="https://github.com/Fim98/deep-code/issues" />
				</div>
			</section>
			<LogViewerDialog open={logsOpen} onOpenChange={setLogsOpen} />
		</div>
	);
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function AccentPicker() {
	const { activeId, setAccent } = useAccent();
	return (
		<div className="flex gap-2">
			{ACCENT_PRESETS.map((preset) => (
				<button
					key={preset.id}
					type="button"
					onClick={() => setAccent(preset.id)}
					title={preset.label}
					aria-label={`Accent: ${preset.label}`}
					className={cn(
						"size-6 rounded-full border-2 transition-all duration-150",
						activeId === preset.id
							? "border-foreground scale-110"
							: "border-transparent hover:scale-105",
					)}
					style={{ backgroundColor: preset.swatch }}
				/>
			))}
		</div>
	);
}

function LanguagePicker() {
	const { locale, setLocale } = useI18n();
	return (
		<Select value={locale} onValueChange={(v) => setLocale(v as typeof locale)}>
			<SelectTrigger className="w-[140px] text-[13px]">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{LOCALES.map((loc) => (
					<SelectItem key={loc} value={loc}>
						{LOCALE_LABELS[loc]}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function TelemetryToggle() {
	const [telemetryEnabled, setTelemetryEnabled] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		pi.telemetry.get().then((v) => {
			setTelemetryEnabled(v);
			setLoading(false);
		});
	}, []);

	const handleToggle = async (value: boolean) => {
		setTelemetryEnabled(value);
		await pi.telemetry.set(value);
	};

	if (loading) return null;

	return (
		<SettingRow
			label="Send anonymous crash reports"
			description="Help improve deepcode by sending error data. No personal information is collected."
		>
			<ToggleSwitch checked={telemetryEnabled} onChange={handleToggle} />
		</SettingRow>
	);
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
	return (
		<div className="space-y-0.5">
			<div className="select-none text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/70">
				{title}
			</div>
			{description ? (
				<p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
			) : null}
		</div>
	);
}

function SettingRow({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4 rounded-[16px] border border-border/40 bg-card px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
			<div className="min-w-0">
				<div className="text-[13px] font-medium text-foreground">{label}</div>
				{description ? (
					<div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>
				) : null}
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	);
}

function ToggleSwitch({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onChange(!checked)}
			className={cn(
				"relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
				checked ? "bg-primary" : "bg-foreground/[0.15]",
			)}
		>
			<span
				className={cn(
					"absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
					checked && "translate-x-4",
				)}
			/>
		</button>
	);
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-[12px] text-muted-foreground">{label}</span>
			<div className="flex items-center gap-1">
				{keys.map((k, i) => (
					<span key={`${k}-${i}`}>
						<kbd className="rounded-md border border-border/60 bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-foreground/70">
							{k}
						</kbd>
					</span>
				))}
			</div>
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
			<SectionHeader
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
										onClick={() => setReveal((v) => !v)}
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

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<span className="text-[12px] text-muted-foreground">{label}</span>
			<span className={cn("text-[13px] text-foreground", mono && "font-mono text-[12px]")}>
				{value}
			</span>
		</div>
	);
}

function ConfigFileRow({ label, path }: { label: string; path: string }) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-[14px] border border-border/40 bg-card px-4 py-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
			<div className="min-w-0">
				<div className="text-[12px] font-medium text-foreground">{label}</div>
				<div className="truncate font-mono text-[11px] text-muted-foreground">{path}</div>
			</div>
			<Button
				type="button"
				size="icon-sm"
				variant="ghost"
				aria-label="Open folder"
				className="size-7 text-muted-foreground"
			>
				<FolderOpen className="size-3.5" />
			</Button>
		</div>
	);
}

function ExternalButton({ label, url }: { label: string; url: string }) {
	return (
		<Button
			type="button"
			variant="secondary"
			size="sm"
			className="rounded-full"
			onClick={() => window.open(url, "_blank")}
		>
			<ExternalLink className="size-3.5" />
			{label}
		</Button>
	);
}

function providerLabel(provider: string): string {
	return providerHints[provider]?.label ?? provider;
}

function formatError(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
