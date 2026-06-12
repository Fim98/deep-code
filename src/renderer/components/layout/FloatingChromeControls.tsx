import {
	PanelBottom,
	PanelBottomOpen,
	PanelLeft,
	PanelLeftOpen,
	PanelRight,
	PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingChromeControlsProps {
	sidebarOpen: boolean;
	bashOpen: boolean;
	rightRailActive: boolean;
	sidebarLabel: string;
	bashTitle: string;
	fileTreeTitle: string;
	onToggleSidebar: () => void;
	onToggleBash: () => void;
	onToggleRightRail: () => void;
}

const btnBase =
	"flex size-7 cursor-pointer items-center justify-center rounded-[8px] transition-colors duration-150 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground";

export function FloatingChromeControls({
	sidebarOpen,
	bashOpen,
	rightRailActive,
	sidebarLabel,
	bashTitle,
	fileTreeTitle,
	onToggleSidebar,
	onToggleBash,
	onToggleRightRail,
}: FloatingChromeControlsProps) {
	return (
		<>
			{/* Left: sidebar toggle — sits next to the traffic-light row as a "4th" button */}
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

			{/* Right: terminal + file tree */}
			<div
				className="fixed right-4 top-2 z-50 flex items-center gap-0.5"
				style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
			>
				<button
					type="button"
					aria-label={bashTitle}
					title={bashTitle}
					onClick={onToggleBash}
					className={cn(btnBase, bashOpen && "bg-foreground/[0.06] text-foreground")}
				>
					{bashOpen ? (
						<PanelBottomOpen className="size-[15px]" />
					) : (
						<PanelBottom className="size-[15px]" />
					)}
				</button>
				<button
					type="button"
					aria-label={fileTreeTitle}
					title={fileTreeTitle}
					onClick={onToggleRightRail}
					className={cn(btnBase, rightRailActive && "bg-foreground/[0.06] text-foreground")}
				>
					{rightRailActive ? (
						<PanelRightOpen className="size-[15px]" />
					) : (
						<PanelRight className="size-[15px]" />
					)}
				</button>
			</div>
		</>
	);
}
