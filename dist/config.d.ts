import { Config } from "./types";
export declare function configPath(): string;
export declare function configExists(): boolean;
export declare function loadConfig(): Config;
export declare function saveConfig(config: Config): void;
export declare const DEFAULT_OPENAI_PROMPT: string;
export declare function initConfig(): Promise<Config>;
export declare function addModule(modulePath: string): Config;
export declare function removeModule(modulePath: string): Config;
/** Returns true if any changed file belongs to one of the user's modules */
export declare function isMyPR(changedFiles: string[], myModules: string[]): boolean;
//# sourceMappingURL=config.d.ts.map