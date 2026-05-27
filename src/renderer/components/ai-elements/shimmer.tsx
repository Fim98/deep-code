import {
	type CSSProperties,
	type ElementType,
	type ComponentPropsWithoutRef,
} from "react";
import { cn } from "@/lib/utils";

type ShimmerProps<T extends ElementType> = {
	as?: T;
	children: string;
	className?: string;
	duration?: number;
	spread?: number;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function Shimmer<T extends ElementType = "span">({
	as,
	children,
	className,
	duration = 2.2,
	spread = 2,
	style,
	...props
}: ShimmerProps<T>) {
	const Component = (as ?? "span") as ElementType;
	const mergedStyle = {
		"--shimmer-duration": `${duration}s`,
		backgroundSize: `${Math.max(children.length * spread, 18)}ch 100%`,
		...(style as CSSProperties),
	} as CSSProperties & { "--shimmer-duration": string };
	return (
		<Component
			className={cn(
				"inline-block animate-[shimmer_var(--shimmer-duration)_linear_infinite] bg-[linear-gradient(110deg,var(--muted-foreground)_0%,var(--muted-foreground)_35%,var(--foreground)_50%,var(--muted-foreground)_65%,var(--muted-foreground)_100%)] bg-clip-text text-transparent",
				className,
			)}
			style={mergedStyle}
			{...props}
		>
			{children}
		</Component>
	);
}
