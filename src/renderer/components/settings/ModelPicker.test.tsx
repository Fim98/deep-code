import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessions } from "@/stores/session-state";
import { ModelPicker } from "./ModelPicker";

const mockPi = (window as any).pi;

describe("ModelPicker", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useSessions.setState({ bySession: {}, currentSessionId: null });
	});

	it("renders with model label when model is provided", () => {
		render(
			<ModelPicker
				sessionId="s1"
				model={{ id: "claude-sonnet-4-20250514", name: "Claude Sonnet", provider: "anthropic" }}
				thinkingLevel="off"
			/>,
		);
		expect(screen.getByText("anthropic/claude-sonnet-4-20250514")).toBeInTheDocument();
	});

	it("renders 'Select model' when no model provided", () => {
		render(<ModelPicker sessionId="s1" />);
		expect(screen.getByText("Select model")).toBeInTheDocument();
	});

	it("shows thinking level badge when not off", () => {
		render(
			<ModelPicker
				sessionId="s1"
				model={{ id: "gpt-4o", name: "GPT-4o", provider: "openai" }}
				thinkingLevel="high"
			/>,
		);
		expect(screen.getByText("high")).toBeInTheDocument();
	});

	it("does not show thinking badge when level is off", () => {
		render(
			<ModelPicker
				sessionId="s1"
				model={{ id: "gpt-4o", name: "GPT-4o", provider: "openai" }}
				thinkingLevel="off"
			/>,
		);
		expect(screen.queryByText("off")).not.toBeInTheDocument();
	});

	it("opens popover and fetches models on click", async () => {
		const user = userEvent.setup();
		mockPi.rpc.send.mockResolvedValue({
			success: true,
			command: "get_available_models",
			data: {
				models: [
					{ id: "gpt-4o", name: "GPT-4o", provider: "openai" },
					{ id: "claude-sonnet-4-20250514", name: "Claude Sonnet", provider: "anthropic" },
				],
			},
		});

		render(
			<ModelPicker sessionId="s1" model={{ id: "gpt-4o", name: "GPT-4o", provider: "openai" }} />,
		);

		await user.click(screen.getByText("openai/gpt-4o"));

		expect(mockPi.rpc.send).toHaveBeenCalledWith("s1", { type: "get_available_models" });
		// After opening, the search input should be visible
		expect(screen.getByLabelText("Search models")).toBeInTheDocument();
	});

	it("displays empty state when no models available", async () => {
		const user = userEvent.setup();
		mockPi.rpc.send.mockResolvedValue({
			success: true,
			command: "get_available_models",
			data: { models: [] },
		});

		render(<ModelPicker sessionId="s1" />);
		await user.click(screen.getByText("Select model"));

		expect(screen.getByText(/auth\.json/)).toBeInTheDocument();
	});
});
