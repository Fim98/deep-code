interface Props {
	header?: React.ReactNode;
	footer?: React.ReactNode;
	children: React.ReactNode;
}

export function MainArea({ header, footer, children }: Props) {
	return (
		<main className="flex flex-1 flex-col overflow-hidden bg-background">
			<div
				className="flex h-11 shrink-0 items-center gap-2 border-b border-[hsl(var(--titlebar-divider))] px-5"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				<div
					className="flex flex-1 items-center gap-3"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					{header}
				</div>
			</div>
			<div className="relative flex-1 overflow-hidden">{children}</div>
			{footer ? (
				<div className="shrink-0 border-t border-[hsl(var(--titlebar-divider))] bg-background/95 px-6 py-3 backdrop-blur-xl">
					{footer}
				</div>
			) : null}
		</main>
	);
}
