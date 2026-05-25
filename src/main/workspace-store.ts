import { randomUUID } from "node:crypto";
import { app } from "electron";
import Store from "electron-store";

export interface WorkspaceEntry {
	id: string;
	name: string;
	path: string;
	addedAt: number;
}

interface Schema {
	workspaces: WorkspaceEntry[];
	activeWorkspaceId: string | null;
}

const store = new Store<Schema>({
	name: "workspaces",
	cwd: app.getPath("userData"),
	defaults: { workspaces: [], activeWorkspaceId: null },
});

export function listWorkspaces(): WorkspaceEntry[] {
	return store.get("workspaces");
}

export function getWorkspace(id: string): WorkspaceEntry | undefined {
	return listWorkspaces().find((w) => w.id === id);
}

export function addWorkspace(path: string, name?: string): WorkspaceEntry {
	const list = listWorkspaces();
	const existing = list.find((w) => w.path === path);
	if (existing) return existing;
	const entry: WorkspaceEntry = {
		id: randomUUID(),
		name: name ?? path.split("/").filter(Boolean).pop() ?? path,
		path,
		addedAt: Date.now(),
	};
	store.set("workspaces", [...list, entry]);
	if (!getActiveWorkspaceId()) setActiveWorkspaceId(entry.id);
	return entry;
}

export function removeWorkspace(id: string): void {
	store.set(
		"workspaces",
		listWorkspaces().filter((w) => w.id !== id),
	);
	if (getActiveWorkspaceId() === id) {
		const next = listWorkspaces()[0]?.id ?? null;
		setActiveWorkspaceId(next);
	}
}

export function getActiveWorkspaceId(): string | null {
	return store.get("activeWorkspaceId");
}

export function setActiveWorkspaceId(id: string | null): void {
	store.set("activeWorkspaceId", id);
}
