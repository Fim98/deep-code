import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ComponentProps,
	type ReactNode,
} from "react";
import { ArrowDown, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConversationContextValue {
	viewportRef: React.RefObject<HTMLDivElement | null>;
	isAtBottom: boolean;
	scrollToBottom: () => void;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

function useConversation() {
	const ctx = useContext(ConversationContext);
	if (!ctx) {
		throw new Error("Conversation components must be used inside Conversation");
	}
	return ctx;
}

export function Conversation({
	children,
	className,
	...props
}: ComponentProps<"div">) {
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const [isAtBottom, setIsAtBottom] = useState(true);

	const updateBottomState = useCallback(() => {
		const el = viewportRef.current;
		if (!el) return;
		const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
		setIsAtBottom(distance < 96);
	}, []);

	const scrollToBottom = useCallback(() => {
		const el = viewportRef.current;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
	}, []);

	const value = useMemo(
		() => ({ viewportRef, isAtBottom, scrollToBottom }),
		[isAtBottom, scrollToBottom],
	);

	return (
		<ConversationContext.Provider value={value}>
			<div
				className={cn(
					"relative flex h-full min-h-0 flex-1 flex-col overflow-hidden",
					className,
				)}
				{...props}
			>
				<div
					ref={viewportRef}
					onScroll={updateBottomState}
					className="h-full min-h-0 flex-1 overflow-y-auto scroll-smooth"
				>
					{children}
				</div>
			</div>
		</ConversationContext.Provider>
	);
}

export function ConversationContent({
	children,
	className,
	...props
}: ComponentProps<"div">) {
	const { viewportRef, isAtBottom } = useConversation();

	useEffect(() => {
		if (!isAtBottom) return;
		const el = viewportRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	});

	return (
		<div
			className={cn(
				"mx-auto flex w-full max-w-[840px] flex-col gap-7 px-8 py-8",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function ConversationEmptyState({
	icon = <MessageSquare className="size-7" />,
	title,
	description,
	children,
	className,
	...props
}: ComponentProps<"div"> & {
	icon?: ReactNode;
	title: string;
	description?: string;
}) {
	return (
		<div
			className={cn(
				"flex min-h-[54vh] flex-col items-center justify-center text-center",
				className,
			)}
			{...props}
		>
			<div className="mb-5 flex size-16 items-center justify-center rounded-[24px] bg-primary-soft text-primary shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
				{icon}
			</div>
			<div className="text-[24px] font-medium leading-tight tracking-normal text-foreground">
				{title}
			</div>
			{description ? (
				<p className="mt-3 max-w-md text-[14px] leading-6 text-muted-foreground">
					{description}
				</p>
			) : null}
			{children}
		</div>
	);
}

export function ConversationScrollButton({
	className,
	...props
}: ComponentProps<typeof Button>) {
	const { isAtBottom, scrollToBottom } = useConversation();
	if (isAtBottom) return null;
	return (
		<Button
			type="button"
			size="icon"
			variant="secondary"
			onClick={scrollToBottom}
			aria-label="Scroll to bottom"
			className={cn(
				"absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-card/90 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl",
				className,
			)}
			{...props}
		>
			<ArrowDown className="size-4" />
		</Button>
	);
}
