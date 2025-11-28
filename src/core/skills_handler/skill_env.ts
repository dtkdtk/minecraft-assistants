/* Currently, the security system is not done.
TODO: Move untrusted things to core-land
TODO: Add validation & sanitization; separate untrusted'n'trusted data'n'sources */

import { type Brain } from "../index.js";
import type { SkillsHandler } from "./handler.js";
import { ModuleNotFoundError, RestrictedRequireProvider } from "./restricted_require.js";
import {
  InvalidManifestError, MissingIntent, type SkillConstructor, type SkillEnvironment,
  skillId_From, SkillIntent, SkillIsNotDefined, type SkillManifest
} from "./types.js";


type VirtualImportsMapObj = Record<string, () => Promise<any>>;

const VirtualCoreImports: VirtualImportsMapObj = {
  "core": () => import("../index_restricted.js"),
};

const VirtualTrustedImports: VirtualImportsMapObj = {
  "mineflayer": () => import("mineflayer"),
  "mineflayer-pathfinder": () => import("mineflayer-pathfinder"),
  "minecraft-data": () => import("minecraft-data").then(D => D.default),
  "prismarine-item": () => import("prismarine-item"),
  "vec3": () => import("vec3"),
};

const VirtualBasicNodeImports: VirtualImportsMapObj = {
  "node:buffer": () => import("node:buffer"),
  "node:constants": () => import("node:constants"),
  "node:events": () => import("node:events"),
  "node:path": () => import("node:path"),
  "node:path/posix": () => import("node:path/posix"),
  "node:path/win32": () => import("node:path/win32"),
  "node:querystring": () => import("node:querystring"),
  "node:stream": () => import("node:stream"),
  "node:stream/consumers": () => import("node:stream/consumers"),
  "node:stream/promises": () => import("node:stream/promises"),
  "node:stream/web": () => import("node:stream/web"),
  "node:string_decoder": () => import("node:string_decoder"),
  "node:timers": () => import("node:timers"),
  "node:timers/promises": () => import("node:timers/promises"),
  "node:util": () => import("node:util"),
  "node:util/types": () => import("node:util/types"),
  "node:zlib": () => import("node:zlib"),
};

const VirtualSystemNodeImports: VirtualImportsMapObj = {
  "node:worker_threads": () => import("node:worker_threads"),
  "node:vm": () => import("node:vm"),
  "node:wasi": () => import("node:wasi"),
  "node:url": () => import("node:url"),
  "node:tty": () => import("node:tty"),
  "node:trace_events": () => import("node:trace_events"),
  "node:tls": () => import("node:tls"),
  "node:test": () => import("node:test"),
  "node:test/reporters": () => import("node:test/reporters"),
  "node:readline": () => import("node:readline"),
  "node:readline/promises": () => import("node:readline/promises"),
  "node:process": () => import("node:process"),
  "node:perf_hooks": () => import("node:perf_hooks"),
  "node:net": () => import("node:net"),
  "node:os": () => import("node:os"),
  "node:module": () => import("node:module"),
  "node:inspector": () => import("node:inspector"),
  "node:http": () => import("node:http"),
  "node:http2": () => import("node:http2"),
  "node:https": () => import("node:https"),
  "node:dns": () => import("node:dns"),
  "node:dns/promises": () => import("node:dns/promises"),
  "node:diagnostics_channel": () => import("node:diagnostics_channel"),
  "node:crypto": () => import("node:crypto"),
  "node:dgram": () => import("node:dgram"),
  "node:child_process": () => import("node:child_process"),
  "node:cluster": () => import("node:cluster"),
  "node:console": () => import("node:console"),
  "node:fs": () => import("node:fs"),
  "node:fs/promises": () => import("node:fs/promises"),
};


export class SkillEnvironmentExemplar implements SkillEnvironment {
  #skillManifest: SkillManifest | undefined;
  #isDefined = false;
  #skillId: string | undefined;
  #grantedIntents: SkillIntent[] = [];
  #requireProvider: RestrictedRequireProvider;
  #brain: Brain;
  #handler: SkillsHandler;
  #filepath: string;

