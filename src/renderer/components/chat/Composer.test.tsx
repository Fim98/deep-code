import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessions } from "@/stores/session-state";
import { Composer } from "./Composer";

const mockPi = (window as any).pi;

// Helper to create a mock image File
function createMockImageFile(name = "test.png", size = 1024, type = "image/png"): File {
	const data = new Uint8Array(size);
	return new File([data], name, { type });
}

// Mock FileReader to return a predictable data URL
const mockFileReaderResult = "data:image/png;base64,aGVsbG8=";

describe("Composer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useSessions.setState({ bySession: {}, currentSessionId: null });
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

		// Default mock: get_commands returns empty, other calls succeed
		mockPi.rpc.send.mockImplementation((_sid: string, cmd: { type: string }) => {
			if (cmd.type === "get_commands") {
				return Promise.resolve({
					success: true,
					command: "get_commands",
					data: { commands: [] },
				});
			}
			return Promise.resolve({ success: true, command: cmd.type });
		});

		// Mock FileReader for attachment previews
		class MockFileReader {
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			result: string | null = null;
			error: Error | null = null;
			readAsDataURL(_file: File) {
				this.result = mockFileReaderResult;
				setTimeout(() => this.onload?.(), 0);
			}
		}
		vi.stubGlobal("FileReader", MockFileReader);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// ── Basic rendering ──────────────────────────────────────────────────

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

	// ── Submit behavior ──────────────────────────────────────────────────

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
		mockPi.rpc.send.mockClear(); // clear mount-time get_commands call

		const textarea = screen.getByLabelText("Message");
		await user.type(textarea, "Hello");
		await user.keyboard("{Shift>}{Enter}{/Shift}");

		expect(mockPi.rpc.send).not.toHaveBeenCalled();
	});

	it("does not submit when text is empty and not streaming", () => {
		render(<Composer sessionId="test-session" isStreaming={false} />);
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

	// ── Attach button ────────────────────────────────────────────────────

	it("renders attach image button", () => {
		render(<Composer sessionId="test-session" isStreaming={false} />);
		expect(screen.getByLabelText("Attach image")).toBeInTheDocument();
	});

	it("has hidden file input with correct accept types", () => {
		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		const input = container.querySelector('input[type="file"]') as HTMLInputElement;
		expect(input).toBeTruthy();
		expect(input.accept).toContain("image/png");
		expect(input.accept).toContain("image/jpeg");
		expect(input.accept).toContain("image/gif");
		expect(input.accept).toContain("image/webp");
		expect(input.multiple).toBe(true);
	});

	// ── File input attachment ─────────────────────────────────────────────

	it("adds attachment chips when files selected via input", async () => {
		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		const input = container.querySelector('input[type="file"]') as HTMLInputElement;

		const file = createMockImageFile("screenshot.png", 2048);

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
			// Wait for FileReader async callback
			await new Promise((r) => setTimeout(r, 10));
		});

		expect(screen.getByText("screenshot.png")).toBeInTheDocument();
		expect(screen.getByText("2.0KB")).toBeInTheDocument();
	});

	// ── Clipboard paste ──────────────────────────────────────────────────

	it("adds attachment from clipboard paste", async () => {
		render(<Composer sessionId="test-session" isStreaming={false} />);
		const textarea = screen.getByLabelText("Message");

		const file = createMockImageFile("pasted-image.png", 4096);
		const clipboardData = {
			items: [
				{
					type: "image/png",
					getAsFile: () => file,
				},
			],
		};

		await act(async () => {
			fireEvent.paste(textarea, { clipboardData });
			await new Promise((r) => setTimeout(r, 10));
		});

		expect(screen.getByText("pasted-image.png")).toBeInTheDocument();
	});

	it("does not intercept paste when no image items", async () => {
		const _user = userEvent.setup();
		render(<Composer sessionId="test-session" isStreaming={false} />);
		const textarea = screen.getByLabelText("Message");

		// Normal text paste should work normally (no attachment)
		const clipboardData = {
			items: [
				{
					type: "text/plain",
					getAsFile: () => null,
				},
			],
		};

		await act(async () => {
			fireEvent.paste(textarea, { clipboardData });
		});

		// No attachment chips should appear
		expect(screen.queryByLabelText("Remove attachment")).not.toBeInTheDocument();
	});

	// ── Drag and drop ────────────────────────────────────────────────────

	it("shows drag overlay on dragOver", () => {
		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		const wrapper = container.firstElementChild!;

		fireEvent.dragOver(wrapper);

		expect(screen.getByText("Drop images here")).toBeInTheDocument();
	});

	it("hides drag overlay on dragLeave", () => {
		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		const wrapper = container.firstElementChild!;

		fireEvent.dragOver(wrapper);
		expect(screen.getByText("Drop images here")).toBeInTheDocument();

		fireEvent.dragLeave(wrapper);
		expect(screen.queryByText("Drop images here")).not.toBeInTheDocument();
	});

	it("adds attachment on drop", async () => {
		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		const wrapper = container.firstElementChild!;

		const file = createMockImageFile("dropped.png", 3072);

		await act(async () => {
			fireEvent.drop(wrapper, {
				dataTransfer: { files: [file] },
			});
			await new Promise((r) => setTimeout(r, 10));
		});

		expect(screen.getByText("dropped.png")).toBeInTheDocument();
	});

	// ── Remove attachment ────────────────────────────────────────────────

	it("removes attachment when X button clicked", async () => {
		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		const input = container.querySelector('input[type="file"]') as HTMLInputElement;

		const file = createMockImageFile("removeme.png", 1024);

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
			await new Promise((r) => setTimeout(r, 10));
		});

		expect(screen.getByText("removeme.png")).toBeInTheDocument();

		const removeBtn = screen.getByLabelText("Remove attachment");
		await act(async () => {
			fireEvent.click(removeBtn);
		});

		expect(screen.queryByText("removeme.png")).not.toBeInTheDocument();
	});

	// ── Submit with attachments ──────────────────────────────────────────

	it("sends images in RPC call when attachments present", async () => {
		const user = userEvent.setup();
		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		mockPi.rpc.send.mockClear(); // clear mount-time get_commands call
		mockPi.rpc.send.mockResolvedValue({ success: true, command: "prompt" });

		const input = container.querySelector('input[type="file"]') as HTMLInputElement;

		const file = createMockImageFile("photo.png", 2048);

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
			await new Promise((r) => setTimeout(r, 10));
		});

		// Type a message and submit
		const textarea = screen.getByLabelText("Message");
		await user.type(textarea, "Look at this");
		await user.keyboard("{Enter}");

		expect(mockPi.rpc.send).toHaveBeenCalledTimes(1);
		const callArgs = mockPi.rpc.send.mock.calls[0];
		expect(callArgs[0]).toBe("test-session");
		expect(callArgs[1].type).toBe("prompt");
		expect(callArgs[1].message).toBe("Look at this");
		expect(callArgs[1].images).toBeDefined();
		expect(callArgs[1].images).toHaveLength(1);
		expect(callArgs[1].images[0].type).toBe("image");
		expect(callArgs[1].images[0].mimeType).toBe("image/png");
		expect(callArgs[1].images[0].data).toBe("aGVsbG8="); // base64 from mock data URL
	});

	it("clears attachments after successful submit", async () => {
		const user = userEvent.setup();
		mockPi.rpc.send.mockResolvedValue({ success: true, command: "prompt" });

		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		const input = container.querySelector('input[type="file"]') as HTMLInputElement;

		await act(async () => {
			fireEvent.change(input, { target: { files: [createMockImageFile()] } });
			await new Promise((r) => setTimeout(r, 10));
		});

		expect(screen.getByLabelText("Remove attachment")).toBeInTheDocument();

		const textarea = screen.getByLabelText("Message");
		await user.type(textarea, "test");
		await user.keyboard("{Enter}");

		expect(screen.queryByLabelText("Remove attachment")).not.toBeInTheDocument();
	});

	// ── Non-image files rejected ─────────────────────────────────────────

	it("ignores non-image files dropped", async () => {
		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		const wrapper = container.firstElementChild!;

		const textFile = new File(["hello"], "readme.txt", { type: "text/plain" });

		await act(async () => {
			fireEvent.drop(wrapper, {
				dataTransfer: { files: [textFile] },
			});
			await new Promise((r) => setTimeout(r, 10));
		});

		expect(screen.queryByLabelText("Remove attachment")).not.toBeInTheDocument();
	});

	// ── Send button enabled with only attachments ────────────────────────

	it("enables send button when attachments present even without text", async () => {
		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		const input = container.querySelector('input[type="file"]') as HTMLInputElement;

		await act(async () => {
			fireEvent.change(input, { target: { files: [createMockImageFile()] } });
			await new Promise((r) => setTimeout(r, 10));
		});

		const sendButton = screen.getByText("Send").closest("button");
		expect(sendButton).not.toBeDisabled();
	});

	it("can submit with only attachments and no text", async () => {
		const user = userEvent.setup();
		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		mockPi.rpc.send.mockClear(); // clear mount-time get_commands call
		mockPi.rpc.send.mockResolvedValue({ success: true, command: "prompt" });

		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

		await act(async () => {
			fireEvent.change(fileInput, { target: { files: [createMockImageFile()] } });
			await new Promise((r) => setTimeout(r, 10));
		});

		// Focus the textarea first, then press Enter
		const textarea = screen.getByLabelText("Message");
		textarea.focus();
		await user.keyboard("{Enter}");

		expect(mockPi.rpc.send).toHaveBeenCalledTimes(1);
		const callArgs = mockPi.rpc.send.mock.calls[0];
		expect(callArgs[1].images).toHaveLength(1);
	});

	// ── Multiple attachments ─────────────────────────────────────────────

	it("supports multiple attachments", async () => {
		const { container } = render(<Composer sessionId="test-session" isStreaming={false} />);
		const input = container.querySelector('input[type="file"]') as HTMLInputElement;

		await act(async () => {
			fireEvent.change(input, {
				target: {
					files: [createMockImageFile("a.png"), createMockImageFile("b.jpg", 512, "image/jpeg")],
				},
			});
			await new Promise((r) => setTimeout(r, 10));
		});

		expect(screen.getByText("a.png")).toBeInTheDocument();
		expect(screen.getByText("b.jpg")).toBeInTheDocument();
	});

	// ── Slash commands ───────────────────────────────────────────────────

	it("fetches slash commands on mount", async () => {
		await act(async () => {
			render(<Composer sessionId="test-session" isStreaming={false} />);
			await new Promise((r) => setTimeout(r, 10));
		});

		const getCommandsCalls = mockPi.rpc.send.mock.calls.filter(
			(c: any[]) => c[1]?.type === "get_commands",
		);
		expect(getCommandsCalls.length).toBeGreaterThanOrEqual(1);
	});

	it("shows slash command popup when typing /", async () => {
		// Provide commands
		mockPi.rpc.send.mockImplementation((_sid: string, cmd: { type: string }) => {
			if (cmd.type === "get_commands") {
				return Promise.resolve({
					success: true,
					command: "get_commands",
					data: {
						commands: [
							{ name: "help", description: "Show help", source: "extension" },
							{ name: "compact", description: "Compact context", source: "extension" },
							{ name: "review", description: "Code review", source: "prompt" },
						],
					},
				});
			}
			return Promise.resolve({ success: true, command: cmd.type });
		});

		const user = userEvent.setup();
		render(<Composer sessionId="test-session" isStreaming={false} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 10));
		});

		const textarea = screen.getByLabelText("Message");
		await user.type(textarea, "/");

		// Slash command popup should be visible
		expect(screen.getByText("Slash commands")).toBeInTheDocument();
		expect(screen.getByText("help")).toBeInTheDocument();
		expect(screen.getByText("compact")).toBeInTheDocument();
		expect(screen.getByText("review")).toBeInTheDocument();
	});

	it("filters slash commands by query", async () => {
		mockPi.rpc.send.mockImplementation((_sid: string, cmd: { type: string }) => {
			if (cmd.type === "get_commands") {
				return Promise.resolve({
					success: true,
					command: "get_commands",
					data: {
						commands: [
							{ name: "help", description: "Show help", source: "extension" },
							{ name: "compact", description: "Compact context", source: "extension" },
							{ name: "review", description: "Code review", source: "prompt" },
						],
					},
				});
			}
			return Promise.resolve({ success: true, command: cmd.type });
		});

		const user = userEvent.setup();
		render(<Composer sessionId="test-session" isStreaming={false} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 10));
		});

		const textarea = screen.getByLabelText("Message");
		await user.type(textarea, "/com");

		// Only "compact" should match
		expect(screen.getByText("compact")).toBeInTheDocument();
		expect(screen.queryByText("help")).not.toBeInTheDocument();
	});

	it("selects slash command with Enter", async () => {
		mockPi.rpc.send.mockImplementation((_sid: string, cmd: { type: string }) => {
			if (cmd.type === "get_commands") {
				return Promise.resolve({
					success: true,
					command: "get_commands",
					data: {
						commands: [
							{ name: "help", description: "Show help", source: "extension" },
							{ name: "compact", description: "Compact context", source: "extension" },
						],
					},
				});
			}
			return Promise.resolve({ success: true, command: cmd.type });
		});

		const user = userEvent.setup();
		render(<Composer sessionId="test-session" isStreaming={false} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 10));
		});

		const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
		await user.type(textarea, "/");
		await user.keyboard("{Enter}");

		// Should have replaced text with "/help " (first command)
		expect(textarea.value).toBe("/help ");
		// Popup should be closed
		expect(screen.queryByText("Slash commands")).not.toBeInTheDocument();
	});

	it("hides slash popup when typing space after command", async () => {
		mockPi.rpc.send.mockImplementation((_sid: string, cmd: { type: string }) => {
			if (cmd.type === "get_commands") {
				return Promise.resolve({
					success: true,
					command: "get_commands",
					data: {
						commands: [{ name: "help", description: "Show help", source: "extension" }],
					},
				});
			}
			return Promise.resolve({ success: true, command: cmd.type });
		});

		const user = userEvent.setup();
		render(<Composer sessionId="test-session" isStreaming={false} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 10));
		});

		const textarea = screen.getByLabelText("Message");
		await user.type(textarea, "/help something");

		// Popup should not be visible (space means it's no longer a slash command)
		expect(screen.queryByText("Slash commands")).not.toBeInTheDocument();
	});
});
