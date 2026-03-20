import { Config } from "../types";
/** Absolute path to the config file in the user's home directory. */
export declare function configPath(): string;
/** Returns `true` when the config file exists on disk. */
export declare function configExists(): boolean;
/**
 * Loads and parses the config file.
 * Throws a descriptive error when the file does not exist.
 */
export declare function loadConfig(): Config;
/** Serializes `config` and writes it to disk. */
export declare function saveConfig(config: Config): void;
/**
 * Returns `true` when at least one file in `changedFiles` falls inside one of
 * the directories listed in `myModules`.
 * When `myModules` is empty the function always returns `true` (no filter).
 */
export declare function isMyPR(changedFiles: string[], myModules: string[]): boolean;
/**
 * Adds `modulePath` to the `myModules` list and saves the config.
 * Is a no-op (with a console message) when the path is already present.
 */
export declare function addModule(modulePath: string): Config;
/**
 * Removes `modulePath` from the `myModules` list and saves the config.
 * Is a no-op (with a console message) when the path is not found.
 */
export declare function removeModule(modulePath: string): Config;
export declare const DEFAULT_OPENAI_PROMPT: string;
/** Runs an interactive prompt to create or update the config file. */
export declare function initConfig(): Promise<Config>;
//# sourceMappingURL=index.d.ts.map