import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "./SettingsDialog";

const mockPi = (window as any).pi;

describe("SettingsDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset mock implementations to defaults
		mockPi.auth.list.mockResolvedValue([]);
		mockPi.auth.knownProviders.mockResolvedValue([]);
		mockPi.settings.get.mockResolvedValue({
			defaultProvider: undefined,
			defaultModel: undefined,
			defaultThinkingLevel: "off",
			transport: "sse",
			steeringMode: "all",
			followUpMode: "all",
			theme: undefined,
			compactionEnabled: true,
			retryEnabled: true,
			hideThinkingBlock: false,
			showImages: true,
			imageAutoResize: true,
			blockImages: false,
			enabledModels: undefined,
			globalSettings: {},
			projectSettings: {},
		});
		mockPi.settings.agentDir.mockResolvedValue("/tmp/test-agent");
		mockPi.appInfo.version.mockResolvedValue("0.0.0-test");
	});

	it("renders nothing when closed", () => {
		render(<SettingsDialog open={false} onOpenChange={vi.fn()} />);
		expect(screen.queryByText("Settings")).not.toBeInTheDocument();
	});

	it("renders dialog with tab navigation when open", async () => {
		await act(async () => {
			render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
		});
		expect(screen.getByText("Settings")).toBeInTheDocument();
		// Tab buttons
		expect(screen.getByText("General")).toBeInTheDocument();
		expect(screen.getByText("Providers")).toBeInTheDocument();
		expect(screen.getByText("Models")).toBeInTheDocument();
		expect(screen.getByText("About")).toBeInTheDocument();
	});

	it("shows General tab by default", async () => {
		await act(async () => {
			render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
		});
		// General tab content
		expect(screen.getByText("Appearance")).toBeInTheDocument();
		expect(screen.getByText("AI Behavior")).toBeInTheDocument();
		expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
	});

	it("switches to Providers tab", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
		});

		await act(async () => {
			await user.click(screen.getByText("Providers"));
		});

		expect(await screen.findByText("Connected")).toBeInTheDocument();
	});

	it("switches to About tab", async () => {
		const user = userEvent.setup();
		await act(async () => {
			render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
		});

		await act(async () => {
			await user.click(screen.getByText("About"));
		});

		expect(await screen.findByText("antcode")).toBeInTheDocument();
		expect(screen.getByText("0.0.0-test")).toBeInTheDocument();
	});

	// ── Providers tab ─────────────────────────────────────────────────────

	describe("Providers tab", () => {
		async function openProvidersTab() {
			const user = userEvent.setup();
			await act(async () => {
				render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
			});
			await act(async () => {
				await user.click(screen.getByText("Providers"));
			});
		}

		it("shows empty state when no providers configured", async () => {
			mockPi.auth.list.mockResolvedValue([]);
			mockPi.auth.knownProviders.mockResolvedValue(["anthropic"]);

			await openProvidersTab();

			expect(await screen.findByText("No providers connected yet")).toBeInTheDocument();
		});

		it("shows configured providers", async () => {
			mockPi.auth.list.mockResolvedValue([
				{ provider: "anthropic", type: "api_key", maskedKey: "sk-a…5678" },
			]);
			mockPi.auth.knownProviders.mockResolvedValue([]);

			await openProvidersTab();

			expect(await screen.findByText("Anthropic")).toBeInTheDocument();
			expect(screen.getByText("sk-a…5678")).toBeInTheDocument();
		});

		it("shows API key badge for configured providers", async () => {
			mockPi.auth.list.mockResolvedValue([
				{ provider: "anthropic", type: "api_key", maskedKey: "sk-test" },
			]);
			mockPi.auth.knownProviders.mockResolvedValue([]);

			await openProvidersTab();

			expect(await screen.findByText("API key")).toBeInTheDocument();
		});

		it("removes provider on delete click", async () => {
			const user = userEvent.setup();
			mockPi.auth.list.mockResolvedValue([
				{ provider: "openai", type: "api_key", maskedKey: "sk-test" },
			]);
			mockPi.auth.knownProviders.mockResolvedValue([]);
			mockPi.auth.remove.mockResolvedValue(undefined);

			await openProvidersTab();

			await screen.findByText("OpenAI");

			const removeButtons = screen.getAllByLabelText("Remove");
			await user.click(removeButtons[0]!);

			expect(mockPi.auth.remove).toHaveBeenCalledWith("openai");
		});
	});

	// ── General tab ───────────────────────────────────────────────────────

	describe("General tab", () => {
		it("shows theme options", async () => {
			await act(async () => {
				render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
			});

			expect(screen.getByText("Theme")).toBeInTheDocument();
			expect(screen.getByText("System")).toBeInTheDocument();
			expect(screen.getByText("Light")).toBeInTheDocument();
			expect(screen.getByText("Dark")).toBeInTheDocument();
		});

		it("shows keyboard shortcuts", async () => {
			await act(async () => {
				render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
			});

			expect(screen.getByText("Command palette")).toBeInTheDocument();
			expect(screen.getByText("New session")).toBeInTheDocument();
			expect(screen.getByText("Toggle sidebar")).toBeInTheDocument();
		});

		it("shows auto-compaction toggle", async () => {
			await act(async () => {
				render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
			});

			expect(screen.getByText("Auto-compaction")).toBeInTheDocument();
		});
	});

	// ── Models tab ────────────────────────────────────────────────────────

	describe("Models tab", () => {
		it("shows enabled model filters", async () => {
			const user = userEvent.setup();
			await act(async () => {
				render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
			});

			await act(async () => {
				await user.click(screen.getByText("Models"));
			});

			expect(await screen.findByText("Enabled Models")).toBeInTheDocument();
			expect(screen.getByText("Block images")).toBeInTheDocument();
		});
	});

	// ── About tab ─────────────────────────────────────────────────────────

	describe("About tab", () => {
		it("shows version and agent directory", async () => {
			const user = userEvent.setup();
			await act(async () => {
				render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
			});

			await act(async () => {
				await user.click(screen.getByText("About"));
			});

			expect(await screen.findByText("Version")).toBeInTheDocument();
			expect(screen.getByText("0.0.0-test")).toBeInTheDocument();
			expect(screen.getByText("Agent directory")).toBeInTheDocument();
		});

		it("shows links section", async () => {
			const user = userEvent.setup();
			await act(async () => {
				render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
			});

			await act(async () => {
				await user.click(screen.getByText("About"));
			});

			expect(await screen.findByText("Pi Documentation")).toBeInTheDocument();
			expect(screen.getByText("GitHub")).toBeInTheDocument();
		});

		it("shows Updates section with check button", async () => {
			const user = userEvent.setup();
			await act(async () => {
				render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
			});

			await act(async () => {
				await user.click(screen.getByText("About"));
			});

			expect(await screen.findByText("Updates")).toBeInTheDocument();
			expect(screen.getByText("Check for Updates")).toBeInTheDocument();
		});

		it("calls updater.check when Check for Updates is clicked", async () => {
			const user = userEvent.setup();
			await act(async () => {
				render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
			});

			await act(async () => {
				await user.click(screen.getByText("About"));
			});

			const checkButton = screen.getByText("Check for Updates");
			await act(async () => {
				await user.click(checkButton);
			});

			expect(mockPi.updater.check).toHaveBeenCalled();
		});
	});
});
