import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnsiText } from "./ansi";

describe("AnsiText", () => {
	it("renders plain text without ANSI codes", () => {
		render(<AnsiText text="Hello world" />);
		expect(screen.getByText("Hello world")).toBeInTheDocument();
	});

	it("renders styled span for bold text", () => {
		const { container } = render(<AnsiText text={"\x1b[1mBold text\x1b[0m"} />);
		const span = container.querySelector("span[style]") as HTMLElement | null;
		expect(span).toBeTruthy();
		expect(span?.textContent).toBe("Bold text");
		expect(span?.style.fontWeight).toBe("bold");
	});

	it("renders italic text", () => {
		const { container } = render(<AnsiText text={"\x1b[3mItalic\x1b[0m"} />);
		const span = container.querySelector("span[style]") as HTMLElement | null;
		expect(span).toBeTruthy();
		expect(span?.style.fontStyle).toBe("italic");
	});

	it("renders underline text", () => {
		const { container } = render(<AnsiText text={"\x1b[4mUnderline\x1b[0m"} />);
		const span = container.querySelector("span[style]") as HTMLElement | null;
		expect(span).toBeTruthy();
		expect(span?.style.textDecoration).toBe("underline");
	});

	it("renders dim/opacity text", () => {
		const { container } = render(<AnsiText text={"\x1b[2mDim\x1b[0m"} />);
		const span = container.querySelector("span[style]") as HTMLElement | null;
		expect(span).toBeTruthy();
		expect(span?.style.opacity).toBe("0.7");
	});

	it("renders standard foreground colors", () => {
		const { container } = render(<AnsiText text={"\x1b[31mRed text\x1b[0m"} />);
		const span = container.querySelector("span[style]") as HTMLElement | null;
		expect(span).toBeTruthy();
		expect(span?.style.color).toBeTruthy();
	});

	it("renders standard background colors", () => {
		const { container } = render(<AnsiText text={"\x1b[42mGreen bg\x1b[0m"} />);
		const span = container.querySelector("span[style]") as HTMLElement | null;
		expect(span).toBeTruthy();
		expect(span?.style.backgroundColor).toBeTruthy();
	});

	it("renders 256-color foreground", () => {
		const { container } = render(<AnsiText text={"\x1b[38;5;196m256 red\x1b[0m"} />);
		const span = container.querySelector("span[style]") as HTMLElement | null;
		expect(span).toBeTruthy();
		expect(span?.style.color).toBeTruthy();
	});

	it("renders true color foreground", () => {
		const { container } = render(<AnsiText text={"\x1b[38;2;255;100;50mTrue red\x1b[0m"} />);
		const span = container.querySelector("span[style]") as HTMLElement | null;
		expect(span).toBeTruthy();
		expect(span?.style.color).toBe("rgb(255, 100, 50)");
	});

	it("handles mixed plain and styled text", () => {
		const { container } = render(<AnsiText text={"Plain \x1b[1mbold\x1b[0m plain"} />);
		expect(container.textContent).toContain("Plain");
		expect(container.textContent).toContain("bold");
	});

	it("handles reset code (0)", () => {
		const { container } = render(<AnsiText text={"\x1b[1mBold\x1b[0m Normal"} />);
		const text = container.textContent;
		expect(text).toContain("Bold");
		expect(text).toContain("Normal");
	});

	it("handles empty string", () => {
		const { container } = render(<AnsiText text="" />);
		expect(container.textContent).toBe("");
	});
});
