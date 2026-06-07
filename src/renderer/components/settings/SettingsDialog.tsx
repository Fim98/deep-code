import {
	Check,
	Cog,
	ExternalLink,
	Eye,
	EyeOff,
	FileText,
	FolderOpen,
	Info,
	Key,
	ListFilter,
	Monitor,
	Moon,
	Plus,
	Sun,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LogViewerDialog } from "@/components/log-viewer/LogViewerDialog";
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
import { reloadSessionAndNotify } from "@/lib/session-events";
import { emitToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ACCENT_PRESETS, useAccent } from "@/stores/accent";
import { type ThemeChoice, useTheme } from "@/stores/theme";

// ─── Constants ───────────────────────────────────────────────────────────────

type TabId = "general" | "providers" | "models" | "about";

// ─── Main Dialog ─────────────────────────────────────────────────────────────

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	activeWorkspacePath?: string;
	activeSessionId?: string | null;
}

export function SettingsDialog({
	open,
	onOpenChange,
	activeWorkspacePath,
	activeSessionId,
}: Props) {
	const { t } = useI18n();
	const [tab, setTab] = useState<TabId>("general");

	const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
		{ id: "general", label: t("settings.tab.general"), icon: <Cog className="size-4" /> },
		{ id: "providers", label: t("settings.tab.providers"), icon: <Key className="size-4" /> },
		{ id: "models", label: t("settings.tab.models"), icon: <ListFilter className="size-4" /> },
		{ id: "about", label: t("settings.tab.about"), icon: <Info className="size-4" /> },
	];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[520px] max-w-3xl flex-col gap-0 overflow-hidden p-0">
				<DialogHeader className="shrink-0 border-b border-border/40 px-7 py-5">
					<div className="flex items-center gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-[16px] bg-primary-soft text-primary">
							<Cog className="size-5" />
						</div>
						<div>
							<DialogTitle className="text-[22px] font-medium tracking-tight">
								{t("settings.title")}
							</DialogTitle>
							<DialogDescription className="text-[13px] text-muted-foreground">
								{t("settings.description")}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>
				<div className="flex min-h-0 flex-1">
					{/* Left rail */}
					<nav className="flex w-[180px] shrink-0 flex-col gap-0.5 border-r border-border/30 p-3">
						{TABS.map((item) => (
							<button
								key={item.id}
								onClick={() => setTab(item.id)}
								className={cn(
									"flex cursor-pointer items-center gap-2.5 rounded-[12px] px-3 py-2 text-left text-[13px] font-medium transition-colors duration-100",
									tab === item.id
										? "bg-primary/10 text-primary"
										: "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground",
								)}
							>
								{item.icon}
								{item.label}
							</button>
						))}
					</nav>
					{/* Right panel */}
					<ScrollArea className="flex-1">
						<div className="px-7 py-6">
							{tab === "general" && (
								<GeneralTab
									activeWorkspacePath={activeWorkspacePath}
									activeSessionId={activeSessionId}
								/>
							)}
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

function GeneralTab({
	activeWorkspacePath,
	activeSessionId,
}: {
	activeWorkspacePath?: string;
	activeSessionId?: string | null;
}) {
	const { t } = useI18n();
	const [settings, setSettings] = useState<DesktopSettings | null>(null);
	const [agentDir, setAgentDir] = useState<string | null>(null);
	const [trustDecision, setTrustDecision] = useState<boolean | null>(null);

	useEffect(() => {
		pi.settings.get().then(setSettings).catch(formatError);
		pi.settings
			.agentDir()
			.then(setAgentDir)
			.catch(() => {});
		if (activeWorkspacePath) {
			pi.settings
				.getProjectTrust(activeWorkspacePath)
				.then((trust) => setTrustDecision(trust.decision))
				.catch(() => {});
		}
	}, [activeWorkspacePath]);

	async function update(key: string, value: unknown) {
		try {
			await pi.settings.set(key, value);
			const next = await pi.settings.get();
			setSettings(next);
		} catch (e) {
			emitToast(formatError(e));
		}
	}

	async function updateProjectTrust(decision: boolean | null) {
		try {
			if (!activeWorkspacePath) return;
			await pi.settings.setProjectTrust(activeWorkspacePath, decision);
			setTrustDecision(decision);
			if (activeSessionId) {
				emitToast(t("settings.trustDecisionSaved"), {
					action: { label: "Reload", onClick: () => void reloadSessionAndNotify(activeSessionId) },
				});
			} else {
				emitToast(t("settings.trustDecisionSaved"), "info");
			}
		} catch (error) {
			emitToast(formatError(error));
		}
	}

	const thinkingLevels = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

	return (
		<div className="space-y-8">
			{/* Theme */}
			<section className="space-y-3">
				<SectionHeader title={t("settings.appearance")} />
				<SettingRow label={t("settings.theme")} description={t("settings.themeDescription")}>
					<ThemeButtonGroup />
				</SettingRow>
				<SettingRow label={t("settings.accentColor")} description={t("settings.accentDescription")}>
					<AccentPicker />
				</SettingRow>
				<SettingRow label={t("settings.language")} description={t("settings.languageDescription")}>
					<LanguagePicker />
				</SettingRow>
			</section>

			{/* Project trust */}
			<section className="space-y-3">
				<SectionHeader title={t("settings.projectTrust")} />
				<div className="rounded-[18px] border border-border/60 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
					<div className="text-[12px] leading-relaxed text-muted-foreground">
						{t("settings.projectTrustDescription")}
					</div>
					<div className="mt-4 flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							variant={trustDecision === true ? "primary" : "secondary"}
							className="rounded-full"
							disabled={!activeWorkspacePath}
							onClick={() => updateProjectTrust(true)}
						>
							{t("settings.trust")}
						</Button>
						<Button
							type="button"
							size="sm"
							variant={trustDecision === false ? "primary" : "secondary"}
							className="rounded-full"
							disabled={!activeWorkspacePath}
							onClick={() => updateProjectTrust(false)}
						>
							{t("settings.doNotTrust")}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="rounded-full"
							disabled={!activeWorkspacePath}
							onClick={() => updateProjectTrust(null)}
						>
							{t("settings.clearDecision")}
						</Button>
					</div>
					<div className="mt-3 text-[11px] text-muted-foreground">
						~/.pi/agent/trust.json{agentDir ? ` · ${agentDir}/trust.json` : ""}
					</div>
				</div>
			</section>

			{/* AI Behavior */}
			<section className="space-y-3">
				<SectionHeader title={t("settings.aiBehavior")} />
				<SettingRow
					label={t("settings.thinkingLevel")}
					description={t("settings.thinkingDescription")}
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
					label={t("settings.autoCompaction")}
					description={t("settings.autoCompactionDescription")}
				>
					<ToggleSwitch
						checked={settings?.compactionEnabled ?? true}
						onChange={(v) => update("compactionEnabled", v)}
					/>
				</SettingRow>
				<SettingRow
					label={t("settings.autoRetry")}
					description={t("settings.autoRetryDescription")}
				>
					<ToggleSwitch
						checked={settings?.retryEnabled ?? true}
						onChange={(v) => update("retryEnabled", v)}
					/>
				</SettingRow>
				<SettingRow
					label={t("settings.steeringMode")}
					description={t("settings.steeringModeDescription")}
				>
					<Select
						value={settings?.steeringMode ?? "all"}
						onValueChange={(v) => update("steeringMode", v)}
					>
						<SelectTrigger className="w-[160px] text-[13px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("settings.queueMode.all")}</SelectItem>
							<SelectItem value="one-at-a-time">{t("settings.queueMode.oneAtATime")}</SelectItem>
						</SelectContent>
					</Select>
				</SettingRow>
				<SettingRow
					label={t("settings.followUpMode")}
					description={t("settings.followUpModeDescription")}
				>
					<Select
						value={settings?.followUpMode ?? "all"}
						onValueChange={(v) => update("followUpMode", v)}
					>
						<SelectTrigger className="w-[160px] text-[13px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("settings.queueMode.all")}</SelectItem>
							<SelectItem value="one-at-a-time">{t("settings.queueMode.oneAtATime")}</SelectItem>
						</SelectContent>
					</Select>
				</SettingRow>
			</section>

			{/* Images */}
			<section className="space-y-3">
				<SectionHeader title={t("settings.images")} />
				<SettingRow
					label={t("settings.showImages")}
					description={t("settings.showImagesDescription")}
				>
					<ToggleSwitch
						checked={settings?.showImages ?? true}
						onChange={(v) => update("showImages", v)}
					/>
				</SettingRow>
				<SettingRow
					label={t("settings.autoResize")}
					description={t("settings.autoResizeDescription")}
				>
					<ToggleSwitch
						checked={settings?.imageAutoResize ?? true}
						onChange={(v) => update("imageAutoResize", v)}
					/>
				</SettingRow>
			</section>

			{/* Telemetry */}
			<section className="space-y-3">
				<SectionHeader title={t("telemetry.privacy")} />
				<TelemetryToggle />
			</section>

			{/* Keyboard shortcuts */}
			<section className="space-y-3">
				<SectionHeader title={t("settings.shortcuts")} />
				<div className="rounded-[18px] border border-border/60 bg-card p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
					<div className="space-y-2.5">
						<ShortcutRow keys={["⌘", "K"]} label={t("settings.commandPalette")} />
						<ShortcutRow keys={["⌘", "N"]} label={t("settings.newSession")} />
						<ShortcutRow keys={["⌘", "B"]} label={t("settings.toggleSidebar")} />
						<ShortcutRow keys={["⌘", "J"]} label={t("settings.toggleBash")} />
						<ShortcutRow keys={["Enter"]} label={t("settings.sendMessage")} />
						<ShortcutRow keys={["Shift", "Enter"]} label={t("settings.newLine")} />
					</div>
				</div>
			</section>
		</div>
	);
}

