interface Props {
	children: React.ReactNode;
}

export function Titlebar({ children }: Props) {
	return (
		<header
			className="flex h-12 shrink-0 items-center gap-4 border-b border-border/30 bg-background/40 pl-[88px] pr-4 backdrop-blur-xl"
			style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
		>
			<div className="flex flex-1 items-center gap-2 text-sm font-medium text-foreground/80">
				{children}
			</div>
		</header>
	);
}
