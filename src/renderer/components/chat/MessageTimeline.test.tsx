import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ChatMessage, useSessions } from "@/stores/session-state";
import { MessageTimeline } from "./MessageTimeline";

const mockPi = window.pi as any;

function setSession(messages: ChatMessage[], activeTools = {}) {
	useSessions.setState({
		bySession: {
			s1: {
				messages,
				state: null,
				isStreaming: Object.keys(activeTools).length > 0,
				activeTools,
				pendingSubmissions: [],
				planTracker: { tasks: [] },
				queue: { steering: [], followUp: [] },
			},
		},
		currentSessionId: "s1",
	});
}

describe("MessageTimeline", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPi.rpc.send.mockResolvedValue({
			success: true,
			command: "get_fork_messages",
			data: { messages: [] },
		});
		useSessions.setState({ bySession: {}, currentSessionId: null });
	});

	it("renders pi-style transcript entries in message order", async () => {
		setSession([
			{ role: "user", content: "Please inspect src/app.ts", timestamp: 1 },
			{
				role: "assistant",
				timestamp: 2,
				content: [
					{ type: "text", text: "I'll read the file first." },
					{ type: "thinking", thinking: "Need to inspect the implementation." },
					{ type: "toolCall", id: "tool-1", name: "read", arguments: { path: "src/app.ts" } },
				],
			},
			{
				role: "toolResult",
				toolCallId: "tool-1",
				toolName: "read",
				content: [{ type: "text", text: "export function app() {}" }],
				isError: false,
				timestamp: 3,
			},
			{
				role: "assistant",
				timestamp: 4,
				content: [{ type: "text", text: "The file is small and safe." }],
			},
		]);

		render(<MessageTimeline sessionId="s1" />);

		await screen.findByText("Please inspect src/app.ts");
		const text = document.body.textContent ?? "";
		expect(text.indexOf("Please inspect src/app.ts")).toBeLessThan(
			text.indexOf("I'll read the file first."),
		);
		expect(text.indexOf("I'll read the file first.")).toBeLessThan(text.indexOf("Thinking"));
		expect(text.indexOf("Thinking")).toBeLessThan(text.indexOf("tool-1"));
		expect(text.indexOf("tool-1")).toBeLessThan(text.indexOf("export function app() {}"));
		expect(text.indexOf("export function app() {}")).toBeLessThan(
			text.indexOf("The file is small and safe."),
		);
	});

	it("shows tool results even when they are claimed by assistant tool calls", async () => {
		setSession([
			{
				role: "assistant",
				timestamp: 1,
				content: [{ type: "toolCall", id: "tool-1", name: "grep", arguments: { pattern: "foo" } }],
			},
			{
				role: "toolResult",
				toolCallId: "tool-1",
				toolName: "grep",
				content: [{ type: "text", text: "src/a.ts:1:foo" }],
				isError: false,
				timestamp: 2,
			},
		]);

		render(<MessageTimeline sessionId="s1" />);

		expect(await screen.findByText("src/a.ts:1:foo")).toBeInTheDocument();
		expect(screen.getByText("result")).toBeInTheDocument();
	});

	it("renders live tools that have not appeared in the message stream yet", async () => {
		setSession([{ role: "user", content: "Run tests", timestamp: 1 }], {
			"tool-live": {
				toolCallId: "tool-live",
				toolName: "bash",
				args: { command: "npm test" },
				status: "running",
				updatedAt: Date.now(),
			},
		});

		render(<MessageTimeline sessionId="s1" />);

		expect(await screen.findByText("bash")).toBeInTheDocument();
		expect(screen.getByText("npm test")).toBeInTheDocument();
		expect(screen.getByText("live")).toBeInTheDocument();
	});

	it("renders diff previews from tool result details", async () => {
		setSession([
			{
				role: "toolResult",
				toolCallId: "edit-1",
				toolName: "edit",
				content: [{ type: "text", text: "Updated src/app.ts" }],
				isError: false,
				timestamp: 1,
				details: { diff: "@@ -1 +1 @@\n-old\n+new", firstChangedLine: 1 },
			},
		]);

		render(<MessageTimeline sessionId="s1" />);

		expect(await screen.findByText("Diff · +1 -1")).toBeInTheDocument();
		expect(screen.getByText("+new")).toBeInTheDocument();
		expect(screen.getByText("-old")).toBeInTheDocument();
		expect(screen.getByText("line 1")).toBeInTheDocument();
	});
});
