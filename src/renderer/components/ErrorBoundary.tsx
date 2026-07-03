import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("[ErrorBoundary]", error, info.componentStack);
	}

	handleReload = () => {
		window.location.reload();
	};

	handleReset = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) return this.props.fallback;

			return (
				<div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-background px-8 text-center">
					<div className="flex size-16 items-center justify-center rounded-[20px] bg-destructive/10">
						<svg
							className="size-8 text-destructive"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							role="img"
							aria-label="Error"
						>
							<title>Error</title>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
					</div>
					<div>
						<h1 className="text-[20px] font-semibold tracking-tight text-foreground">
							Something went wrong
						</h1>
						<p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
							An unexpected error occurred. You can try to recover or reload the app.
						</p>
					</div>
					{this.state.error ? (
						<pre className="max-h-32 max-w-lg overflow-auto rounded-[12px] border border-border/40 bg-foreground/[0.03] px-4 py-3 text-left font-mono text-[11px] leading-5 text-muted-foreground">
							{this.state.error.message}
						</pre>
					) : null}
					<div className="flex gap-3">
						<Button variant="secondary" size="md" onClick={this.handleReset}>
							Try again
						</Button>
						<Button variant="primary" size="md" onClick={this.handleReload}>
							Reload app
						</Button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
