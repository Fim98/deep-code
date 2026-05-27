import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
				<Button size="icon" variant="ghost" aria-label="Theme">
					<Active className="size-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-44 p-1">
				{OPTIONS.map(({ value, label, icon: Icon }) => {
					const active = choice === value;
					return (
						<button
							key={value}
							onClick={() => setChoice(value)}
							className={cn(
								"flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] px-3 py-2 text-[13px] transition-colors",
								active
									? "bg-foreground/[0.06] text-foreground"
									: "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground",
							)}
						>
							<Icon className="size-4" />
							<span className="flex-1 text-left">{label}</span>
							{active ? (
								<span className="size-1.5 rounded-full bg-primary" />
							) : null}
						</button>
					);
				})}
			</PopoverContent>
		</Popover>
	);
}
