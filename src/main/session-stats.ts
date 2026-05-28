/**
 * Scan all pi session JSONL files under ~/.pi/agent/sessions/
 * and aggregate token / cost / usage statistics per day and per model.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getSharedServices } from "./shared-services.js";

// ─── Public types ────────────────────────────────────────────────────────────

export interface ModelStat {
	cost: number;
	tokens: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	requests: number;
}

export interface DailyStat {
	date: string; // YYYY-MM-DD
	totalCost: number;
	totalTokens: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	requests: number;
	models: Record<string, ModelStat>;
}

export interface StatsResult {
	days: DailyStat[]; // sorted newest first
	totalCost: number;
	totalTokens: number;
	totalRequests: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCacheReadTokens: number;
	totalCacheWriteTokens: number;
	models: Record<string, ModelStat>; // aggregated across all days
	workspaces: string[]; // decoded workspace names
	sessionCount: number;
}

// ─── Implementation ──────────────────────────────────────────────────────────

interface Usage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
}

function emptyModelStat(): ModelStat {
	return {
		cost: 0,
		tokens: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		requests: 0,
	};
}

function addUsage(target: ModelStat, u: Usage): void {
	target.cost += u.cost.total;
	target.tokens += u.totalTokens;
	target.inputTokens += u.input;
	target.outputTokens += u.output;
	target.cacheReadTokens += u.cacheRead;
	target.cacheWriteTokens += u.cacheWrite;
	target.requests += 1;
}

/**
 * Try to extract the cwd from the first "session" entry in a JSONL file.
 * Falls back to the encoded directory name if the file can't be read.
 */
function extractCwdFromSession(filePath: string, fallbackDirName: string): string {
	try {
		const content = readFileSync(filePath, "utf-8");
		const firstLine = content.split("\n").find((l) => l.trim());
		if (firstLine) {
			const entry = JSON.parse(firstLine);
			if (entry.type === "session" && typeof entry.cwd === "string") {
				return entry.cwd;
			}
		}
	} catch {
		// ignore
	}
	// Fallback: rough decode (lossy for dirs with hyphens)
	return `/${fallbackDirName.replace(/^--/, "").replace(/--$/, "").replace(/-/g, "/")}`;
}

export function getSessionStats(): StatsResult {
	const { agentDir } = getSharedServices();
	const sessionsRoot = join(agentDir, "sessions");

	const dayMap = new Map<string, DailyStat>();
	const modelMap = new Map<string, ModelStat>();
	const workspaces = new Set<string>();
	let sessionCount = 0;
	let totalCost = 0;
	let totalTokens = 0;
	let totalRequests = 0;
	let totalInputTokens = 0;
	let totalOutputTokens = 0;
	let totalCacheReadTokens = 0;
	let totalCacheWriteTokens = 0;

	// Walk session directories
	let wsDirs: string[] = [];
	try {
		wsDirs = readdirSync(sessionsRoot).filter((d) => {
			try {
				return statSync(join(sessionsRoot, d)).isDirectory();
			} catch {
				return false;
			}
		});
	} catch {
		return {
			days: [],
			totalCost: 0,
			totalTokens: 0,
			totalRequests: 0,
			totalInputTokens: 0,
			totalOutputTokens: 0,
			totalCacheReadTokens: 0,
			totalCacheWriteTokens: 0,
			models: {},
			workspaces: [],
			sessionCount: 0,
		};
	}

	for (const wsDir of wsDirs) {
		const wsDirPath = join(sessionsRoot, wsDir);

		let jsonlFiles: string[];
		try {
			jsonlFiles = readdirSync(wsDirPath).filter((f) => f.endsWith(".jsonl"));
		} catch {
			continue;
		}

		for (const fileName of jsonlFiles) {
			sessionCount++;
			const filePath = join(wsDirPath, fileName);

			// Extract workspace cwd from session header
			const sessionCwd = extractCwdFromSession(filePath, wsDir);
			workspaces.add(sessionCwd);

			let content: string;
			try {
				content = readFileSync(filePath, "utf-8");
			} catch {
				continue;
			}

			for (const line of content.split("\n")) {
				if (!line.trim()) continue;
				let entry: any;
				try {
					entry = JSON.parse(line);
				} catch {
					continue;
				}

				if (entry.type !== "message") continue;
				const msg = entry.message;
				if (msg?.role !== "assistant") continue;
				const usage: Usage | undefined = msg.usage;
				if (!usage || usage.totalTokens === 0) continue;

				// Parse date from ISO timestamp
				const ts: string = entry.timestamp ?? "";
				const day = ts.slice(0, 10); // "YYYY-MM-DD"
				if (!day) continue;

				// Day aggregation
				let daily = dayMap.get(day);
				if (!daily) {
					daily = {
						date: day,
						totalCost: 0,
						totalTokens: 0,
						inputTokens: 0,
						outputTokens: 0,
						cacheReadTokens: 0,
						cacheWriteTokens: 0,
						requests: 0,
						models: {},
					};
					dayMap.set(day, daily);
				}

				daily.totalCost += usage.cost.total;
				daily.totalTokens += usage.totalTokens;
				daily.inputTokens += usage.input;
				daily.outputTokens += usage.output;
				daily.cacheReadTokens += usage.cacheRead;
				daily.cacheWriteTokens += usage.cacheWrite;
				daily.requests += 1;

				// Per-model in day
				const model = msg.model ?? "unknown";
				if (!daily.models[model]) daily.models[model] = emptyModelStat();
				addUsage(daily.models[model], usage);

				// Global model aggregation
				if (!modelMap.has(model)) modelMap.set(model, emptyModelStat());
				addUsage(modelMap.get(model)!, usage);

				// Grand totals
				totalCost += usage.cost.total;
				totalTokens += usage.totalTokens;
				totalRequests += 1;
				totalInputTokens += usage.input;
				totalOutputTokens += usage.output;
				totalCacheReadTokens += usage.cacheRead;
				totalCacheWriteTokens += usage.cacheWrite;
			}
		}
	}

	// Sort days newest first
	const days = Array.from(dayMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1));

	const models: Record<string, ModelStat> = {};
	for (const [name, stat] of modelMap) models[name] = stat;

	return {
		days,
		totalCost,
		totalTokens,
		totalRequests,
		totalInputTokens,
		totalOutputTokens,
		totalCacheReadTokens,
		totalCacheWriteTokens,
		models,
		workspaces: Array.from(workspaces).sort(),
		sessionCount,
	};
}
