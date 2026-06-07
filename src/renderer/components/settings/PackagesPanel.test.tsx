import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PackagesPanel } from "./PackagesPanel";

const mockPi = window.pi as any;

describe("PackagesPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPi.packages.list.mockResolvedValue([]);
		mockPi.packages.install.mockResolvedValue([]);
		mockPi.packages.update.mockResolvedValue([]);
		mockPi.packages.remove.mockResolvedValue([]);
		mockPi.packages.onProgress.mockReturnValue(() => {});
	});

	it("asks for a workspace when cwd is missing", () => {
		render(<PackagesPanel cwd={undefined} />);
		expect(screen.getByText("Choose a workspace to manage pi packages.")).toBeInTheDocument();
	});

	it("lists configured pi packages", async () => {
		mockPi.packages.list.mockResolvedValue([
			{
				source: "pi-example-package",
				scope: "project",
				installedPath: "/tmp/project/.pi/packages/pi-example-package",
				filtered: false,
			},
		]);

		await act(async () => {
			render(<PackagesPanel cwd="/tmp/project" />);
		});

		expect(await screen.findByText("pi-example-package")).toBeInTheDocument();
		expect(screen.getByText("project")).toBeInTheDocument();
		expect(screen.getByText("/tmp/project/.pi/packages/pi-example-package")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Reveal" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
	});

	it("installs packages into the selected scope", async () => {
		const user = userEvent.setup();
		mockPi.packages.install.mockResolvedValue([
			{ source: "github:user/pkg", scope: "project", installedPath: "/tmp/pkg", filtered: false },
		]);

		await act(async () => {
			render(<PackagesPanel cwd="/tmp/project" />);
		});

		await user.type(
			screen.getByPlaceholderText("npm package, git URL, or local path"),
			"github:user/pkg",
		);
		await user.click(screen.getByLabelText("Install into project .pi/settings.json"));
		await user.click(screen.getByRole("button", { name: /Install package/i }));

		await waitFor(() => {
			expect(mockPi.packages.install).toHaveBeenCalledWith({
				cwd: "/tmp/project",
				source: "github:user/pkg",
				local: true,
			});
		});
		expect(await screen.findByText("github:user/pkg")).toBeInTheDocument();
	});

	it("reveals and copies installed package paths", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { ...navigator.clipboard, writeText },
			configurable: true,
		});
		const user = userEvent.setup();
		mockPi.packages.list.mockResolvedValue([
			{
				source: "pi-example-package",
				scope: "project",
				installedPath: "/tmp/project/.pi/packages/pi-example-package",
				filtered: false,
			},
		]);

		await act(async () => {
			render(<PackagesPanel cwd="/tmp/project" />);
		});

		await user.click(await screen.findByRole("button", { name: "Reveal" }));
		expect(mockPi.shell.showItemInFolder).toHaveBeenCalledWith(
			"/tmp/project/.pi/packages/pi-example-package",
		);

		await user.click(screen.getByRole("button", { name: "Copy" }));
		expect(writeText).toHaveBeenCalledWith("/tmp/project/.pi/packages/pi-example-package");
	});

	it("shows package progress events", async () => {
		mockPi.packages.onProgress.mockImplementation((callback: (event: unknown) => void) => {
			callback({
				action: "install",
				type: "progress",
				source: "github:user/pkg",
				message: "cloning",
			});
			return () => {};
		});

		await act(async () => {
			render(<PackagesPanel cwd="/tmp/project" />);
		});

		expect(await screen.findByText("Progress")).toBeInTheDocument();
		expect(screen.getByText(/github:user\/pkg/)).toBeInTheDocument();
		expect(screen.getByText(/cloning/)).toBeInTheDocument();
	});
});
