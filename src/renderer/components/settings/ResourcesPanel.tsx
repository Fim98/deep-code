import {
	AlertTriangle,
	BookOpen,
	Box,
	FileText,
	Palette,
	RefreshCw,
	RotateCcw,
	Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
	type PiResourceKind,
	type PiResourceScope,
	pi,
	type SessionResourcesData,
} from "@/lib/rpc";
import { emitToast } from "@/lib/toast";

interface Props {
	sessionId: string | null;
	cwd?: string;
}

export function ResourcesPanel({ sessionId, cwd }: Props) {
	const [data, setData] = useState<SessionResourcesData | null>(null);
	const [loading, setLoading] = useState(false);
	const [reloading, setReloading] = useState(false);
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [newDescription, setNewDescription] = useState("");
	const [newKind, setNewKind] = useState<PiResourceKind>("prompts");
	const [newScope, setNewScope] = useState<PiResourceScope>("global");

	useEffect(() => {
		void refresh();
	}, [sessionId]);

	async function refresh() {
		if (!sessionId) return;
		setLoading(true);
		try {
			setData(await pi.sessions.getResources(sessionId));
		} catch (error) {
			emitToast(formatError(error));
		} finally {
			setLoading(false);
		}
	}

	async function reload() {
		if (!sessionId) return;
		setReloading(true);
		try {
			setData(await pi.sessions.reload(sessionId));
			emitToast("Session resources reloaded", "info");
		} catch (error) {
			emitToast(formatError(error));
		} finally {
			setReloading(false);
		}
	}

	async function openDir(scope: PiResourceScope, kind: PiResourceKind) {
		if (!cwd) return;
		try {
			const error = await pi.resources.openDir({ cwd, scope, kind });
			if (error) emitToast(error);
		} catch (error) {
			emitToast(formatError(error));
		}
	}

	async function createResource() {
		if (!cwd || !newName.trim()) return;
		setCreating(true);
		try {
			const path = await pi.resources.create({
				cwd,
				scope: newScope,
				kind: newKind,
				name: newName,
				description: newDescription,
			});
			setNewName("");
			setNewDescription("");
			const openError = await pi.shell.openPath(path);
			if (openError) {
				emitToast(`Created ${path}`, {
					action: { label: "Reveal", onClick: () => void pi.shell.showItemInFolder(path) },
				});
			} else {
				emitToast(`Created and opened ${path}`, {
					action: { label: "Reload", onClick: () => void reload() },
				});
			}
		} catch (error) {
			emitToast(formatError(error));
		} finally {
			setCreating(false);
		}
	}

	const diagnostics = useMemo(
		() => [
			...(data?.extensionErrors.map((err) => ({
				type: "error",
				message: err.error,
				path: err.path,
			})) ?? []),
			...(data?.skillDiagnostics ?? []),
			...(data?.promptDiagnostics ?? []),
			...(data?.themeDiagnostics ?? []),
		],
		[data],
	);

	if (!sessionId) {
		return (
			<div className="flex h-full items-center justify-center px-8 text-center text-[13px] text-muted-foreground">
				Open a session to inspect loaded pi resources.
			</div>
		);
	}

	return (
		<aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-border/50 bg-card/80 backdrop-blur-xl">
			<header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border/40 px-5">
				<div className="flex items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-[14px] bg-primary-soft text-primary">
						<Box className="size-4" />
					</div>
					<div>
						<div className="text-[14px] font-medium text-foreground">Resources</div>
						<div className="text-[11px] text-muted-foreground">loaded by pi for this session</div>
					</div>
				</div>
				<div className="flex gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={reload}
						disabled={reloading}
						aria-label="Reload session resources"
						title="Reload session resources"
					>
						{reloading ? <Spinner size="sm" /> : <RotateCcw className="size-4" />}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={refresh}
						disabled={loading}
						aria-label="Refresh resources"
						title="Refresh resources"
					>
						{loading ? <Spinner size="sm" /> : <RefreshCw className="size-4" />}
					</Button>
				</div>
			</header>

			<div className="space-y-4 overflow-auto p-5">
				<ResourceActions
					cwd={cwd}
					name={newName}
					description={newDescription}
					kind={newKind}
					scope={newScope}
					creating={creating}
					onNameChange={setNewName}
					onDescriptionChange={setNewDescription}
					onKindChange={setNewKind}
					onScopeChange={setNewScope}
					onCreate={createResource}
					onOpenDir={openDir}
				/>
				<ResourceSummary data={data} />
				{diagnostics.length > 0 ? (
					<ResourceSection title="Diagnostics" icon={<AlertTriangle className="size-4" />}>
						{diagnostics.map((diag, index) => (
							<ResourceRow
								key={`${diag.path ?? "diag"}-${index}`}
								title={diag.message}
								subtitle={diag.path}
								badge={diag.type}
							/>
						))}
					</ResourceSection>
				) : null}
				<ResourceSection title="Context files" icon={<FileText className="size-4" />}>
					{data?.contextFiles.map((file) => (
						<ResourceRow
							key={file.path}
							title={shortPath(file.path)}
							subtitle={file.path}
							badge={formatBytes(file.bytes)}
						/>
					))}
				</ResourceSection>
				<ResourceSection title="Extensions" icon={<Sparkles className="size-4" />}>
					{data?.extensions.map((extension) => (
						<ResourceRow
							key={extension.resolvedPath}
							title={shortPath(extension.path)}
							subtitle={`${extension.commands.length} commands · ${extension.tools.length} tools`}
							badge={extension.sourceInfo?.scope ?? extension.sourceInfo?.source}
						/>
					))}
				</ResourceSection>
				<ResourceSection title="Skills" icon={<BookOpen className="size-4" />}>
					{data?.skills.map((skill) => (
						<ResourceRow
							key={skill.filePath}
							title={skill.name}
							subtitle={skill.description}
							badge={skill.sourceInfo?.scope}
						/>
					))}
				</ResourceSection>
				<ResourceSection title="Prompts" icon={<FileText className="size-4" />}>
					{data?.prompts.map((prompt) => (
						<ResourceRow
							key={prompt.filePath}
							title={`/${prompt.name}`}
							subtitle={prompt.description || prompt.filePath}
							badge={prompt.sourceInfo?.scope}
						/>
					))}
				</ResourceSection>
				<ResourceSection title="Themes" icon={<Palette className="size-4" />}>
					{data?.themes.map((theme, index) => (
						<ResourceRow
							key={`${theme.name}-${index}`}
							title={theme.name}
							subtitle={theme.sourceInfo?.path}
							badge={theme.sourceInfo?.scope}
						/>
					))}
				</ResourceSection>
			</div>
		</aside>
	);
}

