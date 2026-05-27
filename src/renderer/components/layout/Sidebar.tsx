import { Button, ScrollShadow } from "@heroui/react";
import { cn } from "@/lib/utils";

interface Props {
	children: React.ReactNode;
}

export function Sidebar({ children }: Props) {
	return (
		<aside
			className="sidebar-floating relative z-10 flex w-[240px] shrink-0 flex-col bg-sidebar text-sidebar-foreground"
			style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
		>
			<div className="h-5 shrink-0" />
			<ScrollShadow className="min-h-0 flex-1 pb-5" hideScrollBar size={36}>
				<div
					className="space-y-6 px-4"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					{children}
				</div>
			</ScrollShadow>
		</aside>
	);
}

interface SectionProps {
	title: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}

export function SidebarSection({ title, action, children }: SectionProps) {
	return (
		<section className="group/section overflow-visible">
			<div className="mb-2 flex items-center justify-between px-3 pt-1">
				<div className="select-none text-[12px] font-semibold text-muted-foreground">
					{title}
				</div>
				<div className="opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
					{action}
				</div>
			</div>
			<div className="space-y-1 overflow-visible">
				{children}
			</div>
		</section>
	);
}

interface ItemProps {
	active?: boolean;
	onClick?: () => void;
	icon?: React.ReactNode;
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	right?: React.ReactNode;
	title2?: string;
	className?: string;
	activeClassName?: string;
}

export function SidebarItem({
	active,
	onClick,
	icon,
	title,
	subtitle,
	right,
	title2,
	className,
	activeClassName,
}: ItemProps) {
	return (
		<div className="group/sidebar-item relative">
			<Button
				variant="tertiary"
				onPress={onClick}
				aria-label={title2}
				className={cn(
					"group min-h-10 w-full justify-start gap-3 rounded-2xl px-3 py-2 text-left text-[14px]",
					active
						? cn(
								"bg-secondary text-foreground shadow-none ring-0 hover:bg-secondary",
								activeClassName,
							)
						: "text-foreground/80 hover:bg-foreground/[0.05] hover:text-foreground",
					right && "pr-9",
					className,
				)}
			>
				{icon ? (
					<span
						className={cn(
							"flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors",
							active ? "text-foreground" : "text-muted-foreground",
						)}
					>
						{icon}
					</span>
				) : null}
				<div className="min-w-0 flex-1 py-px">
					<div
						className={cn(
							"truncate text-[14px] font-medium leading-tight",
							active ? "text-foreground" : "text-foreground/90",
						)}
					>
						{title}
					</div>
					{subtitle ? (
						<div
							className={cn(
								"mt-1 truncate text-[11px] leading-tight",
								active ? "text-foreground/60" : "text-muted-foreground/60",
							)}
						>
							{subtitle}
						</div>
					) : null}
				</div>
			</Button>
			{right ? (
				<div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
					{right}
				</div>
			) : null}
		</div>
	);
}
