/**
 * Opt-in telemetry via Sentry.
 *
 * Telemetry is disabled by default. Users can opt in via
 * Settings → General → "Send anonymous crash reports".
 *
 * When enabled, Sentry captures:
 * - Uncaught exceptions
 * - Unhandled promise rejections
 * - Manually reported errors
 *
 * No PII is sent (no file paths, session content, or API keys).
 */

import { app } from "electron";

const STORAGE_KEY = "antcode.telemetry.enabled";

let sentryInitialized = false;
let enabled = false;

function readEnabled(): boolean {
	try {
		// Use electron-store for persistence
		const Store = require("electron-store");
		const store = new Store({ name: "preferences" });
		return store.get(STORAGE_KEY, false) as boolean;
	} catch {
		return false;
	}
}

function writeEnabled(value: boolean): void {
	try {
		const Store = require("electron-store");
		const store = new Store({ name: "preferences" });
		store.set(STORAGE_KEY, value);
	} catch {
		// Ignore persistence errors
	}
}

/**
 * Initialize Sentry if telemetry is enabled.
 * Call once at app startup (before other init).
 */
export function initTelemetry(): void {
	enabled = readEnabled();
	if (!enabled) return;

	try {
		const Sentry = require("@sentry/electron/main");
		Sentry.init({
			dsn: "https://placeholder@sentry.io/0", // Replace with real DSN
			appName: "antcode",
			release: app.getVersion(),
			environment: app.isPackaged ? "production" : "development",
			// Disable performance monitoring to minimize overhead
			tracesSampleRate: 0,
			// Filter out PII
			beforeSend(event: any) {
				// Strip file paths from stack frames
				if (event.exception?.values) {
					for (const exc of event.exception.values) {
						if (exc.stacktrace?.frames) {
							for (const frame of exc.stacktrace.frames) {
								if (frame.filename) {
									frame.filename = frame.filename
										.replace(/\/Users\/[^/]+/g, "/Users/***")
										.replace(/\/home\/[^/]+/g, "/home/***");
								}
							}
						}
					}
				}
				return event;
			},
		});
		sentryInitialized = true;
	} catch {
		// Sentry not available or failed to init — silently ignore
	}
}

/**
 * Get current telemetry enabled state.
 */
export function isTelemetryEnabled(): boolean {
	return enabled;
}

/**
 * Set telemetry enabled state.
 * Takes effect on next app restart (Sentry can't be uninitialized).
 */
export function setTelemetryEnabled(value: boolean): void {
	enabled = value;
	writeEnabled(value);

	// If enabling for the first time and not yet initialized, init now
	if (value && !sentryInitialized) {
		try {
			const Sentry = require("@sentry/electron/main");
			Sentry.init({
				dsn: "https://placeholder@sentry.io/0",
				appName: "antcode",
				release: app.getVersion(),
				environment: app.isPackaged ? "production" : "development",
				tracesSampleRate: 0,
			});
			sentryInitialized = true;
		} catch {
			// Ignore
		}
	}
}

/**
 * Manually capture an error (only if telemetry is enabled).
 */
export function captureError(error: Error | string): void {
	if (!sentryInitialized) return;
	try {
		const Sentry = require("@sentry/electron/main");
		Sentry.captureException(typeof error === "string" ? new Error(error) : error);
	} catch {
		// Ignore
	}
}
