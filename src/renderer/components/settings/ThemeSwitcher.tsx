import { Monitor, Moon, Sun } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeChoice } from "@/stores/theme";

const OPTIONS: Array<{
	value: ThemeChoice;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}> = [
	{ value: "system", label: "System", icon: Monitor },
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
];

export function ThemeSwitcher() {
	const { choice, applied, setChoice } = useTheme();
	const Active =
		OPTIONS.find((o) => o.value === choice)?.icon ??
		(applied === "dark" ? Moon : Sun);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					title="Theme"
					className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
				>
					<Active className="size-3.5" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-44 p-1">
				{OPTIONS.map(({ value, label, icon: Icon }) => {
					const active = choice === value;
					return (
						<button
							key={value}
							type="button"
							onClick={() => setChoice(value)}
							className={cn(
								"flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors",
								active
									? "bg-accent text-accent-foreground"
									: "text-foreground/85 hover:bg-foreground/[0.06]",
							)}
						>
							<Icon className="size-3.5" />
							<span className="flex-1">{label}</span>
							{active ? (
								<span className="text-[10px] uppercase tracking-wider text-primary">
									●
								</span>
							) : null}
						</button>
					);
				})}
			</PopoverContent>
		</Popover>
	);
}
