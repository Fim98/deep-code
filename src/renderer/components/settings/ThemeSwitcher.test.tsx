import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "@/stores/theme";
import { ThemeSwitcher } from "./ThemeSwitcher";

const mockPi = (window as any).pi;

describe("ThemeSwitcher", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		// Reset theme store
		useTheme.setState({ choice: "system", applied: "light" });
	});

	it("renders theme button", () => {
		render(<ThemeSwitcher />);
		expect(screen.getByLabelText("Theme")).toBeInTheDocument();
	});

	it("opens popover on click", async () => {
		const user = userEvent.setup();
		render(<ThemeSwitcher />);

		await act(async () => {
			await user.click(screen.getByLabelText("Theme"));
		});

		expect(screen.getByText("System")).toBeInTheDocument();
		expect(screen.getByText("Light")).toBeInTheDocument();
		expect(screen.getByText("Dark")).toBeInTheDocument();
	});

	it("calls setChoice when selecting a theme option", async () => {
		const user = userEvent.setup();
		render(<ThemeSwitcher />);

		await act(async () => {
			await user.click(screen.getByLabelText("Theme"));
		});

		await act(async () => {
			await user.click(screen.getByText("Dark"));
		});

		expect(useTheme.getState().choice).toBe("dark");
	});

	it("calls pi.theme.setSource when changing theme", async () => {
		const user = userEvent.setup();
		render(<ThemeSwitcher />);

		await act(async () => {
			await user.click(screen.getByLabelText("Theme"));
		});

		await act(async () => {
			await user.click(screen.getByText("Light"));
		});

		expect(mockPi.theme.setSource).toHaveBeenCalledWith("light");
	});
});
