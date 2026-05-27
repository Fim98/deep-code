import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Props {
	children: React.ReactNode;
}

export function Sidebar({ children }: Props) {
	return (
		<aside
			className="relative z-10 flex w-[280px] min-w-[280px] max-w-[280px] shrink-0 basis-[280px] flex-col overflow-hidden border-r border-border/50 bg-sidebar backdrop-blur-xl text-sidebar-foreground"
			style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
		>
			<div className="h-7 shrink-0" />
			<ScrollArea
				className="min-h-0 flex-1 pb-5"
				viewportClassName="[&>div]:!block"
			>
				<div
					className="w-full min-w-0 space-y-6 px-4"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					{children}
				</div>
			</ScrollArea>
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
		<section className="group/section w-full min-w-0">
			<div className="mb-2 flex items-center justify-between px-3 pt-1">
				<div className="select-none text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
					{title}
				</div>
				<div className="opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
					{action}
				</div>
			</div>
			<div className="w-full min-w-0 space-y-1">
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
		<div className="group/sidebar-item relative w-full min-w-0">
			<div
				onClick={onClick}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " " ) {
						e.preventDefault();
						onClick?.();
					}
				}}
				aria-label={title2}
				className={cn(
					"group flex min-h-[40px] w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2 text-left text-[14px] transition-colors duration-150",
					active
						? cn(
								"bg-foreground/[0.06] text-foreground",
								activeClassName,
							)
						: "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground",
					right && "pr-9",
					className,
				)}
			>
				{icon ? (
					<span
						className={cn(
							"flex size-5 shrink-0 items-center justify-center rounded-md transition-colors",
							active ? "text-foreground" : "text-muted-foreground",
						)}
					>
						{icon}
					</span>
				) : null}
				<div className="min-w-0 flex-1 py-px">
					<div
						className={cn(
							"truncate text-[13px] font-medium leading-tight",
							active ? "text-foreground" : "text-foreground/85",
						)}
					>
						{title}
					</div>
					{subtitle ? (
						<div
							className={cn(
								"mt-0.5 truncate text-[11px] leading-tight",
								active ? "text-muted-foreground" : "text-muted-foreground/60",
							)}
						>
							{subtitle}
						</div>
					) : null}
				</div>
			</div>
			{right ? (
				<div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
					{right}
				</div>
			) : null}
		</div>
	);
}
