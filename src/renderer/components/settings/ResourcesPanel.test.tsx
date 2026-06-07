import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResourcesPanel } from "./ResourcesPanel";

const mockPi = window.pi as any;

describe("ResourcesPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPi.resources.paths.mockResolvedValue({
			global: { prompts: "/tmp/agent/prompts", skills: "/tmp/agent/skills" },
			project: { prompts: "/tmp/project/.pi/prompts", skills: "/tmp/project/.pi/skills" },
		});
		mockPi.resources.create.mockResolvedValue("/tmp/project/.pi/prompts/review-code.md");
		mockPi.shell.openPath.mockResolvedValue("");
		mockPi.sessions.getResources.mockResolvedValue({
			contextFiles: [],
			extensions: [],
			extensionErrors: [],
			skills: [],
			skillDiagnostics: [],
			prompts: [],
			promptDiagnostics: [],
			themes: [],
			themeDiagnostics: [],
		});
	});

	it("shows pi resource paths for the workspace", async () => {
		await act(async () => {
			render(<ResourcesPanel sessionId="s1" cwd="/tmp/project" />);
		});

		expect(await screen.findByText("Resource paths")).toBeInTheDocument();
		expect(screen.getByText("Global prompts")).toBeInTheDocument();
		expect(screen.getByText("Project prompts")).toBeInTheDocument();
		expect(screen.getByText("/tmp/project/.pi/prompts")).toBeInTheDocument();
	});

	it("defaults creation to project prompts and creates resources", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<ResourcesPanel sessionId="s1" cwd="/tmp/project" />);
		});

		expect(await screen.findByText("Target: /tmp/project/.pi/prompts")).toBeInTheDocument();

		await user.type(screen.getByPlaceholderText("summarize-code"), "review-code");
		await user.type(
			screen.getByPlaceholderText("Summarize changed files and call out risks"),
			"Review changed files",
		);
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(mockPi.resources.create).toHaveBeenCalledWith({
				cwd: "/tmp/project",
				scope: "project",
				kind: "prompts",
				name: "review-code",
				description: "Review changed files",
			});
		});
		expect(mockPi.shell.openPath).toHaveBeenCalledWith("/tmp/project/.pi/prompts/review-code.md");
	});

	it("switches placeholders and target path for skills", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<ResourcesPanel sessionId="s1" cwd="/tmp/project" />);
		});

		await user.click(screen.getByRole("button", { name: "skills" }));

		expect(screen.getByPlaceholderText("typescript-review")).toBeInTheDocument();
		expect(
			screen.getByPlaceholderText("Use when reviewing TypeScript or React code"),
		).toBeInTheDocument();
		expect(screen.getByText("Target: /tmp/project/.pi/skills")).toBeInTheDocument();
	});
});
