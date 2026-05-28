import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 cursor-pointer select-none",
	{
		variants: {
			variant: {
				primary:
					"bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:-translate-y-[1px] active:translate-y-0",
				secondary: "bg-secondary text-secondary-foreground hover:bg-foreground/[0.06]",
				ghost: "text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground",
				outline: "border border-border bg-transparent text-foreground hover:bg-foreground/[0.04]",
				destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
				"destructive-soft": "bg-destructive/10 text-destructive hover:bg-destructive/15",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				sm: "h-8 rounded-[14px] px-3 text-[13px] [&_svg]:size-3.5",
				md: "h-10 rounded-[18px] px-4 text-[14px] [&_svg]:size-4",
				lg: "h-12 rounded-[18px] px-6 text-[15px] [&_svg]:size-4.5",
				icon: "h-8 w-8 rounded-[14px]",
				"icon-sm": "h-6 w-6 rounded-[10px] [&_svg]:size-3",
			},
		},
		defaultVariants: {
			variant: "primary",
			size: "md",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };
