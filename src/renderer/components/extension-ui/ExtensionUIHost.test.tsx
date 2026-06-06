import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ExtensionUIHost } from "@/components/extension-ui/ExtensionUIHost";
import { useExtensionUI } from "@/stores/extension-ui";
import { useSessions } from "@/stores/session-state";

beforeEach(() => {
	useExtensionUI.setState({
		currentDialog: null,
		notifications: [],
		statuses: {},
		widgets: {},
		editorTextOverride: null,
		titleOverride: null,
	});
	useSessions.setState({
		currentSessionId: "session-1",
	});
});

describe("ExtensionUIHost", () => {
	it("renders widgets and statuses only for the current session", () => {
		const { handleRequest } = useExtensionUI.getState();

		handleRequest({
			type: "extension_ui_request",
			id: "widget-current",
			sessionId: "session-1",
			method: "setWidget",
			widgetKey: "current-widget",
			widgetLines: ["current widget"],
		});
		handleRequest({
			type: "extension_ui_request",
			id: "widget-other",
			sessionId: "session-2",
			method: "setWidget",
			widgetKey: "other-widget",
			widgetLines: ["other widget"],
		});
		handleRequest({
			type: "extension_ui_request",
			id: "status-current",
			sessionId: "session-1",
			method: "setStatus",
			statusKey: "current-status",
			statusText: "current status",
		});
		handleRequest({
			type: "extension_ui_request",
			id: "status-other",
			sessionId: "session-2",
			method: "setStatus",
			statusKey: "other-status",
			statusText: "other status",
		});

		render(<ExtensionUIHost />);

		expect(screen.getByText("current widget")).toBeInTheDocument();
		expect(screen.getByText("current status")).toBeInTheDocument();
		expect(screen.queryByText("other widget")).not.toBeInTheDocument();
		expect(screen.queryByText("other status")).not.toBeInTheDocument();
	});

	it("does not render session-scoped widgets or statuses without a current session", () => {
		useSessions.setState({ currentSessionId: null });
		const { handleRequest } = useExtensionUI.getState();

		handleRequest({
			type: "extension_ui_request",
			id: "widget-current",
			sessionId: "session-1",
			method: "setWidget",
			widgetKey: "current-widget",
			widgetLines: ["current widget"],
		});
		handleRequest({
			type: "extension_ui_request",
			id: "status-current",
			sessionId: "session-1",
			method: "setStatus",
			statusKey: "current-status",
			statusText: "current status",
		});

		render(<ExtensionUIHost />);

		expect(screen.queryByText("current widget")).not.toBeInTheDocument();
		expect(screen.queryByText("current status")).not.toBeInTheDocument();
	});
});
