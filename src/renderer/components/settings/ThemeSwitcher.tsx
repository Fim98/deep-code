import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { type ThemeChoice, useTheme } from "@/stores/theme";

const OPTION_ICONS: Array<{
	value: ThemeChoice;
	labelKey: string;
	icon: React.ComponentType<{ className?: string }>;
}> = [
	{ value: "system", labelKey: "theme.system", icon: Monitor },
	{ value: "light", labelKey: "theme.light", icon: Sun },
	{ value: "dark", labelKey: "theme.dark", icon: Moon },
];

export function ThemeSwitcher() {
	const { t } = useI18n();
	const { choice, applied, setChoice } = useTheme();
	const Active =
		OPTION_ICONS.find((o) => o.value === choice)?.icon ?? (applied === "dark" ? Moon : Sun);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button size="icon" variant="ghost" aria-label={t("theme.label")}>
					<Active className="size-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-44 p-1">
				{OPTION_ICONS.map(({ value, labelKey, icon: Icon }) => {
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
							<span className="flex-1 text-left">{t(labelKey)}</span>
							{active ? <span className="size-1.5 rounded-full bg-primary" /> : null}
						</button>
					);
				})}
			</PopoverContent>
		</Popover>
	);
}