  constructor(brain: Brain, handler: SkillsHandler, filepath: string) {
    this.#requireProvider = new RestrictedRequireProvider(new Map(
      Object.entries(VirtualCoreImports)
      .concat(Object.entries(VirtualTrustedImports))
      .concat(Object.entries(VirtualBasicNodeImports))
      .concat(Object.entries(VirtualSystemNodeImports))
    ));
    this.#brain = brain;
    this.#handler = handler;
    this.#filepath = filepath;
  }

  get logger() {return undefined}
  get skillId() {
    if (this.#skillId === undefined) {
      this.#assertSkillDefined();
      this.#skillId = skillId_From(this.#skillManifest!);
    }
    return this.#skillId;
  }
  get filepath() {
    return this.#filepath;
  }

  require(moduleName: string): Promise<any> {
    this.#assertSkillDefined();
    if (moduleName in VirtualCoreImports) {
      //No intents required
      return this.#requireProvider.require(moduleName);
    }
    else if (moduleName in VirtualTrustedImports) {
      //No intents required
      return this.#requireProvider.require(moduleName);
    }
    else if (moduleName in VirtualBasicNodeImports) {
      this.#assertIntentRequested("ImportBasicNodeModules");
      return this.#requireProvider.require(moduleName);
    }
    else if (moduleName in VirtualSystemNodeImports)
      throw new WrongImportTypeError(moduleName, "requireRestricted");
    else throw new ModuleNotFoundError(moduleName);
  }

  requireRestricted(moduleName: string): Promise<any> {
    this.#assertSkillDefined();
    if (moduleName in VirtualSystemNodeImports) {
      this.#assertIntentRequested("ImportSystemNodeModules");
      return this.#requireProvider.require(moduleName);
    }
    else if (moduleName in VirtualBasicNodeImports)
      throw new WrongImportTypeError(moduleName, "require");
    else if (moduleName in VirtualCoreImports)
      throw new WrongImportTypeError(moduleName, "require");
    else if (moduleName in VirtualTrustedImports)
      throw new WrongImportTypeError(moduleName, "require");
    else throw new ModuleNotFoundError(moduleName);
  }

  async defineSkill(manifest: SkillManifest) {
    if (!validateManifest(manifest)) throw new InvalidManifestError();
    this.#skillManifest = manifest;
    this.#isDefined = true;
    this.#grantedIntents = await this.#handler.requestIntents(manifest.intents);
  }

  loadSkill(skillClass: SkillConstructor) {
    this.#assertSkillDefined();
    this.#handler.registerSkill({
      manifest: this.#skillManifest!,
      constructor_: skillClass,
      id: this.skillId,
      filepath: this.filepath,
      instance: Reflect.construct(skillClass, [this.#brain]),
    });
  }

  checkIntent(intent: SkillIntent): boolean {
    return this.#grantedIntents.includes(intent);
  }


  /**
   * @throws {SkillIsNotDefined}
   */
  #assertSkillDefined() {
    if (!this.#isDefined || this.#skillManifest === undefined) throw new SkillIsNotDefined();
  }

  /**
   * @throws {MissingIntent}
   */
  #assertIntentRequested(intent: SkillIntent) {
    if (!this.#checkIntent(intent)) throw new MissingIntent(intent);
  }

  /**
   * @throws {SkillIsNotDefined}
   */
  #checkIntent(intent: SkillIntent): boolean {
    this.#assertSkillDefined();
    return this.#skillManifest?.intents?.includes(intent) ?? false;
  }
}


export class WrongImportTypeError extends Error {
  constructor(public virtualPath: string, public neededMethod: string) {
    super(`Module '${virtualPath}' (virtual path) must be imported by the [mcaEnv.${neededMethod}()] method.`);
  }
}


function validateManifest(manifest: SkillManifest): boolean {
  return true; //TODO
}