// ─── Providers Tab ───────────────────────────────────────────────────────────

interface ProviderHint {
	label: string;
	description: string;
	env?: string;
	color: string;
	icon: string;
}

const providerHints: Record<string, ProviderHint> = {
	anthropic: {
		label: "Anthropic",
		description: "Claude models",
		env: "ANTHROPIC_API_KEY",
		color: "#D97757",
		icon: "A",
	},
	openai: {
		label: "OpenAI",
		description: "GPT-4o and o-series models",
		env: "OPENAI_API_KEY",
		color: "#10A37F",
		icon: "O",
	},
	google: {
		label: "Google",
		description: "Gemini via Google Generative AI",
		env: "GEMINI_API_KEY",
		color: "#4285F4",
		icon: "G",
	},
	openrouter: {
		label: "OpenRouter",
		description: "One key for many hosted models",
		env: "OPENROUTER_API_KEY",
		color: "#6944FF",
		icon: "R",
	},
	"vercel-ai-gateway": {
		label: "Vercel AI",
		description: "Gateway routing for models",
		env: "AI_GATEWAY_API_KEY",
		color: "#000000",
		icon: "▲",
	},
	deepseek: {
		label: "DeepSeek",
		description: "DeepSeek hosted models",
		env: "DEEPSEEK_API_KEY",
		color: "#4D6BFE",
		icon: "D",
	},
	moonshotai: {
		label: "Moonshot AI",
		description: "Kimi models through Moonshot",
		env: "MOONSHOT_API_KEY",
		color: "#5B5BF7",
		icon: "M",
	},
	"moonshotai-cn": {
		label: "Moonshot CN",
		description: "Kimi models (China region)",
		env: "MOONSHOT_API_KEY",
		color: "#5B5BF7",
		icon: "M",
	},
};

