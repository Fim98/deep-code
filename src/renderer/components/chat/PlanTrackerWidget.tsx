import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { type PlanTrackerTask, useSessions } from "@/stores/session-state";

interface Props {
	sessionId: string;
}

export function PlanTrackerWidget({ sessionId }: Props) {
	const planTracker = useSessions((s) => s.bySession[sessionId]?.planTracker);
	const [expanded, setExpanded] = useState(false);
	const tasks = planTracker?.tasks ?? [];

	const stats = useMemo(() => {
		const total = tasks.length;
		const complete = tasks.filter((t) => t.status === "complete").length;
		const inProgress = tasks.find((t) => t.status === "in_progress");
		const current = inProgress ?? tasks.find((t) => t.status === "pending");
		const percent = total > 0 ? Math.round((complete / total) * 100) : 0;
		return { total, complete, percent, current, inProgress };
	}, [tasks]);

	if (tasks.length === 0) return null;

	const allComplete = stats.complete === stats.total;

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 8 }}
			transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
			className="mx-auto w-full max-w-3xl"
		>
			{/* Card container */}
			<div
				className={cn(
					"overflow-hidden rounded-[18px] border transition-colors duration-200",
					allComplete ? "border-success/20 bg-success/[0.03]" : "border-border bg-card",
				)}
			>
				{/* Collapsed header — always visible */}
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className={cn(
						"group flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left",
						"transition-colors duration-150",
						expanded ? "pb-2" : "",
						"hover:bg-foreground/[0.015]",
					)}
				>
					{/* Status dots */}
					<div className="flex shrink-0 items-center gap-[3px]">
						{tasks.map((task, i) => (
							<TaskDot key={i} task={task} />
						))}
					</div>

					{/* Progress bar */}
					<div className="min-w-0 flex-1">
						<Progress
							value={stats.percent}
							className={cn(
								"h-1.5",
								allComplete ? "[&>[data-radix-progress-indicator]]:bg-success" : "",
							)}
						/>
					</div>

					{/* Count label */}
					<span
						className={cn(
							"shrink-0 tabular-nums text-[12px] font-medium tracking-tight",
							allComplete ? "text-success" : "text-muted-foreground",
						)}
					>
						{stats.complete}/{stats.total}
					</span>

					{/* Expand chevron */}
					<motion.svg
						animate={{ rotate: expanded ? 180 : 0 }}
						transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
						className="size-3.5 shrink-0 text-muted-foreground/60"
						viewBox="0 0 16 16"
						fill="none"
					>
						<path
							d="M4 6l4 4 4-4"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</motion.svg>
				</button>

				{/* Current task label — shown when collapsed and a task is active */}
				<AnimatePresence initial={false}>
					{!expanded && stats.current ? (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="truncate px-5 pb-3 text-[12px] font-medium text-muted-foreground"
						>
							<span className="text-primary">→</span> {stats.current.name}
						</motion.div>
					) : null}
				</AnimatePresence>

				{/* Expanded task list */}
				<AnimatePresence initial={false}>
					{expanded ? (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{
								duration: 0.25,
								ease: [0.4, 0, 0.2, 1],
							}}
							className="overflow-hidden"
						>
							<div className="px-3 pb-3 pt-1">
								<div className="space-y-0.5">
									{tasks.map((task, i) => (
										<TaskRow key={i} task={task} index={i} />
									))}
								</div>
							</div>
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
		</motion.div>
	);
}

/* ─── Task Dot ─── */

function TaskDot({ task }: { task: PlanTrackerTask }) {
	const { t } = useI18n();
	switch (task.status) {
		case "complete":
			return (
				<div className="flex size-[10px] items-center justify-center rounded-full bg-success">
					<svg
						className="size-[6px]"
						viewBox="0 0 10 10"
						fill="none"
						role="img"
						aria-label={t("planTracker.ariaComplete")}
					>
						<path
							d="M2 5.5l2 2 4-4.5"
							stroke="white"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>
			);
		case "in_progress":
			return (
				<div className="relative flex size-[10px] items-center justify-center rounded-full bg-primary">
					<motion.div
						className="absolute inset-0 rounded-full bg-primary"
						animate={{ opacity: [0.4, 0, 0.4] }}
						transition={{
							duration: 2,
							repeat: Infinity,
							ease: "easeInOut",
						}}
					/>
				</div>
			);
		default:
			return <div className="size-[10px] rounded-full bg-foreground/[0.1]" />;
	}
}

/* ─── Task Row (expanded) ─── */

function TaskRow({ task, index }: { task: PlanTrackerTask; index: number }) {
	const { t } = useI18n();
	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-[14px] px-3 py-2 transition-colors duration-150",
				task.status === "in_progress" ? "bg-primary/[0.04]" : "hover:bg-foreground/[0.02]",
			)}
		>
			{/* Status icon */}
			<TaskStatusIcon status={task.status} />

			{/* Index */}
			<span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground/50">
				{index}
			</span>

			{/* Name */}
			<span
				className={cn(
					"min-w-0 flex-1 truncate text-[12.5px] leading-snug",
					task.status === "complete"
						? "text-muted-foreground line-through decoration-muted-foreground/40"
						: task.status === "in_progress"
							? "font-medium text-foreground"
							: "text-foreground/70",
				)}
			>
				{task.name}
			</span>

			{/* Status label */}
			{task.status === "in_progress" ? (
				<span className="shrink-0 text-[10px] font-medium text-primary/70">
					{t("planTracker.inProgress")}
				</span>
			) : null}
		</div>
	);
}

/* ─── Status Icon ─── */

function TaskStatusIcon({ status }: { status: PlanTrackerTask["status"] }) {
	const { t } = useI18n();
	switch (status) {
		case "complete":
			return (
				<div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success">
					<svg
						className="size-3"
						viewBox="0 0 10 10"
						fill="none"
						role="img"
						aria-label={t("planTracker.ariaComplete")}
					>
						<path
							d="M2 5.5l2 2 4-4.5"
							stroke="white"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>
			);
		case "in_progress":
			return (
				<div className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
					<svg
						className="size-3"
						viewBox="0 0 10 10"
						fill="none"
						role="img"
						aria-label={t("planTracker.ariaInProgress")}
					>
						<path d="M3 5h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
					</svg>
					<motion.div
						className="absolute inset-0 rounded-full bg-primary"
						animate={{ opacity: [0.3, 0, 0.3] }}
						transition={{
							duration: 2,
							repeat: Infinity,
							ease: "easeInOut",
						}}
					/>
				</div>
			);
		default:
			return (
				<div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-foreground/10">
					<div className="size-1.5 rounded-full bg-foreground/15" />
				</div>
			);
	}
}
