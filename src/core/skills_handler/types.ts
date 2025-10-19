/* Everything for skill definition & typing. */

import type Brain from "../brain.js";

/**
 * The skill's environment. Will be passed as global variable to each bot skill.
 * Contains restricted API abstractions for interacting with MCA Core.
 */
export interface SkillEnvironment {
  /**
   * TODO !!
   */
  get logger(): undefined

  /**
   * Absolute file path of the current skill.
   */
  get filepath(): string;

  /**
   * Full skill ID of the current skill.
   * Format: `${authorId}:${nameId}:${version}`
   */
  get skillId(): string;

  /**
   * Import MCA core / Node module.
   * Must be used instead of official module systems (ESM/CJS/AMD/etc.)
   * @throws {SkillIsNotDefined | MissingIntent}
   */
  require(mod: "core"): Promise<typeof import("../index.js")>;
  require(mod: "core:auxiliary"): Promise<typeof import("../auxiliary.js")>;
  require(mod: "core:types"): Promise<typeof import("../types.js")>;
  require(mod: "core:lib/actqueue"): Promise<typeof import("../lib/actqueue.js")>;
  require(mod: "core:lib/durat"): Promise<typeof import("../lib/durat.js")>;
  require(mod: "core:lib/typed_emitter"): Promise<typeof import("../lib/typed_emitter.js")>;

  require(mod: "mineflayer"): Promise<typeof import("mineflayer")>;
  require(mod: "mineflayer-pathfinder"): Promise<typeof import("mineflayer-pathfinder")>;
  require(mod: "minecraft-data"): Promise<typeof import("minecraft-data")>;
  require(mod: "prismarine-item"): Promise<typeof import("prismarine-item")>;

  require(mod: "node:util"): Promise<typeof import("node:util")>;
  require(mod: "node:util/types"): Promise<typeof import("node:util/types")>;

  /**
   * Define skill and allow to perform next actions.
   * Must be called BEFORE any imports or any module code
   * (i.e. at the file beginning)
   */
  defineSkill(manifest: SkillManifest): Promise<void>;

  /**
   * Load skill to the brain and launch it.
   * Must be called AFTER all operations & module code
   * (i.e. at the file ending)
   * @throws {SkillIsNotDefined}
   */
  loadSkill(skillClass: SkillConstructor): void;

  /**
   * Check if intent is granted by the user.
   */
  checkIntent(intent: SkillIntent): boolean;
}


/** All bot skill classes must implement this interface. */
export interface IMcaSkill {
  __WIP__: never;
}
export type SkillConstructor = (new (brain: Brain) => IMcaSkill);


/** @internal */
export interface BotSkillMetadata {
  manifest: SkillManifest;
  constructor_: SkillConstructor;
  id: string;
  filepath: string;
  instance: IMcaSkill;
}


export enum SkillIntent {
  /**
   * Basic Node modules:
   * - `node:util`
   * - `node:util/types`
   */
  ImportBasicNodeModules = "ImportBasicNodeModules",
  /**
   * System Node modules:
   * - `node:process`
   * - `node:fs`
   */
  ImportSystemNodeModules = "ImportSystemNodeModules",
}

export type SkillApiVersion = 100;

export interface SkillManifest {
  apiVersion: SkillApiVersion;
  version: [major:number, minor:number, patch:number];

  /**
   * Skill identifier (e.g. `auto-eat` or `auto-farm.monsters`).
   * May contain only symbols in range `[a-zA-Z0-9_-.]`
   */
  nameId: string;
  displayName: string;

  /**
   * Java-like reversed-domain author name (e.g. `com.google` or `org.mcadev.dtkdtk`)
   * May contain only symbols in range `[a-zA-Z0-9_-.]`
   */
  authorId: string;
  displayAuthor: string;

  /** Maximum: `500` characters */
  description: string;

  /**
   * Permissions requested by skill module.
   * If the user won't grant them, the skill module won't load.
   */
  intents: SkillIntent[];
}

export class SkillError extends Error {
  //TODO: add skill name
}

export class MissingIntent extends SkillError {
  constructor(public intent: SkillIntent) {
    super("Skill does not requested intent [" + intent + "], but used it.");
  }
}

export class SkillIsNotDefined extends SkillError {}

export class InvalidManifestError extends SkillError {
  //TODO
}


export function skillId_From(skillMf: SkillManifest): string {
  const author = skillMf.authorId;
  const name = skillMf.nameId;
  const version = skillMf.version;
  return [author, name, version].join(":");
}
