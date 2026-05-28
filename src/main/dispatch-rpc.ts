import type { AgentSession, RpcCommand, RpcResponse } from "@earendil-works/pi-coding-agent";

type SuccessData<T extends RpcCommand["type"]> =
	Extract<RpcResponse, { command: T; success: true }> extends { data: infer D } ? D : undefined;

function ok<T extends RpcCommand["type"]>(
	id: string | undefined,
	command: T,
	data?: SuccessData<T>,
): RpcResponse {
	if (data === undefined) {
		return { id, type: "response", command, success: true } as RpcResponse;
	}
	return { id, type: "response", command, success: true, data } as RpcResponse;
}

function fail(id: string | undefined, command: string, message: string): RpcResponse {
	return { id, type: "response", command, success: false, error: message };
}

/**
 * Translate a structured RpcCommand into a direct AgentSession call.
 * No serialization or process boundary involved — this runs in-process.
 *
 * Mirrors packages/coding-agent/src/modes/rpc/rpc-mode.ts handleCommand,
 * but minus the stdio I/O layer.
 */
export async function dispatchRpc(session: AgentSession, cmd: RpcCommand): Promise<RpcResponse> {
	const id = cmd.id;
	try {
		switch (cmd.type) {
			case "prompt": {
				void session
					.prompt(cmd.message, {
						images: cmd.images,
						streamingBehavior: cmd.streamingBehavior,
						source: "rpc",
					})
					.catch(() => undefined);
				return ok(id, "prompt");
			}

			case "steer": {
				await session.steer(cmd.message, cmd.images);
				return ok(id, "steer");
			}

			case "follow_up": {
				await session.followUp(cmd.message, cmd.images);
				return ok(id, "follow_up");
			}

			case "abort": {
				await session.abort();
				return ok(id, "abort");
			}

			case "get_state": {
				return ok(id, "get_state", {
					model: session.model,
					thinkingLevel: session.thinkingLevel,
					isStreaming: session.isStreaming,
					isCompacting: session.isCompacting,
					steeringMode: session.steeringMode,
					followUpMode: session.followUpMode,
					sessionFile: session.sessionFile,
					sessionId: session.sessionId,
					sessionName: session.sessionName,
					autoCompactionEnabled: session.autoCompactionEnabled,
					messageCount: session.messages.length,
					pendingMessageCount: session.pendingMessageCount,
				});
			}

			case "set_model": {
				const models = await session.modelRegistry.getAvailable();
				const model = models.find((m) => m.provider === cmd.provider && m.id === cmd.modelId);
				if (!model) {
					return fail(id, "set_model", `Model not found: ${cmd.provider}/${cmd.modelId}`);
				}
				await session.setModel(model);
				return ok(id, "set_model", model);
			}

			case "cycle_model": {
				const result = await session.cycleModel();
				return ok(id, "cycle_model", result ?? null);
			}

			case "get_available_models": {
				const models = await session.modelRegistry.getAvailable();
				return ok(id, "get_available_models", { models });
			}

			case "set_thinking_level": {
				session.setThinkingLevel(cmd.level);
				return ok(id, "set_thinking_level");
			}

			case "cycle_thinking_level": {
				const level = session.cycleThinkingLevel();
				return ok(id, "cycle_thinking_level", level ? { level } : null);
			}

			case "set_steering_mode": {
				session.setSteeringMode(cmd.mode);
				return ok(id, "set_steering_mode");
			}

			case "set_follow_up_mode": {
				session.setFollowUpMode(cmd.mode);
				return ok(id, "set_follow_up_mode");
			}

			case "compact": {
				const result = await session.compact(cmd.customInstructions);
				return ok(id, "compact", result);
			}

			case "set_auto_compaction": {
				session.setAutoCompactionEnabled(cmd.enabled);
				return ok(id, "set_auto_compaction");
			}

			case "set_auto_retry": {
				session.setAutoRetryEnabled(cmd.enabled);
				return ok(id, "set_auto_retry");
			}

			case "abort_retry": {
				session.abortRetry();
				return ok(id, "abort_retry");
			}

			case "bash": {
				const result = await session.executeBash(cmd.command);
				return ok(id, "bash", result);
			}

			case "abort_bash": {
				session.abortBash();
				return ok(id, "abort_bash");
			}

			case "get_session_stats": {
				return ok(id, "get_session_stats", session.getSessionStats());
			}

			case "export_html": {
				const path = await session.exportToHtml(cmd.outputPath);
				return ok(id, "export_html", { path });
			}

			case "get_last_assistant_text": {
				return ok(id, "get_last_assistant_text", {
					text: session.getLastAssistantText() ?? null,
				});
			}

			case "set_session_name": {
				const name = cmd.name.trim();
				if (!name) return fail(id, "set_session_name", "Session name cannot be empty");
				session.setSessionName(name);
				return ok(id, "set_session_name");
			}

			case "get_messages": {
				return ok(id, "get_messages", { messages: session.messages });
			}

			case "get_fork_messages": {
				return ok(id, "get_fork_messages", {
					messages: session.getUserMessagesForForking(),
				});
			}

			case "new_session":
			case "switch_session":
			case "fork":
			case "clone":
			case "get_commands": {
				return fail(
					id,
					cmd.type,
					`Command "${cmd.type}" is handled by the desktop session registry, not by dispatchRpc`,
				);
			}

			default: {
				const exhaustive: never = cmd;
				return fail(id, (exhaustive as { type: string }).type, "Unknown command");
			}
		}
	} catch (err) {
		return fail(id, cmd.type, err instanceof Error ? err.message : String(err));
	}
}