function ResourceActions({
	cwd,
	name,
	description,
	kind,
	scope,
	creating,
	onNameChange,
	onDescriptionChange,
	onKindChange,
	onScopeChange,
	onCreate,
	onOpenDir,
}: {
	cwd?: string;
	name: string;
	description: string;
	kind: PiResourceKind;
	scope: PiResourceScope;
	creating: boolean;
	onNameChange: (value: string) => void;
	onDescriptionChange: (value: string) => void;
	onKindChange: (value: PiResourceKind) => void;
	onScopeChange: (value: PiResourceScope) => void;
	onCreate: () => void;
	onOpenDir: (scope: PiResourceScope, kind: PiResourceKind) => void;
}) {
	return (
		<div className="rounded-[18px] border border-border/50 bg-background/50 p-4 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
			<div className="mb-3 text-[12px] font-medium text-foreground">Create or open resources</div>
			<div className="grid grid-cols-2 gap-2">
				<SelectPill value={scope} values={["global", "project"]} onChange={onScopeChange} />
				<SelectPill value={kind} values={["prompts", "skills"]} onChange={onKindChange} />
			</div>
			<div className="mt-3 space-y-2">
				<Input
					value={name}
					onChange={(event) => onNameChange(event.target.value)}
					placeholder="name"
					className="text-[13px]"
				/>
				<Input
					value={description}
					onChange={(event) => onDescriptionChange(event.target.value)}
					placeholder="description"
					className="text-[13px]"
				/>
			</div>
			<div className="mt-3 flex gap-2">
				<Button
					type="button"
					variant="primary"
					size="sm"
					className="flex-1 rounded-full"
					disabled={!cwd || !name.trim() || creating}
					onClick={onCreate}
				>
					{creating ? <Spinner size="sm" /> : null}
					Create
				</Button>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					className="flex-1 rounded-full"
					disabled={!cwd}
					onClick={() => onOpenDir(scope, kind)}
				>
					Open folder
				</Button>
			</div>
		</div>
	);
}

function SelectPill<T extends string>({
	value,
	values,
	onChange,
}: {
	value: T;
	values: T[];
	onChange: (value: T) => void;
}) {
	return (
		<div className="rounded-full bg-foreground/[0.04] p-1">
			<div className="grid grid-cols-2 gap-1">
				{values.map((item) => (
					<button
						key={item}
						type="button"
						onClick={() => onChange(item)}
						className={
							item === value
								? "rounded-full bg-card px-2 py-1 text-[11px] font-medium text-foreground shadow-sm"
								: "rounded-full px-2 py-1 text-[11px] text-muted-foreground"
						}
					>
						{item}
					</button>
				))}
			</div>
		</div>
	);
}

function ResourceSummary({ data }: { data: SessionResourcesData | null }) {
	const items = [
		["Context", data?.contextFiles.length ?? 0],
		["Extensions", data?.extensions.length ?? 0],
		["Skills", data?.skills.length ?? 0],
		["Prompts", data?.prompts.length ?? 0],
	] as const;
	return (
		<div className="grid grid-cols-4 gap-2">
			{items.map(([label, value]) => (
				<div key={label} className="rounded-[16px] bg-foreground/[0.035] px-3 py-3 text-center">
					<div className="text-[16px] font-medium text-foreground">{value}</div>
					<div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
				</div>
			))}
		</div>
	);
}

function ResourceSection({
	title,
	icon,
	children,
}: {
	title: string;
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
	return (
		<section className="space-y-2.5">
			<div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
				{icon}
				{title}
			</div>
			{hasChildren ? (
				<div className="space-y-2">{children}</div>
			) : (
				<div className="rounded-[16px] border border-dashed border-border/60 px-4 py-5 text-center text-[12px] text-muted-foreground">
					None loaded
				</div>
			)}
		</section>
	);
}

function ResourceRow({
	title,
	subtitle,
	badge,
}: {
	title: string;
	subtitle?: string;
	badge?: string;
}) {
	return (
		<div className="rounded-[16px] border border-border/50 bg-background/50 px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
			<div className="flex items-center gap-2">
				<div className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
					{title}
				</div>
				{badge ? (
					<span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
						{badge}
					</span>
				) : null}
			</div>
			{subtitle ? (
				<div className="mt-1 truncate text-[11px] text-muted-foreground">{subtitle}</div>
			) : null}
		</div>
	);
}

function shortPath(path: string): string {
	return path.split(/[\\/]/).filter(Boolean).slice(-2).join("/") || path;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
