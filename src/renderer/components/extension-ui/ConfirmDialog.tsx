import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { ExtensionUIConfirmRequest } from "@/lib/rpc";

interface Props {
	request: ExtensionUIConfirmRequest;
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmDialog({ request, onConfirm, onCancel }: Props) {
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
		>
			<DialogContent className="max-w-[400px] rounded-[24px] p-0">
				<div className="flex flex-col items-center px-8 pt-8">
					<div className="mb-5 flex size-12 items-center justify-center rounded-full bg-primary/10">
						<AlertTriangle className="size-5 text-primary" />
					</div>
					<DialogHeader className="text-center">
						<DialogTitle className="text-[18px] font-semibold tracking-tight">
							{request.title}
						</DialogTitle>
						<p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
							{request.message}
						</p>
					</DialogHeader>
				</div>
				<DialogFooter className="flex-row gap-3 border-t border-border/50 px-8 py-5">
					<Button
						variant="ghost"
						size="md"
						className="flex-1 rounded-full text-[14px]"
						onClick={onCancel}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						size="md"
						className="flex-1 rounded-full text-[14px]"
						onClick={onConfirm}
					>
						Confirm
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