function ProvidersTab() {
	const { t } = useI18n();
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
			emitToast(t("settings.providerLoadFailed", { error: formatError(e) }));
		} finally {
			setLoading(false);
		}
	}

	async function handleRemove(provider: string) {
		try {
			await pi.auth.remove(provider);
			await refresh();
			emitToast(t("settings.providerRemovedToast", { name: providerLabel(provider) }), "info");
		} catch (e) {
			emitToast(formatError(e));
		}
	}

	async function handleSave(provider: string, key: string) {
		try {
			await pi.auth.setKey(provider, key);
			await refresh();
			emitToast(t("settings.providerAddedToast", { name: providerLabel(provider) }), "info");
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
			{/* Connected providers */}
			<section className="space-y-3">
				<SectionHeader title={t("settings.configuredProviders")} />
				{loading && configured.length === 0 ? (
					<LoadingProviders />
				) : configured.length === 0 ? (
					<div className="rounded-[16px] border border-dashed border-border/60 bg-foreground/[0.01] px-5 py-6 text-center text-[13px] text-muted-foreground">
						{t("settings.noProviders")}
					</div>
				) : (
					<div className="space-y-2">
						{configured.map((entry) => (
							<ConnectedProviderRow
								key={entry.provider}
								entry={entry}
								onRemove={() => handleRemove(entry.provider)}
							/>
						))}
					</div>
				)}
			</section>

			{/* Add provider */}
			{availableProviders.length > 0 && (
				<section className="space-y-3">
					<SectionHeader title={t("settings.addProvider")} />
					<AddProviderForm providers={availableProviders} onSave={handleSave} />
				</section>
			)}

			{/* Config hint */}
			<section className="space-y-3">
				<div className="flex items-center justify-between gap-3 rounded-[16px] border border-border/40 bg-foreground/[0.015] px-4 py-3">
					<div className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
						{t("settings.providerConfigHint", { path: "~/.pi/agent/models.json" })}
					</div>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						className="shrink-0 rounded-full"
						onClick={() => window.open("https://pi.dev/docs/latest/models", "_blank")}
					>
						<ExternalLink className="size-3.5" />
						{t("settings.docs")}
					</Button>
				</div>
			</section>
		</div>
	);
}

function LoadingProviders() {
	const { t } = useI18n();
	return (
		<div className="flex items-center justify-center rounded-[16px] border border-border/40 bg-card px-5 py-8">
			<div className="flex items-center gap-2 text-[12px] text-muted-foreground">
				<div className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary/60" />
				{t("settings.loadingProviders")}
			</div>
		</div>
	);
}

function ConnectedProviderRow({
	entry,
	onRemove,
}: {
	entry: ProviderEntry;
	onRemove: () => Promise<void>;
}) {
	const { t } = useI18n();
	const hint = providerHints[entry.provider];

	return (
		<div className="group flex items-center gap-3 rounded-[16px] border border-border/40 bg-card px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.02)] transition-colors hover:border-border/60">
			{/* Brand icon */}
			<div
				className="flex size-9 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-bold text-white"
				style={{ backgroundColor: hint?.color ?? "#888" }}
			>
				{hint?.icon ?? entry.provider.charAt(0).toUpperCase()}
			</div>

			{/* Info */}
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="text-[13px] font-medium text-foreground">
						{hint?.label ?? entry.provider}
					</span>
					<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
						<Key className="size-2.5" />
						{t("settings.apiKey")}
					</span>
				</div>
				<div className="mt-0.5 truncate text-[11px] text-muted-foreground">{entry.maskedKey}</div>
			</div>

			{/* Remove */}
			<button
				type="button"
				onClick={onRemove}
				aria-label={t("settings.removeProvider")}
				className="flex size-7 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
			>
				<Trash2 className="size-3.5" />
			</button>
		</div>
	);
}

