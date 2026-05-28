import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessions } from "@/stores/session-state";
import { Composer } from "./Composer";

const mockPi = (window as any).pi;

describe("Composer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useSessions.setState({ bySession: {}, currentSessionId: null });
		// Provide a session slice so the component has something to work with
		useSessions.setState({
			bySession: {
				"test-session": {
					messages: [],
					state: null,
					isStreaming: false,
					activeTools: {},
					pendingSubmissions: [],
					planTracker: { tasks: [] },
					queue: { steering: [], followUp: [] },
				},
			},
		});
	});

	it("renders textarea with prompt placeholder when not streaming", () => {
		render(<Composer sessionId="test-session" isStreaming={false} />);
		expect(screen.getByLabelText("Message")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("Ask pi anything...")).toBeInTheDocument();
	});

	it("renders textarea with steer placeholder when streaming", () => {
		render(<Composer sessionId="test-session" isStreaming={true} />);
		expect(screen.getByPlaceholderText("Steer the agent...")).toBeInTheDocument();
	});

	it("shows Send button text when not streaming", () => {
		render(<Composer sessionId="test-session" isStreaming={false} />);
		expect(screen.getByText("Send")).toBeInTheDocument();
	});

	it("shows Steer button text when streaming with text", async () => {
		const user = userEvent.setup();
		render(<Composer sessionId="test-session" isStreaming={true} />);
		const textarea = screen.getByLabelText("Message");
		await user.type(textarea, "go left");
		expect(screen.getByText("Steer")).toBeInTheDocument();
	});

	it("shows Abort button text when streaming and textarea is empty", () => {
		render(<Composer sessionId="test-session" isStreaming={true} />);
		expect(screen.getByText("Abort")).toBeInTheDocument();
	});

	it("sends prompt on submit when not streaming", async () => {
		const user = userEvent.setup();
		mockPi.rpc.send.mockResolvedValue({ success: true, command: "prompt" });

		render(<Composer sessionId="test-session" isStreaming={false} />);

		const textarea = screen.getByLabelText("Message");
		await user.type(textarea, "Hello world");
		await user.keyboard("{Enter}");

		expect(mockPi.rpc.send).toHaveBeenCalledWith("test-session", {
			type: "prompt",
			message: "Hello world",
		});
	});

	it("sends steer on submit when streaming", async () => {
		const user = userEvent.setup();
		mockPi.rpc.send.mockResolvedValue({ success: true, command: "steer" });

		render(<Composer sessionId="test-session" isStreaming={true} />);

		const textarea = screen.getByLabelText("Message");
		await user.type(textarea, "Go left");
		await user.keyboard("{Enter}");

		expect(mockPi.rpc.send).toHaveBeenCalledWith("test-session", {
			type: "steer",
			message: "Go left",
		});
	});

	it("sends abort when submitting empty text while streaming", async () => {
		const user = userEvent.setup();
		mockPi.rpc.send.mockResolvedValue({ success: true, command: "abort" });

		render(<Composer sessionId="test-session" isStreaming={true} />);

		const button = screen.getByText("Abort");
		await user.click(button);

		expect(mockPi.rpc.send).toHaveBeenCalledWith("test-session", { type: "abort" });
	});

	it("does not send on Shift+Enter (newline)", async () => {
		const user = userEvent.setup();

		render(<Composer sessionId="test-session" isStreaming={false} />);

		const textarea = screen.getByLabelText("Message");
		await user.type(textarea, "Hello");
		await user.keyboard("{Shift>}{Enter}{/Shift}");

		// Should not have sent anything
		expect(mockPi.rpc.send).not.toHaveBeenCalled();
	});

	it("does not submit when text is empty and not streaming", async () => {
		const _user = userEvent.setup();

		render(<Composer sessionId="test-session" isStreaming={false} />);

		// Button should be disabled
		const button = screen.getByText("Send");
		expect(button.closest("button")).toBeDisabled();
	});

	it("clears textarea after successful submit", async () => {
		const user = userEvent.setup();
		mockPi.rpc.send.mockResolvedValue({ success: true, command: "prompt" });

		render(<Composer sessionId="test-session" isStreaming={false} />);

		const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
		await user.type(textarea, "Hello");
		await user.keyboard("{Enter}");

		expect(textarea.value).toBe("");
	});
});
