import { cn } from "@/lib/utils";

interface Props {
	patch: string;
	className?: string;
}

/** Renders a unified diff (`---`/`+++`/`@@`) with colored gutter. */
export function DiffViewer({ patch, className }: Props) {
	const lines = patch.split("\n");
	return (
		<pre
			className={cn(
				"overflow-x-auto rounded-md bg-background/60 font-mono text-[11px] leading-snug",
				className,
			)}
		>
			{lines.map((raw, i) => {
				const cls = classify(raw);
				return (
					<div
						key={i}
						className={cn(
							"px-2.5 py-[1px] tabular-nums",
							cls.bg,
							cls.text,
						)}
					>
						<span
							className={cn(
								"mr-2 inline-block w-3 select-none text-center opacity-60",
								cls.text,
							)}
						>
							{cls.gutter}
						</span>
						<span className="whitespace-pre">{raw.slice(cls.gutter ? 1 : 0)}</span>
					</div>
				);
			})}
		</pre>
	);
}

function classify(raw: string) {
	if (raw.startsWith("+++") || raw.startsWith("---")) {
		return { gutter: "", bg: "", text: "text-muted-foreground/80 font-semibold" };
	}
	if (raw.startsWith("@@")) {
		return { gutter: "", bg: "bg-foreground/[0.04]", text: "text-muted-foreground/85" };
	}
	if (raw.startsWith("+")) {
		return {
			gutter: "+",
			bg: "bg-emerald-500/10 dark:bg-emerald-500/[0.12]",
			text: "text-emerald-700 dark:text-emerald-300",
		};
	}
	if (raw.startsWith("-")) {
		return {
			gutter: "-",
			bg: "bg-rose-500/10 dark:bg-rose-500/[0.12]",
			text: "text-rose-700 dark:text-rose-300",
		};
	}
	return { gutter: " ", bg: "", text: "text-foreground/75" };
}