function AddProviderForm({
	providers,
	onSave,
}: {
	providers: string[];
	onSave: (provider: string, key: string) => Promise<void>;
}) {
	const { t } = useI18n();
	const [provider, setProvider] = useState(providers[0] ?? "");
	const [key, setKey] = useState("");
	const [reveal, setReveal] = useState(false);
	const [saving, setSaving] = useState(false);
	const [success, setSuccess] = useState(false);

	useEffect(() => {
		if (providers.length === 0) {
			setProvider("");
			return;
		}
		if (!providers.includes(provider)) setProvider(providers[0]);
	}, [provider, providers]);

	const hint = providerHints[provider];

	async function submit() {
		if (!provider || !key.trim()) return;
		setSaving(true);
		try {
			await onSave(provider, key.trim());
			setKey("");
			setSuccess(true);
			setTimeout(() => setSuccess(false), 2000);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="rounded-[18px] border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					void submit();
				}}
				className="space-y-4"
			>
				{/* Provider select + brand preview */}
				<div className="flex items-center gap-3">
					<div
						className="flex size-10 shrink-0 items-center justify-center rounded-[14px] text-[14px] font-bold text-white transition-colors duration-200"
						style={{ backgroundColor: hint?.color ?? "#888" }}
					>
						{hint?.icon ?? "?"}
					</div>
					<div className="min-w-0 flex-1">
						<Select value={provider} onValueChange={setProvider}>
							<SelectTrigger className="text-[13px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{providers.map((item) => (
									<SelectItem key={item} value={item}>
										<div className="flex items-center gap-2">
											<span
												className="inline-block size-2 rounded-full"
												style={{
													backgroundColor: providerHints[item]?.color ?? "#888",
												}}
											/>
											{providerLabel(item)}
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Provider description */}
				{hint && (
					<div className="text-[11px] leading-relaxed text-muted-foreground">
						{hint.description}
					</div>
				)}

				{/* API key input */}
				<div className="space-y-1.5">
					<label
						htmlFor="add-provider-key"
						className="text-[11px] font-medium text-muted-foreground"
					>
						{t("settings.apiKeyLabel")}
					</label>
					<div className="flex items-center gap-2">
						<Input
							id="add-provider-key"
							value={key}
							onChange={(e) => setKey(e.target.value)}
							type={reveal ? "text" : "password"}
							placeholder={hint?.env ?? "sk-… or OPENAI_API_KEY"}
							className="text-[13px]"
						/>
						<button
							type="button"
							onClick={() => setReveal((v) => !v)}
							className="flex size-9 shrink-0 items-center justify-center rounded-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
							aria-label={reveal ? t("settings.hideApiKey") : t("settings.showApiKey")}
						>
							{reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
						</button>
					</div>
				</div>

				{/* Submit */}
				<div className="flex justify-end">
					<Button
						type="submit"
						size="sm"
						variant="primary"
						disabled={!provider || !key.trim() || saving}
						className={cn("rounded-full gap-1.5", saving && "opacity-60")}
					>
						{success ? (
							<>
								<Check className="size-3.5" />
								{t("settings.providerAdded")}
							</>
						) : (
							<>
								<Plus className="size-3.5" />
								{saving ? t("settings.providerAdding") : t("settings.addProvider")}
							</>
						)}
					</Button>
				</div>
			</form>
		</div>
	);
}

// ─── Models Tab ──────────────────────────────────────────────────────────────

function ModelsTab() {
	const { t } = useI18n();
	const [settings, setSettings] = useState<DesktopSettings | null>(null);
	const [patterns, setPatterns] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		void pi.settings
			.get()
			.then((next) => {
				setSettings(next);
				setPatterns((next.enabledModels ?? []).join("\n"));
			})
			.catch((error) => emitToast(formatError(error)));
	}, []);

	async function savePatterns() {
		const enabledModels = patterns
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		setSaving(true);
		try {
			await pi.settings.set("enabledModels", enabledModels.length > 0 ? enabledModels : undefined);
			const next = await pi.settings.get();
			setSettings(next);
			setPatterns((next.enabledModels ?? []).join("\n"));
			emitToast(t("settings.modelFiltersSaved"), "info");
		} catch (error) {
			emitToast(formatError(error));
		} finally {
			setSaving(false);
		}
	}

	async function updateBlockImages(value: boolean) {
		try {
			await pi.settings.set("blockImages", value);
			setSettings(await pi.settings.get());
		} catch (error) {
			emitToast(formatError(error));
		}
	}

	return (
		<div className="space-y-8">
			<section className="space-y-3">
				<SectionHeader title={t("settings.enabledModels")} />
				<div className="rounded-[18px] border border-border/60 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
					<div className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
						{t("settings.enabledModelsDescription")}
					</div>
					<textarea
						value={patterns}
						onChange={(event) => setPatterns(event.target.value)}
						placeholder="anthropic/claude-*\nopenai/gpt-*"
						className="min-h-[132px] w-full resize-none rounded-[16px] border border-border/60 bg-background/60 px-4 py-3 font-mono text-[12px] outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
					/>
					<div className="mt-4 flex items-center justify-between gap-3">
						<div className="text-[11px] text-muted-foreground">
							{t("settings.customModelsHint")}
						</div>
						<Button
							type="button"
							variant="primary"
							size="sm"
							className="rounded-full"
							disabled={saving}
							onClick={savePatterns}
						>
							{saving ? t("settings.checking") : t("settings.save")}
						</Button>
					</div>
				</div>
			</section>

			<section className="space-y-3">
				<SectionHeader title={t("settings.imageHandling")} />
				<SettingRow
					label={t("settings.blockImages")}
					description={t("settings.blockImagesDescription")}
				>
					<ToggleSwitch checked={settings?.blockImages ?? false} onChange={updateBlockImages} />
				</SettingRow>
			</section>

			<section className="space-y-3">
				<SectionHeader title={t("settings.configurationFiles")} />
				<div className="space-y-2.5">
					<SettingsJsonPreview label="Global" value={settings?.globalSettings} />
					<SettingsJsonPreview label="Project" value={settings?.projectSettings} />
				</div>
			</section>
		</div>
	);
}

