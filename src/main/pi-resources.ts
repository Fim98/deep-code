import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getSharedServices } from "./shared-services.js";

export type PiResourceScope = "global" | "project";
export type PiResourceKind = "prompts" | "skills";

export interface PiResourcePaths {
	global: Record<PiResourceKind, string>;
	project: Record<PiResourceKind, string>;
}

export interface CreatePiResourceOptions {
	cwd: string;
	scope: PiResourceScope;
	kind: PiResourceKind;
	name: string;
	description?: string;
}

function titleFromResourceName(name: string): string {
	return name
		.split("-")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function safeResourceName(name: string): string {
	const normalized = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
	if (!normalized) throw new Error("Resource name cannot be empty");
	return normalized.slice(0, 64);
}

export function getPiResourcePaths(cwd: string): PiResourcePaths {
	const { agentDir } = getSharedServices();
	return {
		global: {
			prompts: join(agentDir, "prompts"),
			skills: join(agentDir, "skills"),
		},
		project: {
			prompts: join(cwd, ".pi", "prompts"),
			skills: join(cwd, ".pi", "skills"),
		},
	};
}

export function ensurePiResourceDir(
	cwd: string,
	scope: PiResourceScope,
	kind: PiResourceKind,
): string {
	const path = getPiResourcePaths(cwd)[scope][kind];
	mkdirSync(path, { recursive: true });
	return path;
}

export function createPiResource(options: CreatePiResourceOptions): string {
	const name = safeResourceName(options.name);
	const description = options.description?.trim() || `Describe when to use ${name}`;
	const dir = ensurePiResourceDir(options.cwd, options.scope, options.kind);

	if (options.kind === "prompts") {
		const path = join(dir, `${name}.md`);
		if (existsSync(path)) throw new Error(`Prompt already exists: ${path}`);
		writeFileSync(
			path,
			`---\ndescription: ${JSON.stringify(description)}\nargument-hint: "[instructions]"\n---\n\n# /${name}\n\n${description}\n\n## Context\n\nUse any provided arguments as extra instructions:\n\n$ARGUMENTS\n\n## Task\n\nDescribe the concrete workflow this prompt should run. Keep the output structured and actionable.\n`,
			"utf-8",
		);
		return path;
	}

	const skillDir = join(dir, name);
	const path = join(skillDir, "SKILL.md");
	if (existsSync(path)) throw new Error(`Skill already exists: ${path}`);
	mkdirSync(skillDir, { recursive: true });
	writeFileSync(
		path,
		`---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n# ${titleFromResourceName(name)}\n\n## When to use\n\n${description}\n\n## Instructions\n\n- Read any relevant files before making changes.\n- Prefer small, focused edits.\n- Explain important tradeoffs and assumptions.\n- If this skill references helper files, use paths relative to this skill directory.\n\n## Examples\n\nUser: /skill:${name} <task details>\n\nAssistant: Apply this skill's workflow to the requested task.\n`,
		"utf-8",
	);
	return path;
}
