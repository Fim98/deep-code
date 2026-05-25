import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Props {
	children: React.ReactNode;
}

export function Sidebar({ children }: Props) {
	return (
		<aside
			className="flex w-[280px] shrink-0 flex-col border-r border-border/30 bg-sidebar/60 backdrop-blur-xl"
			style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
		>
			<div className="h-12 shrink-0" />
			<ScrollArea className="flex-1 px-3 pb-4">
				<div
					className="space-y-6"
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
		<div>
			<div className="mb-1 flex items-center justify-between px-3 pt-1">
				<div className="select-none text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
					{title}
				</div>
				{action}
			</div>
			<div className="space-y-0.5">{children}</div>
		</div>
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
}: ItemProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={title2}
			className={cn(
				"group flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors",
				active
					? "bg-white/[0.07] text-foreground"
					: "text-foreground/75 hover:bg-white/[0.04] hover:text-foreground",
				className,
			)}
		>
			{icon ? (
				<span
					className={cn(
						"flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
						active ? "text-primary" : "text-muted-foreground/80",
					)}
				>
					{icon}
				</span>
			) : null}
			<div className="min-w-0 flex-1">
				<div className="truncate">{title}</div>
				{subtitle ? (
					<div className="truncate text-[10.5px] text-muted-foreground/70">
						{subtitle}
					</div>
				) : null}
			</div>
			{right}
		</button>
	);
}
