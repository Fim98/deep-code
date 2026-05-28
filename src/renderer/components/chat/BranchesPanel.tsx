import { GitBranch, GitFork } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { pi, type SessionTreeNode } from "@/lib/rpc";
import { emitToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useSessions } from "@/stores/session-state";

interface Props {
	sessionId: string;
	onForked?: () => void;
}

interface ForkMessage {
	entryId: string;
	text: string;
}

// Collect user messages from the tree in depth-first order
function collectUserMessages(nodes: SessionTreeNode[]): ForkMessage[] {
	const result: ForkMessage[] = [];
	function walk(node: SessionTreeNode) {
		if (node.type === "message" && node.text) {
			result.push({ entryId: node.id, text: node.text });
		}
		for (const child of node.children) {
			walk(child);
		}
	}
	for (const node of nodes) {
		walk(node);
	}
	return result;
}

// Find the set of ancestor entry IDs from root to the leaf
function findActivePath(nodes: SessionTreeNode[], leafId: string | null): Set<string> {
	const path = new Set<string>();
	if (!leafId) return path;

	function findPath(node: SessionTreeNode, trail: string[]): boolean {
		const currentTrail = [...trail, node.id];
		if (node.id === leafId) {
			for (const id of currentTrail) path.add(id);
			return true;
		}
		for (const child of node.children) {
			if (findPath(child, currentTrail)) return true;
		}
		return false;
	}

	for (const node of nodes) {
		if (findPath(node, [])) break;
	}
	return path;
}

// Count total branches (nodes with >1 child or nodes that have siblings)
function countBranches(nodes: SessionTreeNode[]): number {
	let count = 0;
	function walk(nodeList: SessionTreeNode[]) {
		if (nodeList.length > 1) count += nodeList.length - 1;
		for (const node of nodeList) {
			walk(node.children);
		}
	}
	walk(nodes);
	return count;
}

export function BranchesPanel({ sessionId, onForked }: Props) {
	const [open, setOpen] = useState(false);
	const [tree, setTree] = useState<SessionTreeNode[]>([]);
	const [leafId, setLeafId] = useState<string | null>(null);
	const [_forkMessages, setForkMessages] = useState<ForkMessage[]>([]);
	const [loading, setLoading] = useState(false);
	const [forking, setForking] = useState<string | null>(null);

	const hydrate = useSessions((s) => s.hydrate);

	async function refresh() {
		setLoading(true);
		try {
			const [treeData, forkResp] = await Promise.all([
				pi.sessions.tree(sessionId),
				pi.rpc.send(sessionId, { type: "get_fork_messages" }),
			]);
			setTree(treeData.tree);
			setLeafId(treeData.leafId);
			if (forkResp.success && forkResp.command === "get_fork_messages") {
				setForkMessages(forkResp.data.messages);
			}
		} catch (e) {
			emitToast(`Failed to load branches: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (open) void refresh();
	}, [open, sessionId]);

	async function handleFork(entryId: string) {
		setForking(entryId);
		try {
			const resp = await pi.rpc.send(sessionId, { type: "fork", entryId });
			if (resp.success && resp.command === "fork") {
				// Re-hydrate messages for this desktop session ID
				await hydrate(sessionId);
				onForked?.();
				setOpen(false);
			} else if (!resp.success) {
				emitToast(resp.error);
			}
		} catch (e) {
			emitToast(`Fork failed: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			setForking(null);
		}
	}

	const activePath = findActivePath(tree, leafId);
	const branchCount = countBranches(tree);
	const userMessages = collectUserMessages(tree);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					size="sm"
					variant="ghost"
					className="h-7 gap-1.5 px-2 text-[11px]"
					aria-label="Branches"
				>
					<GitBranch className="size-3.5" />
					<span className="font-medium">
						{branchCount > 0 ? `${branchCount + 1} branches` : "1 branch"}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="flex w-[420px] max-h-[480px] max-w-[calc(100vw-24px)] flex-col overflow-hidden p-0"
				style={{ maxHeight: "min(480px, var(--radix-popover-content-available-height))" }}
			>
				<div className="shrink-0 border-b border-border/30 px-4 py-3">
					<div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
						<GitBranch className="size-4 text-primary" />
						Branches
					</div>
					<div className="mt-1 text-[11px] text-muted-foreground">
						Fork from any user message to create an alternative conversation path.
					</div>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto py-2">
					{loading ? (
						<div className="px-4 py-6 text-center text-[11px] text-muted-foreground">Loading…</div>
					) : userMessages.length === 0 ? (
						<div className="px-4 py-6 text-center text-[11px] text-muted-foreground">
							No messages yet. Send a message to enable forking.
						</div>
					) : (
						<div className="space-y-0.5 px-2">
							{userMessages.map((msg, index) => {
								const isActive = activePath.has(msg.entryId);
								const isForking = forking === msg.entryId;
								return (
									<div
										key={msg.entryId}
										className={cn(
											"group flex items-center gap-2 rounded-[12px] px-3 py-2 transition-colors",
											isActive ? "bg-foreground/[0.04]" : "hover:bg-foreground/[0.02]",
										)}
									>
										<div className="flex flex-col items-center">
											<div
												className={cn(
													"flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
													isActive
														? "bg-primary text-primary-foreground"
														: "bg-foreground/[0.08] text-foreground/50",
												)}
											>
												{index + 1}
											</div>
											{index < userMessages.length - 1 ? (
												<div className="mt-0.5 h-3 w-px bg-border/60" />
											) : null}
										</div>
										<div className="min-w-0 flex-1">
											<div className="truncate text-[12px] font-medium text-foreground/85">
												{truncate(msg.text, 60)}
											</div>
											<div className="mt-0.5 text-[10px] text-muted-foreground/60">
												{isActive ? "Current path" : "Fork point"}
											</div>
										</div>
										<Button
											size="icon-sm"
											variant="ghost"
											disabled={isForking || isActive}
											onClick={() => handleFork(msg.entryId)}
											aria-label={`Fork from message ${index + 1}`}
											className={cn(
												"size-7 shrink-0 rounded-[10px]",
												"opacity-0 transition-opacity group-hover:opacity-100",
												isActive && "opacity-0 pointer-events-none",
											)}
										>
											<GitFork className="size-3.5" />
										</Button>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function truncate(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text;
	return `${text.slice(0, maxLen - 1)}…`;
}
