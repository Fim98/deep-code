export const en: Record<string, string> = {
	// ─── App shell ──────────────────────────────────────────────────────────
	"app.title": "deepcode",

	// ─── Sidebar ────────────────────────────────────────────────────────────
	"sidebar.workspaces": "Workspaces",
	"sidebar.addWorkspace": "Add workspace",
	"sidebar.noWorkspaces": "No workspaces yet",
	"sidebar.noSessions": "No sessions yet",
	"sidebar.newSession": "New session",
	"sidebar.untitled": "Untitled",
	"sidebar.sessionName": "Session name",
	"sidebar.deleteConfirm":
		'Delete session "{{name}}"?\n\nThis removes the session file from disk and cannot be undone.',
	"sidebar.deleteLabel": "Delete session",

	// ─── Header ─────────────────────────────────────────────────────────────
	"header.search": "Search",
	"header.searchChats": "Search chats",
	"header.settings": "Settings",
	"header.share": "Share",
	"header.thinking": "Thinking",
	"header.messages": "{{count}} messages",
	"header.message": "{{count}} message",
	"header.chooseWorkspace": "Choose a workspace to begin",

	// ─── Empty state ────────────────────────────────────────────────────────
	"empty.title": "Start coding with pi",
	"empty.description.hasWorkspace":
		"Open an existing session from the sidebar, or start a fresh one in this workspace.",
	"empty.description.noWorkspace":
		"Add a workspace folder to get started. Each workspace is a project directory where pi can read, edit, and run code.",
	"empty.newSession": "New session",
	"empty.addWorkspace": "Add workspace",

	// ─── Composer ───────────────────────────────────────────────────────────
	"composer.placeholder": "Ask pi anything...",
	"composer.steerPlaceholder": "Steer the agent...",
	"composer.send": "Send",
	"composer.steer": "Steer",
	"composer.abort": "Abort",
	"composer.attachImage": "Attach image",
	"composer.removeAttachment": "Remove attachment",
	"composer.dropImages": "Drop images here",
	"composer.sendHint": "Enter to send · Shift+Enter for new line",
	"composer.steerHint": "Send to steer · empty submit to abort",
	"composer.slashCommands": "Slash commands",
	"composer.slashHint": "↑↓ navigate · ↵ select · esc close",

	// ─── Bash panel ─────────────────────────────────────────────────────────
	"bash.title": "Bash",
	"bash.running": "running…",
	"bash.idle": "idle",
	"bash.placeholder": "Run a bash command...",
	"bash.abortLabel": "Abort",
	"bash.closeLabel": "Close",
	"bash.empty": "No commands yet.",
	"bash.emptyHint": "Try ls or git status.",

	// ─── Branches ───────────────────────────────────────────────────────────
	"branches.title": "Branches",
	"branches.description": "Fork from any user message to create an alternative conversation path.",
	"branches.currentPath": "Current path",
	"branches.forkPoint": "Fork point",
	"branches.forkLabel": "Fork",
	"branches.oneBranch": "1 branch",
	"branches.nBranches": "{{count}} branches",
	"branches.loading": "Loading…",
	"branches.empty": "No messages yet. Send a message to enable forking.",

	// ─── Command palette ────────────────────────────────────────────────────
	"palette.placeholder": "Type a command or search…",
	"palette.noResults": 'No results for "{{query}}"',
	"palette.navigate": "Navigate",
	"palette.select": "Select",
	"palette.close": "Close",
	"palette.group.workspace": "Workspace",
	"palette.group.session": "Session",
	"palette.group.interface": "Interface",
	"palette.group.model": "Model",
	"palette.group.thinking": "Thinking",
	"palette.group.commands": "Commands",
	"palette.addWorkspace": "Add workspace…",
	"palette.newSession": "New session",
	"palette.active": "Active",
	"palette.current": "Current",
	"palette.currentlyOpen": "Currently open",
	"palette.showBash": "Show bash panel",
	"palette.hideBash": "Hide bash panel",
	"palette.openSettings": "Open settings",
	"palette.closeSettings": "Close settings",
	"palette.themeSystem": "Theme: System",
	"palette.themeLight": "Theme: Light",
	"palette.themeDark": "Theme: Dark",

	// ─── Model picker ───────────────────────────────────────────────────────
	"model.selectModel": "Select model",
	"model.searchPlaceholder": "Search models...",
	"model.searchLabel": "Search models",
	"model.thinking": "Thinking",
	"model.loading": "Loading…",
	"model.noModels": "No models. Configure auth in ~/.pi/agent/auth.json.",

	// ─── Settings dialog ────────────────────────────────────────────────────
	"settings.title": "Settings",
	"settings.description": "Configure your deepcode experience",
	"settings.tab.general": "General",
	"settings.tab.providers": "Providers",
	"settings.tab.models": "Models",
	"settings.tab.about": "About",

	// General
	"settings.appearance": "Appearance",
	"settings.theme": "Theme",
	"settings.themeDescription": "Choose light, dark, or follow your system preference",
	"settings.accentColor": "Accent color",
	"settings.accentDescription": "Choose a primary color for the interface",
	"settings.language": "Language",
	"settings.languageDescription": "Choose your preferred language",
	"settings.aiBehavior": "AI Behavior",
	"settings.thinkingLevel": "Default thinking level",
	"settings.thinkingDescription": "Controls how much reasoning the model does before responding",
	"settings.autoCompaction": "Auto-compaction",
	"settings.autoCompactionDescription": "Automatically compact context when it gets too long",
	"settings.autoRetry": "Auto-retry",
	"settings.autoRetryDescription": "Automatically retry failed requests",
	"settings.images": "Images",
	"settings.showImages": "Show images in results",
	"settings.showImagesDescription": "Display images returned by tool calls",
	"settings.autoResize": "Auto-resize images",
	"settings.autoResizeDescription": "Resize large images before sending to the model",
	"settings.shortcuts": "Keyboard Shortcuts",
	"settings.commandPalette": "Command palette",
	"settings.newSession": "New session",
	"settings.toggleBash": "Toggle bash panel",
	"settings.sendMessage": "Send message",
	"settings.newLine": "New line",

	// Providers
	"settings.configuredProviders": "Configured Providers",
	"settings.providersDescription":
		"Credentials are stored in {{path}}. Use /login to add supported providers.",
	"settings.noProviders": "No credentials configured yet.",
	"settings.loadingProviders": "Loading providers...",
	"settings.allConfigured": "All preset providers are already configured.",
	"settings.addProvider": "Add Provider",
	"settings.addProviderDescription":
		"Choose a preset provider. Use /login in chat for OAuth providers, or store an API key here.",
	"settings.provider": "Provider",
	"settings.selectProvider": "Select provider",
	"settings.apiKeyLabel": "API key or env name",
	"settings.apiKeyPlaceholder": "API key or ENV_VAR_NAME",
	"settings.saveApiKey": "Save API key",
	"settings.showApiKey": "Show API key",
	"settings.hideApiKey": "Hide API key",
	"settings.removeProvider": "Remove",
	"settings.customModelsHint":
		"Custom providers, local models, and proxies use models.json. See the Pi models documentation for setup details.",
	"settings.docs": "Docs",

	// Models
	"settings.enabledModels": "Enabled Models",
	"settings.enabledModelsDescription":
		"Filter which models are available. One pattern per line (e.g. provider/model-id). Leave empty to show all.",
	"settings.save": "Save",
	"settings.blockImages": "Block images",
	"settings.blockImagesDescription":
		"Prevent images from being sent to the model (text placeholder instead)",
	"settings.imageHandling": "Image Handling",
	"settings.modelFiltersSaved": "Model filters saved",

	// About
	"settings.about": "deepcode",
	"settings.version": "Version",
	"settings.agentDirectory": "Agent directory",
	"settings.updates": "Updates",
	"settings.checkForUpdates": "Check for Updates",
	"settings.checking": "Checking…",
	"settings.checkingUpdates": "Checking for updates…",
	"settings.updateAvailable": "Update available, downloading…",
	"settings.upToDate": "You're up to date",
	"settings.updateFailed": "Update check failed",
	"settings.downloading": "Downloading update…",
	"settings.updateReady": "Update ready — restart to install",
	"settings.restartToApply": "Click restart to apply the latest version.",
	"settings.restart": "Restart",
	"settings.configurationFiles": "Configuration Files",
	"settings.links": "Links",
	"settings.piDocs": "Pi Documentation",
	"settings.github": "GitHub",
	"settings.reportIssue": "Report Issue",
	"settings.openFolder": "Open folder",

	// ─── Toasts ─────────────────────────────────────────────────────────────
	"toast.updateReady": "Update {{version}} ready. Restart to install.",
	"toast.restart": "Restart",
	"toast.sessionExported": "Session exported to {{path}}",
	"toast.showInFinder": "Show in Finder",
	"toast.exportFailed": "Export failed: {{error}}",
	"toast.failedToOpen": "Failed to open session: {{error}}",
	"toast.deleteFailed": "Delete failed: {{error}}",
	"toast.renameFailed": "Rename failed: {{error}}",
	"toast.forkFailed": "Fork failed: {{error}}",

	// ─── Timeline ───────────────────────────────────────────────────────────
	"timeline.emptyTitle": "Send a message to begin",
	"timeline.emptyDescription": "Ask pi to read, edit, search, or run anything in this workspace.",
	"timeline.forkFromHere": "Fork from here",

	// ─── Plan tracker ───────────────────────────────────────────────────────
	"planTracker.tasks": "{{complete}} of {{total}} complete",
	"planTracker.inProgress": "In progress",
	"planTracker.pending": "Pending",
	"planTracker.allComplete": "All tasks complete",

	// ─── Theme switcher ─────────────────────────────────────────────────────
	"theme.system": "System",
	"theme.light": "Light",
	"theme.dark": "Dark",
	"theme.label": "Theme",

	// ─── Log viewer ───────────────────────────────────────────────────────────
	"logs.title": "Error Logs",
	"logs.viewLogs": "View Logs",
	"logs.diagnostics": "Diagnostics",
	"logs.entryCount": "{{count}} entries · last 500 max",
	"logs.noEntries": "No errors logged",
	"logs.loading": "Loading…",
	"logs.refresh": "Refresh",
	"logs.copyLogs": "Copy logs",
	"logs.clearLogs": "Clear logs",
	"logs.cleared": "Logs cleared",
	"logs.copied": "Logs copied to clipboard",
	"logs.copyFailed": "Failed to copy logs",
	"logs.loadFailed": "Failed to load logs: {{error}}",
	"logs.clearFailed": "Failed to clear logs: {{error}}",
	"logs.showStack": "show stack",
	"logs.hideStack": "hide stack",

	// ─── File tree ────────────────────────────────────────────────────────────
	"fileTree.title": "Files",
	"fileTree.loading": "Loading\u2026",
	"fileTree.empty": "No files found",
	"fileTree.dirEmpty": "Empty",
	"fileTree.refresh": "Refresh",
	"fileTree.close": "Close file tree",
	"fileTree.toggle": "Toggle file tree",
	"fileTree.copiedPath": "Copied {{path}}",

	// ─── Telemetry ──────────────────────────────────────────────────────────
	"telemetry.privacy": "Privacy",
	"telemetry.crashReports": "Send anonymous crash reports",
	"telemetry.crashReportsDescription":
		"Help improve deepcode by sending error data. No personal information is collected.",
};
