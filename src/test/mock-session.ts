/**
 * Factory for creating mock AgentSession objects used in main-process tests.
 *
 * Each method is a vi.fn() so tests can assert calls and override return values.
 */
import { vi } from "vitest";

export interface MockAgentSession {
	prompt: ReturnType<typeof vi.fn>;
	steer: ReturnType<typeof vi.fn>;
	followUp: ReturnType<typeof vi.fn>;
	abort: ReturnType<typeof vi.fn>;
	model: string;
	thinkingLevel: string;
	isStreaming: boolean;
	isCompacting: boolean;
	steeringMode: string;
	followUpMode: string;
	sessionFile: string;
	sessionId: string;
	sessionName: string;
	autoCompactionEnabled: boolean;
	messages: unknown[];
	pendingMessageCount: number;
	sessionManager: {
		getLeafId: ReturnType<typeof vi.fn>;
	};
	modelRegistry: {
		getAvailable: ReturnType<typeof vi.fn>;
	};
	extensionRunner: {
		getRegisteredCommands: ReturnType<typeof vi.fn>;
	};
	promptTemplates: unknown[];
	resourceLoader: {
		getSkills: ReturnType<typeof vi.fn>;
	};
	setModel: ReturnType<typeof vi.fn>;
	cycleModel: ReturnType<typeof vi.fn>;
	setThinkingLevel: ReturnType<typeof vi.fn>;
	cycleThinkingLevel: ReturnType<typeof vi.fn>;
	setSteeringMode: ReturnType<typeof vi.fn>;
	setFollowUpMode: ReturnType<typeof vi.fn>;
	compact: ReturnType<typeof vi.fn>;
	setAutoCompactionEnabled: ReturnType<typeof vi.fn>;
	setAutoRetryEnabled: ReturnType<typeof vi.fn>;
	abortRetry: ReturnType<typeof vi.fn>;
	executeBash: ReturnType<typeof vi.fn>;
	abortBash: ReturnType<typeof vi.fn>;
	getSessionStats: ReturnType<typeof vi.fn>;
	exportToHtml: ReturnType<typeof vi.fn>;
	getLastAssistantText: ReturnType<typeof vi.fn>;
	setSessionName: ReturnType<typeof vi.fn>;
	getMessages: ReturnType<typeof vi.fn>;
	getUserMessagesForForking: ReturnType<typeof vi.fn>;
}

export function createMockSession(overrides: Partial<MockAgentSession> = {}): MockAgentSession {
	return {
		prompt: vi.fn().mockResolvedValue(undefined),
		steer: vi.fn().mockResolvedValue(undefined),
		followUp: vi.fn().mockResolvedValue(undefined),
		abort: vi.fn().mockResolvedValue(undefined),
		model: "claude-sonnet-4-20250514",
		thinkingLevel: "off",
		isStreaming: false,
		isCompacting: false,
		steeringMode: "off",
		followUpMode: "off",
		sessionFile: "/tmp/test-session.json",
		sessionId: "test-session-id",
		sessionName: "Test Session",
		autoCompactionEnabled: true,
		messages: [],
		pendingMessageCount: 0,
		sessionManager: {
			getLeafId: vi.fn().mockReturnValue(null),
		},
		modelRegistry: {
			getAvailable: vi.fn().mockResolvedValue([]),
		},
		extensionRunner: {
			getRegisteredCommands: vi.fn().mockReturnValue([]),
		},
		promptTemplates: [],
		resourceLoader: {
			getSkills: vi.fn().mockReturnValue({ skills: [] }),
		},
		setModel: vi.fn().mockResolvedValue(undefined),
		cycleModel: vi.fn().mockResolvedValue(null),
		setThinkingLevel: vi.fn(),
		cycleThinkingLevel: vi.fn().mockReturnValue(null),
		setSteeringMode: vi.fn(),
		setFollowUpMode: vi.fn(),
		compact: vi.fn().mockResolvedValue({}),
		setAutoCompactionEnabled: vi.fn(),
		setAutoRetryEnabled: vi.fn(),
		abortRetry: vi.fn(),
		executeBash: vi.fn().mockResolvedValue({ output: "", exitCode: 0 }),
		abortBash: vi.fn(),
		getSessionStats: vi.fn().mockReturnValue({
			sessionFile: "/tmp/test-session.json",
			sessionId: "test-session-id",
			userMessages: 0,
			assistantMessages: 0,
			toolCalls: 0,
			toolResults: 0,
			totalMessages: 0,
			tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			cost: 0,
		}),
		exportToHtml: vi.fn().mockResolvedValue("/tmp/export.html"),
		getLastAssistantText: vi.fn().mockReturnValue(null),
		setSessionName: vi.fn(),
		getMessages: vi.fn().mockReturnValue([]),
		getUserMessagesForForking: vi.fn().mockReturnValue([]),
		...overrides,
	};
}
