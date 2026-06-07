import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolsPanel } from "./ToolsPanel";

const mockPi = window.pi as any;

const toolsData = {
	active: ["read"],
	tools: [
		{ name: "read", description: "Read files", sourceInfo: { source: "builtin" } },
		{ name: "bash", description: "Run shell commands", sourceInfo: { source: "builtin" } },
	],
};

describe("ToolsPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPi.sessions.getTools.mockResolvedValue(toolsData);
		mockPi.sessions.setActiveTools.mockImplementation((_sessionId: string, active: string[]) =>
			Promise.resolve({ ...toolsData, active }),
		);
	});

	it("asks for a session when sessionId is missing", () => {
		render(<ToolsPanel sessionId={null} />);
		expect(screen.getByText("Open a session to manage active pi tools.")).toBeInTheDocument();
	});

	it("shows available tools and their active state", async () => {
		await act(async () => {
			render(<ToolsPanel sessionId="s1" />);
		});

		expect(await screen.findByText("read")).toBeInTheDocument();
		expect(screen.getByText("bash")).toBeInTheDocument();
		expect(screen.getByText("Read files")).toBeInTheDocument();
		expect(screen.getByLabelText("Toggle read")).toHaveClass("bg-primary");
		expect(screen.getByLabelText("Toggle bash")).toHaveClass("bg-foreground/15");
	});

	it("toggles active tools", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<ToolsPanel sessionId="s1" />);
		});

		await user.click(await screen.findByLabelText("Toggle bash"));

		await waitFor(() => {
			expect(mockPi.sessions.setActiveTools).toHaveBeenCalledWith("s1", ["read", "bash"]);
		});
	});

	it("applies tool presets", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<ToolsPanel sessionId="s1" />);
		});

		await user.click(await screen.findByText("Read only"));
		expect(mockPi.sessions.setActiveTools).toHaveBeenLastCalledWith("s1", [
			"read",
			"grep",
			"find",
			"ls",
		]);

		await user.click(screen.getByText("None"));
		expect(mockPi.sessions.setActiveTools).toHaveBeenLastCalledWith("s1", []);

		await user.click(screen.getByText("Default"));
		expect(mockPi.sessions.setActiveTools).toHaveBeenLastCalledWith("s1", [
			"read",
			"bash",
			"edit",
			"write",
		]);
	});
});
