import { type HTMLMotionProps, type MotionProps, motion } from "motion/react";
import { type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ShimmerProps<T extends ElementType> = {
	as?: T;
	children: ReactNode;
	className?: string;
	duration?: number;
	spread?: number;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function Shimmer<T extends ElementType = "span">({
	as,
	children,
	className,
	duration = 2,
	spread = 2,
	...props
}: ShimmerProps<T>) {
	const Component = motion.create((as ?? "span") as ElementType);
	const textLength = typeof children === "string" ? Math.max(children.length, 12) : 18;

	return (
		<Component
			className={cn(
				"inline-block bg-clip-text text-transparent",
				"bg-[linear-gradient(110deg,var(--muted-foreground)_0%,var(--muted-foreground)_38%,var(--foreground)_50%,var(--muted-foreground)_62%,var(--muted-foreground)_100%)]",
				className,
			)}
			animate={{ backgroundPosition: ["100% 0", "0% 0"] }}
			transition={{
				duration,
				ease: "linear",
				repeat: Infinity,
			}}
			style={{
				backgroundSize: `${textLength * spread}ch 100%`,
			}}
			{...(props as MotionProps & HTMLMotionProps<"span">)}
		>
			{children}
		</Component>
	);
}
