import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "./SettingsDialog";

const mockPi = (window as any).pi;

/** Helper: render and wait for async effects to settle. */
async function renderOpen() {
	await act(async () => {
		render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
	});
}

describe("SettingsDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders nothing when closed", () => {
		render(<SettingsDialog open={false} onOpenChange={vi.fn()} />);
		expect(screen.queryByText("Provider Settings")).not.toBeInTheDocument();
	});

	it("renders dialog when open", async () => {
		mockPi.auth.list.mockResolvedValue([]);
		mockPi.auth.knownProviders.mockResolvedValue(["anthropic", "openai"]);

		await renderOpen();
		expect(screen.getByText("Provider Settings")).toBeInTheDocument();
	});

	it("fetches providers on open", async () => {
		mockPi.auth.list.mockResolvedValue([]);
		mockPi.auth.knownProviders.mockResolvedValue(["anthropic"]);

		await renderOpen();

		// Both list and knownProviders should be called
		expect(mockPi.auth.list).toHaveBeenCalled();
		expect(mockPi.auth.knownProviders).toHaveBeenCalled();
	});

	it("shows empty state when no providers configured", async () => {
		mockPi.auth.list.mockResolvedValue([]);
		mockPi.auth.knownProviders.mockResolvedValue(["anthropic"]);

		await renderOpen();

		// Wait for loading to complete
		expect(await screen.findByText("No credentials configured yet.")).toBeInTheDocument();
	});

	it("shows configured providers", async () => {
		mockPi.auth.list.mockResolvedValue([
			{ provider: "anthropic", type: "api_key", maskedKey: "sk-a…5678" },
		]);
		mockPi.auth.knownProviders.mockResolvedValue([]);

		await renderOpen();

		expect(await screen.findByText("Anthropic")).toBeInTheDocument();
		expect(screen.getByText("sk-a…5678")).toBeInTheDocument();
	});

	it("shows OAuth badge for oauth providers", async () => {
		mockPi.auth.list.mockResolvedValue([{ provider: "anthropic", type: "oauth" }]);
		mockPi.auth.knownProviders.mockResolvedValue([]);

		await renderOpen();

		expect(await screen.findByText("OAuth")).toBeInTheDocument();
	});

	it("shows API key badge for api_key providers", async () => {
		mockPi.auth.list.mockResolvedValue([
			{ provider: "openai", type: "api_key", maskedKey: "sk-o…7890" },
		]);
		mockPi.auth.knownProviders.mockResolvedValue([]);

		await renderOpen();

		expect(await screen.findByText("API key")).toBeInTheDocument();
	});

	it("removes provider on delete click", async () => {
		const user = userEvent.setup();
		mockPi.auth.list.mockResolvedValue([
			{ provider: "openai", type: "api_key", maskedKey: "sk-test" },
		]);
		mockPi.auth.knownProviders.mockResolvedValue([]);
		mockPi.auth.remove.mockResolvedValue(undefined);

		await renderOpen();

		// Wait for provider to render
		await screen.findByText("OpenAI");

		// Click remove button
		const removeButton = screen.getByLabelText("Remove");
		await user.click(removeButton);

		expect(mockPi.auth.remove).toHaveBeenCalledWith("openai");
	});

	it("shows custom models hint with docs link", async () => {
		mockPi.auth.list.mockResolvedValue([]);
		mockPi.auth.knownProviders.mockResolvedValue(["anthropic"]);

		await renderOpen();

		expect(await screen.findByText(/models\.json/)).toBeInTheDocument();
		expect(screen.getByText("Docs")).toBeInTheDocument();
	});
});
