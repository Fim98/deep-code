interface Props {
	header?: React.ReactNode;
	footer?: React.ReactNode;
	children: React.ReactNode;
}

export function MainArea({ header, footer, children }: Props) {
	return (
		<main className="flex flex-1 flex-col overflow-hidden bg-background/30 backdrop-blur-xl">
			<div
				className="flex h-12 shrink-0 items-center gap-2 border-b border-border/30 px-6"
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
				<div className="shrink-0 border-t border-border/30 bg-background/40 px-6 py-3 backdrop-blur-xl">
					{footer}
				</div>
			) : null}
		</main>
	);
}
