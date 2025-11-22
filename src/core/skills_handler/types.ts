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

  require(mod: "mineflayer"): Promise<typeof import("mineflayer")>;
  require(mod: "mineflayer-pathfinder"): Promise<typeof import("mineflayer-pathfinder")>;
  require(mod: "minecraft-data"): Promise<typeof import("minecraft-data")>;
  require(mod: "prismarine-item"): Promise<typeof import("prismarine-item")>;
  require(mod: "vec3"): Promise<typeof import("vec3")>;

  require(mod: "node:buffer"): Promise<typeof import("node:buffer")>;
  require(mod: "node:constants"): Promise<typeof import("node:constants")>;
  require(mod: "node:events"): Promise<typeof import("node:events")>;
  require(mod: "node:path"): Promise<typeof import("node:path")>;
  require(mod: "node:path/posix"): Promise<typeof import("node:path/posix")>;
  require(mod: "node:path/win32"): Promise<typeof import("node:path/win32")>;
  require(mod: "node:querystring"): Promise<typeof import("node:querystring")>;
  require(mod: "node:stream"): Promise<typeof import("node:stream")>;
  require(mod: "node:stream/consumers"): Promise<typeof import("node:stream/consumers")>;
  require(mod: "node:stream/promises"): Promise<typeof import("node:stream/promises")>;
  require(mod: "node:stream/web"): Promise<typeof import("node:stream/web")>;
  require(mod: "node:string_decoder"): Promise<typeof import("node:string_decoder")>;
  require(mod: "node:timers"): Promise<typeof import("node:timers")>;
  require(mod: "node:timers/promises"): Promise<typeof import("node:timers/promises")>;
  require(mod: "node:util"): Promise<typeof import("node:util")>;
  require(mod: "node:util/types"): Promise<typeof import("node:util/types")>;
  require(mod: "node:zlib"): Promise<typeof import("node:zlib")>;

  /**
   * Import restricted Node module.
   * You must require `ImportSystemNodeModules` intent in the Manifest.
   * 
   * This is a specialization of the {@link SkillEnvironment.require()}.
   * @throws {SkillIsNotDefined | MissingIntent}
   */
  requireRestricted(mod: "node:console"): Promise<typeof import("node:console")>;
  requireRestricted(mod: "node:fs"): Promise<typeof import("node:fs")>;
  requireRestricted(mod: "node:fs/promises"): Promise<typeof import("node:fs/promises")>;
  requireRestricted(mod: "node:worker_threads"): Promise<typeof import("node:worker_threads")>;
  requireRestricted(mod: "node:vm"): Promise<typeof import("node:vm")>;
  requireRestricted(mod: "node:wasi"): Promise<typeof import("node:wasi")>;
  requireRestricted(mod: "node:url"): Promise<typeof import("node:url")>;
  requireRestricted(mod: "node:tty"): Promise<typeof import("node:tty")>;
  requireRestricted(mod: "node:trace_events"): Promise<typeof import("node:trace_events")>;
  requireRestricted(mod: "node:tls"): Promise<typeof import("node:tls")>;
  requireRestricted(mod: "node:test"): Promise<typeof import("node:test")>;
  requireRestricted(mod: "node:test/reporters"): Promise<typeof import("node:test/reporters")>;
  requireRestricted(mod: "node:readline"): Promise<typeof import("node:readline")>;
  requireRestricted(mod: "node:readline/promises"): Promise<typeof import("node:readline/promises")>;
  requireRestricted(mod: "node:process"): Promise<typeof import("node:process")>;
  requireRestricted(mod: "node:perf_hooks"): Promise<typeof import("node:perf_hooks")>;
  requireRestricted(mod: "node:net"): Promise<typeof import("node:net")>;
  requireRestricted(mod: "node:os"): Promise<typeof import("node:os")>;
  requireRestricted(mod: "node:module"): Promise<typeof import("node:module")>;
  requireRestricted(mod: "node:inspector"): Promise<typeof import("node:inspector")>;
  requireRestricted(mod: "node:inspector/promises"): Promise<typeof import("node:inspector/promises")>;
  requireRestricted(mod: "node:http"): Promise<typeof import("node:http")>;
  requireRestricted(mod: "node:http2"): Promise<typeof import("node:http2")>;
  requireRestricted(mod: "node:https"): Promise<typeof import("node:https")>;
  requireRestricted(mod: "node:dns"): Promise<typeof import("node:dns")>;
  requireRestricted(mod: "node:dns/promises"): Promise<typeof import("node:dns/promises")>;
  requireRestricted(mod: "node:diagnostics_channel"): Promise<typeof import("node:diagnostics_channel")>;
  requireRestricted(mod: "node:crypto"): Promise<typeof import("node:crypto")>;
  requireRestricted(mod: "node:dgram"): Promise<typeof import("node:dgram")>;
  requireRestricted(mod: "node:child_process"): Promise<typeof import("node:child_process")>;
  requireRestricted(mod: "node:cluster"): Promise<typeof import("node:cluster")>;

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
  readonly moduleName?: string;
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


export type SkillIntent =
  /**
   * Allow to import "vacuum" Node modules that haven't access to user's machine,
   * like `node:stream`, `node:util`, `node:buffer`, etc.
   * 
   * These modules are safe, but they depend on the Node platform and cannot be imported
   * inside other environments (not Node). Use them with awareness.
   */
  | "ImportBasicNodeModules"
  /**
   * Allow to import system Node modules, like `node:fs`, `node:net`, `node:process`, etc.
   * 
   * These modules are destructive and could destroy the user's machine, or violate privacy.
   */
  | "ImportSystemNodeModules"
;

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
    super(`Skill does not requested intent [${intent}], but used it.`);
  }
}

export class SkillIsNotDefined extends SkillError {}

export class InvalidManifestError extends SkillError {
  //TODO
}


export function skillId_From(skillMf: SkillManifest): string {
  const author = skillMf.authorId;
  const name = skillMf.nameId;
  return [author, name].join(".");
}
