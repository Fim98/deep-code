import { Monitor, Moon, Sun } from "lucide-react";
import { Button, Popover } from "@heroui/react";
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
			<Button isIconOnly size="sm" variant="tertiary" aria-label="Theme">
				<Active className="size-3.5" />
			</Button>
			<Popover.Content placement="bottom end" className="w-44 p-1">
				<Popover.Dialog className="outline-none">
					{OPTIONS.map(({ value, label, icon: Icon }) => {
						const active = choice === value;
						return (
							<Button
								key={value}
								variant={active ? "secondary" : "tertiary"}
								size="sm"
								onPress={() => setChoice(value)}
								className={cn(
									"w-full justify-start gap-2 px-2.5 text-left text-[12px]",
									active && "text-accent-soft-foreground",
								)}
							>
								<Icon className="size-3.5" />
								<span className="flex-1">{label}</span>
								{active ? (
									<span className="text-[10px] uppercase tracking-wider text-primary">
										●
									</span>
								) : null}
							</Button>
						);
					})}
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
