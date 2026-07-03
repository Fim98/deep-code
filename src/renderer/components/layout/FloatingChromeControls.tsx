import { PanelLeft, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingChromeControlsProps {
	sidebarOpen: boolean;
	sidebarLabel: string;
	onToggleSidebar: () => void;
}

const btnBase =
	"flex size-7 cursor-pointer items-center justify-center rounded-[8px] transition-colors duration-150 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground";

export function FloatingChromeControls({
	sidebarOpen,
	sidebarLabel,
	onToggleSidebar,
}: FloatingChromeControlsProps) {
	return (
		<div
			className="fixed left-[74px] top-[10px] z-50"
			style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
		>
			<button
				type="button"
				aria-label={sidebarLabel}
				title={sidebarLabel}
				onClick={onToggleSidebar}
				className={cn(btnBase, sidebarOpen && "text-foreground")}
			>
				{sidebarOpen ? (
					<PanelLeftOpen className="size-[15px]" />
				) : (
					<PanelLeft className="size-[15px]" />
				)}
			</button>
		</div>
	);
}
