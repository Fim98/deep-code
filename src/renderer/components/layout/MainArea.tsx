interface Props {
	header?: React.ReactNode;
	footer?: React.ReactNode;
	children: React.ReactNode;
}

export function MainArea({ header, footer, children }: Props) {
	return (
		<main className="flex flex-1 flex-col overflow-hidden bg-background">
			<div
				className="flex h-16 shrink-0 items-center gap-2 px-8"
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
				<div className="shrink-0 bg-background px-8 pb-6 pt-3">
					{footer}
				</div>
			) : null}
		</main>
	);
}
