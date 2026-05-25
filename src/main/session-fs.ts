import {
	type SessionInfo,
	SessionManager,
} from "@earendil-works/pi-coding-agent";

export interface SessionListItem {
	path: string;
	id: string;
	cwd: string;
	name?: string;
	parentSessionPath?: string;
	created: number;
	modified: number;
	messageCount: number;
	firstMessage: string;
}

function toListItem(info: SessionInfo): SessionListItem {
	return {
		path: info.path,
		id: info.id,
		cwd: info.cwd,
		name: info.name,
		parentSessionPath: info.parentSessionPath,
		created: info.created.getTime(),
		modified: info.modified.getTime(),
		messageCount: info.messageCount,
		firstMessage: info.firstMessage,
	};
}

export async function listSessionsForCwd(cwd: string): Promise<SessionListItem[]> {
	const sessions = await SessionManager.list(cwd);
	return sessions.map(toListItem);
}
