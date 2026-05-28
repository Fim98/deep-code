import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full font-semibold transition-colors", {
	variants: {
		variant: {
			default: "bg-foreground/[0.06] text-foreground",
			primary: "bg-primary/10 text-primary",
			success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
			destructive: "bg-destructive/10 text-destructive",
			warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
		},
		size: {
			sm: "px-1.5 py-0.5 text-[9.5px] tracking-wider",
			md: "px-2 py-0.5 text-[10.5px] tracking-wide",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "sm",
	},
});

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
	return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
