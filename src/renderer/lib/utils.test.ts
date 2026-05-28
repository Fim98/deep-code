import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
	it("merges class names", () => {
		expect(cn("foo", "bar")).toBe("foo bar");
	});

	it("handles undefined and false", () => {
		expect(cn("foo", undefined, false && "bar", "baz")).toBe("foo baz");
	});

	it("resolves tailwind conflicts (last wins)", () => {
		expect(cn("px-4", "px-8")).toBe("px-8");
		expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
	});

	it("handles empty input", () => {
		expect(cn()).toBe("");
	});

	it("supports object syntax (via clsx)", () => {
		expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
	});

	it("supports arrays (via clsx)", () => {
		expect(cn(["foo", "bar"])).toBe("foo bar");
	});

	it("merges tailwind classes with cn-specific variants", () => {
		const result = cn("rounded-[18px] px-4 py-2", "rounded-[24px]");
		expect(result).toBe("px-4 py-2 rounded-[24px]");
	});
});
