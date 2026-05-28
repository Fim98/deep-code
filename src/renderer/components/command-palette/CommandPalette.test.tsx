import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";

const mockPi = (window as any).pi;

const defaultProps = {
	open: true,
	onOpenChange: vi.fn(),
	workspaces: [
		{ id: "ws-1", name: "Project Alpha", path: "/Users/test/projects/alpha", addedAt: 1 },
		{ id: "ws-2", name: "Project Beta", path: "/Users/test/projects/beta", addedAt: 2 },
	],
	activeWorkspaceId: "ws-1",
	sessions: [
		{
			path: "/a/session1.json",
			id: "pi-s1",
			cwd: "/a",
			name: "Debug session",
			created: 1,
			modified: 2,
			messageCount: 5,
			firstMessage: "Fix the bug",
		},
		{
			path: "/a/session2.json",
			id: "pi-s2",
			cwd: "/a",
			name: undefined,
			created: 1,
			modified: 1,
			messageCount: 2,
			firstMessage: "Hello world",
		},
	],
	activeSessionId: "session-1",
	activePiSessionId: "pi-s1",
	bashOpen: false,
	settingsOpen: false,
	onSelectWorkspace: vi.fn(),
	onAddWorkspace: vi.fn(),
	onOpenSession: vi.fn(),
	onToggleBash: vi.fn(),
	onToggleSettings: vi.fn(),
};

describe("CommandPalette", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default mock responses
		mockPi.rpc.send.mockImplementation((_sid: string, cmd: { type: string }) => {
			if (cmd.type === "get_available_models") {
				return Promise.resolve({
					success: true,
					command: "get_available_models",
					data: {
						models: [
							{ id: "gpt-4o", name: "GPT-4o", provider: "openai" },
							{ id: "claude-sonnet-4-20250514", name: "Claude Sonnet", provider: "anthropic" },
						],
					},
				});
			}
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
			return Promise.resolve({ success: true });
		});
	});

	it("renders nothing when closed", () => {
		render(<CommandPalette {...defaultProps} open={false} />);
		expect(screen.queryByPlaceholderText(/command or search/i)).not.toBeInTheDocument();
	});

	it("renders search input when open", async () => {
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});
		expect(screen.getByPlaceholderText(/command or search/i)).toBeInTheDocument();
	});

	it("shows workspace group with all workspaces", async () => {
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});
		expect(screen.getByText("Project Alpha")).toBeInTheDocument();
		expect(screen.getByText("Project Beta")).toBeInTheDocument();
	});

	it("shows sessions for the active workspace", async () => {
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});
		expect(screen.getByText("Debug session")).toBeInTheDocument();
	});

	it("shows UI toggle items", async () => {
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});
		expect(screen.getByText("Show bash panel")).toBeInTheDocument();
		expect(screen.getByText("Open settings")).toBeInTheDocument();
	});

	it("shows theme options", async () => {
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});
		expect(screen.getByText("Theme: System")).toBeInTheDocument();
		expect(screen.getByText("Theme: Light")).toBeInTheDocument();
		expect(screen.getByText("Theme: Dark")).toBeInTheDocument();
	});

	it("filters items by fuzzy search", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});

		const input = screen.getByPlaceholderText(/command or search/i);
		await user.type(input, "debug");

		// highlightMatch splits text into spans, so we use a function matcher
		// to find a button whose text content includes "Debug session"
		const buttons = screen.getAllByRole("button");
		const debugBtn = buttons.find((b) => b.textContent?.includes("Debug session"));
		expect(debugBtn).toBeDefined();

		// "Project Beta" should be filtered out
		const betaBtn = buttons.find((b) => b.textContent?.includes("Project Beta"));
		expect(betaBtn).toBeUndefined();
	});

	it("shows no results message for unmatched query", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});

		const input = screen.getByPlaceholderText(/command or search/i);
		await user.type(input, "zzzzzzzzz");

		expect(screen.getByText(/No results/)).toBeInTheDocument();
	});

	it("calls onSelectWorkspace when clicking a workspace item", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});

		await user.click(screen.getByText("Project Beta"));

		expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
		expect(defaultProps.onSelectWorkspace).toHaveBeenCalledWith("ws-2");
	});

	it("calls onAddWorkspace when clicking Add workspace", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});

		await user.click(screen.getByText("Add workspace…"));

		expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
		expect(defaultProps.onAddWorkspace).toHaveBeenCalled();
	});

	it("calls onOpenSession for new session", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});

		await user.click(screen.getByText("New session"));

		expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
		expect(defaultProps.onOpenSession).toHaveBeenCalledWith();
	});

	it("calls onToggleBash when toggling bash panel", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});

		await user.click(screen.getByText("Show bash panel"));

		expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
		expect(defaultProps.onToggleBash).toHaveBeenCalled();
	});

	it("supports keyboard navigation with ArrowDown + Enter", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});

		// Focus the input, then use ArrowDown + Enter for keyboard nav
		await user.keyboard("{ArrowDown}");
		await user.keyboard("{ArrowDown}");
		await user.keyboard("{Enter}");

		// Should have called onOpenChange(false) (the action closes the palette)
		expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
	});

	it("fetches models and commands on open", async () => {
		await act(async () => {
			render(<CommandPalette {...defaultProps} />);
		});

		// Wait for async RPC calls to settle
		await act(async () => {
			await new Promise((r) => setTimeout(r, 50));
		});

		expect(mockPi.rpc.send).toHaveBeenCalledWith("session-1", { type: "get_available_models" });
		expect(mockPi.rpc.send).toHaveBeenCalledWith("session-1", { type: "get_commands" });

		// Models should appear as items
		expect(screen.getByText(/GPT-4o/)).toBeInTheDocument();
		expect(screen.getByText(/Claude Sonnet/)).toBeInTheDocument();

		// Commands should appear
		expect(screen.getByText("/help")).toBeInTheDocument();
		expect(screen.getByText("/compact")).toBeInTheDocument();
	});

	it("does not fetch models when no active session", async () => {
		await act(async () => {
			render(<CommandPalette {...defaultProps} activeSessionId={null} />);
		});

		// get_available_models should NOT be called
		const calls = mockPi.rpc.send.mock.calls;
		const modelCalls = calls.filter((c: any[]) => c[1]?.type === "get_available_models");
		expect(modelCalls).toHaveLength(0);
	});
});