function SettingsJsonPreview({ label, value }: { label: string; value: unknown }) {
	return (
		<details className="rounded-[16px] border border-border/50 bg-card px-4 py-3 text-[12px] shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
			<summary className="cursor-pointer font-medium text-foreground">{label}</summary>
			<pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-[12px] bg-foreground/[0.03] p-3 font-mono text-[11px] text-muted-foreground">
				{JSON.stringify(value ?? {}, null, 2)}
			</pre>
		</details>
	);
}

// ─── About Tab ───────────────────────────────────────────────────────────────

function AboutTab() {
	const { t } = useI18n();
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
								{t("settings.restartToApply")}
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
								{t("settings.restart")}
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
								{checking ? t("settings.checking") : t("settings.checkForUpdates")}
							</Button>
						)}
					</div>
				</div>
			</section>

			<section className="space-y-4">
				<SectionHeader title={t("settings.configurationFiles")} />
				<div className="space-y-2.5">
					<ConfigFileRow label="Auth" path={`${agentDir}/auth.json`} />
					<ConfigFileRow label="Settings (global)" path={`${agentDir}/settings.json`} />
					<ConfigFileRow label="Models" path={`${agentDir}/models.json`} />
				</div>
			</section>

			<section className="space-y-3">
				<SectionHeader title={t("settings.diagnostics")} />
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="secondary"
						size="sm"
						className="rounded-full"
						onClick={() => setLogsOpen(true)}
					>
						<FileText className="size-3.5" />
						{t("settings.viewLogs")}
					</Button>
				</div>
			</section>

			<section className="space-y-3">
				<SectionHeader title={t("settings.links")} />
				<div className="flex flex-wrap gap-2">
					<ExternalButton label={t("settings.piDocs")} url="https://pi.dev/docs" />
					<ExternalButton label={t("settings.github")} url="https://github.com/Fim98/deep-code" />
					<ExternalButton
						label={t("settings.reportIssue")}
						url="https://github.com/Fim98/deep-code/issues"
					/>
				</div>
			</section>
			<LogViewerDialog open={logsOpen} onOpenChange={setLogsOpen} />
		</div>
	);
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function ThemeButtonGroup() {
	const { t } = useI18n();
	const { choice, setChoice } = useTheme();
	const options: { value: ThemeChoice; label: string; icon: typeof Monitor }[] = [
		{ value: "system", label: t("theme.system"), icon: Monitor },
		{ value: "light", label: t("theme.light"), icon: Sun },
		{ value: "dark", label: t("theme.dark"), icon: Moon },
	];
	return (
		<div className="flex gap-1.5">
			{options.map(({ value, label, icon: Icon }) => (
				<button
					key={value}
					onClick={() => setChoice(value)}
					className={cn(
						"flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium capitalize transition-colors",
						choice === value
							? "bg-primary/10 text-primary"
							: "bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08] hover:text-foreground",
					)}
				>
					<Icon className="size-3.5" />
					{label}
				</button>
			))}
		</div>
	);
}

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
	const { t } = useI18n();
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
			label={t("telemetry.crashReports")}
			description={t("telemetry.crashReportsDescription")}
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
	const { t } = useI18n();
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
				aria-label={t("settings.openFolder")}
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
