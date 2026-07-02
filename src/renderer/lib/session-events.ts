export const SESSION_RELOADED_EVENT = "antcode:session-reloaded";

export interface SessionReloadedDetail {
	sessionId: string;
}

export function emitSessionReloaded(sessionId: string): void {
	window.dispatchEvent(
		new CustomEvent<SessionReloadedDetail>(SESSION_RELOADED_EVENT, { detail: { sessionId } }),
	);
}

export function onSessionReloaded(callback: (detail: SessionReloadedDetail) => void): () => void {
	const handler = (event: Event) => {
		const custom = event as CustomEvent<SessionReloadedDetail>;
		if (custom.detail?.sessionId) callback(custom.detail);
	};
	window.addEventListener(SESSION_RELOADED_EVENT, handler);
	return () => window.removeEventListener(SESSION_RELOADED_EVENT, handler);
}

export async function reloadSessionAndNotify(sessionId: string): Promise<void> {
	await window.pi.sessions.reload(sessionId);
	emitSessionReloaded(sessionId);
}
