import {
	AuthStorage,
	ModelRegistry,
	getAgentDir,
} from "@earendil-works/pi-coding-agent";

let auth: AuthStorage | undefined;
let modelRegistry: ModelRegistry | undefined;

export interface SharedServices {
	authStorage: AuthStorage;
	modelRegistry: ModelRegistry;
	agentDir: string;
}

export function getSharedServices(): SharedServices {
	if (!auth) auth = AuthStorage.create();
	if (!modelRegistry) modelRegistry = ModelRegistry.create(auth);
	return {
		authStorage: auth,
		modelRegistry,
		agentDir: getAgentDir(),
	};
}
