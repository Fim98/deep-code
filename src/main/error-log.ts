/**
 * In-memory ring buffer for application errors.
 *
 * Collects uncaught exceptions, unhandled rejections, and manually logged
 * errors (e.g. from settings/auth) so they can be inspected in the UI.
 */

export interface LogEntry {
	timestamp: number;
	source: string;
	message: string;
	stack?: string;
}

const MAX_ENTRIES = 500;
const buffer: LogEntry[] = [];

function push(entry: LogEntry) {
	buffer.push(entry);
	if (buffer.length > MAX_ENTRIES) buffer.shift();
}

function formatError(err: unknown): { message: string; stack?: string } {
	if (err instanceof Error) {
		return { message: err.message, stack: err.stack };
	}
	if (typeof err === "string") {
		return { message: err };
	}
	try {
		return { message: JSON.stringify(err) };
	} catch {
		return { message: String(err) };
	}
}

/** Manually log an error from any module (e.g. settings, auth). */
export function logError(source: string, err: unknown): void {
	const { message, stack } = formatError(err);
	push({ timestamp: Date.now(), source, message, stack });
}

/** Retrieve all buffered log entries (oldest first). */
export function getLogs(): LogEntry[] {
	return [...buffer];
}

/** Clear all buffered log entries. */
export function clearLogs(): void {
	buffer.length = 0;
}

/** Install global handlers for uncaught exceptions and unhandled rejections. */
export function installErrorHandlers(): void {
	process.on("uncaughtException", (err) => {
		logError("main:uncaughtException", err);
	});
	process.on("unhandledRejection", (reason) => {
		logError("main:unhandledRejection", reason);
	});
}
