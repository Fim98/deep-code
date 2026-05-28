/**
 * Plan Tracker Tool
 *
 * Custom tool registered via createAgentSession({ customTools }).
 * The LLM calls plan_tracker to manage implementation plan progress.
 * State is returned in tool result `details` for branching support.
 */

import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { type Static, Type } from "typebox";

/**
 * Creates a string enum schema compatible with LLM providers
 * that don't support anyOf/const patterns.
 */
function StringEnum<T extends readonly string[]>(values: T, options?: { description?: string }) {
	return Type.Unsafe<T[number]>({
		type: "string",
		enum: values as any,
		...(options?.description && { description: options.description }),
	});
}

import {
	handleClear,
	handleInit,
	handleStatus,
	handleUpdate,
	type PlanTrackerDetails,
	type Task,
	type TaskStatus,
} from "./plan-tracker-core.js";

const PlanTrackerParams = Type.Object({
	action: StringEnum(["init", "update", "status", "clear"] as const, {
		description: "Action to perform",
	}),
	tasks: Type.Optional(
		Type.Array(Type.String(), {
			description: "Task names (for init)",
		}),
	),
	index: Type.Optional(
		Type.Integer({
			minimum: 0,
			description: "Task index, 0-based (for update)",
		}),
	),
	status: Type.Optional(
		StringEnum(["pending", "in_progress", "complete"] as const, {
			description: "New status (for update)",
		}),
	),
});

export type PlanTrackerInput = Static<typeof PlanTrackerParams>;

export function createPlanTrackerTool(): ToolDefinition {
	let tasks: Task[] = [];

	return defineTool({
		name: "plan_tracker",
		label: "Plan Tracker",
		description:
			"Track implementation plan progress. Actions: init (set task list), update (change task status), status (show current state), clear (remove plan).",
		promptSnippet:
			"plan_tracker: Track implementation plan progress with init/update/status/clear actions",
		promptGuidelines: [
			"Use plan_tracker to track multi-step implementation plans",
			"Call init with all task names at the start of a plan",
			"Call update to mark tasks as in_progress or complete as you work",
			"Call status to check current progress",
			"Call clear when the plan is fully done or abandoned",
		],
		parameters: PlanTrackerParams,

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			let result: { text: string; tasks: Task[]; error?: string };

			switch (params.action) {
				case "init": {
					result = handleInit(params.tasks);
					if (!result.error) {
						tasks = result.tasks;
					}
					break;
				}
				case "update": {
					result = handleUpdate(tasks, params.index, params.status as TaskStatus | undefined);
					tasks = result.tasks;
					break;
				}
				case "status": {
					result = handleStatus(tasks);
					break;
				}
				case "clear": {
					result = handleClear(tasks);
					tasks = result.tasks;
					break;
				}
				default:
					result = {
						text: `Unknown action: ${params.action}`,
						tasks: [...tasks],
						error: "unknown action",
					};
			}

			const details: PlanTrackerDetails = {
				action: params.action,
				tasks: result.tasks,
				...(result.error ? { error: result.error } : {}),
			};

			return {
				content: [{ type: "text", text: result.text }],
				details,
			};
		},
	});
}
