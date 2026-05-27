interface Props {
	header?: React.ReactNode;
	footer?: React.ReactNode;
	children: React.ReactNode;
}

export function MainArea({ header, footer, children }: Props) {
	return (
		<main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
			<div
				className="flex h-[72px] shrink-0 items-center gap-2 px-8 pt-2"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				<div
					className="flex flex-1 items-center gap-3"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					{header}
				</div>
			</div>
			<div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
			{footer ? (
				<div className="shrink-0 px-8 pb-6 pt-3">
					{footer}
				</div>
			) : null}
		</main>
	);
}
