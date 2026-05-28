import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearLogs, getLogs, logError } from "./error-log";

describe("error-log", () => {
	beforeEach(() => {
		clearLogs();
	});

	afterEach(() => {
		clearLogs();
	});

	it("starts empty", () => {
		expect(getLogs()).toEqual([]);
	});

	it("logs an Error object", () => {
		logError("test", new Error("something broke"));
		const logs = getLogs();
		expect(logs).toHaveLength(1);
		expect(logs[0].source).toBe("test");
		expect(logs[0].message).toBe("something broke");
		expect(logs[0].stack).toBeDefined();
		expect(logs[0].timestamp).toBeGreaterThan(0);
	});

	it("logs a string error", () => {
		logError("auth", "API key missing");
		const logs = getLogs();
		expect(logs).toHaveLength(1);
		expect(logs[0].message).toBe("API key missing");
		expect(logs[0].stack).toBeUndefined();
	});

	it("logs a non-Error object as JSON", () => {
		logError("settings", { code: 42, reason: "invalid" });
		const logs = getLogs();
		expect(logs).toHaveLength(1);
		expect(logs[0].message).toBe('{"code":42,"reason":"invalid"}');
	});

	it("logs multiple entries in order", () => {
		logError("a", "first");
		logError("b", "second");
		logError("c", "third");
		const logs = getLogs();
		expect(logs).toHaveLength(3);
		expect(logs.map((l) => l.message)).toEqual(["first", "second", "third"]);
	});

	it("returns a defensive copy from getLogs", () => {
		logError("x", "entry");
		const a = getLogs();
		const b = getLogs();
		expect(a).not.toBe(b);
		expect(a).toEqual(b);
	});

	it("clearLogs empties the buffer", () => {
		logError("x", "entry");
		expect(getLogs()).toHaveLength(1);
		clearLogs();
		expect(getLogs()).toHaveLength(0);
	});

	it("caps at 500 entries (ring buffer)", () => {
		for (let i = 0; i < 510; i++) {
			logError("flood", `msg-${i}`);
		}
		const logs = getLogs();
		expect(logs.length).toBeLessThanOrEqual(500);
		// Oldest entries should be evicted; newest should survive
		expect(logs[logs.length - 1].message).toBe("msg-509");
	});
});
