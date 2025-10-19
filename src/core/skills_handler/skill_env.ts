/* Currently, the security system is not done.
TODO: Move untrusted things to core-land
TODO: Add validation & sanitization; separate untrusted'n'trusted data'n'sources */

import { type Brain, RestrictedAccessViolation, SomeFunction } from "../index.js";
import type { SkillsHandler } from "./handler.js";
import { ModuleNotFoundError, RestrictedRequireProvider } from "./restricted_require.js";
import {
  type BotSkillMetadata,
  InvalidManifestError, MissingIntent, type SkillConstructor, type SkillEnvironment,
  skillId_From,
  SkillIntent, SkillIsNotDefined, type SkillManifest
} from "./types.js";


type VirtualImportsMapObj = Record<string, () => Promise<any>>;

const VirtualCoreImports: VirtualImportsMapObj = {
  "core:auxiliary": () => import("../auxiliary.js"),
  "core:types": () => import("../types.js"),
  "core:lib/actqueue": () => import("../lib/actqueue.js"),
  "core:lib/durat": () => import("../lib/durat.js"),
  "core:lib/typed_emitter": () => import("../lib/typed_emitter.js"),
};

const VirtualTrustedImports: VirtualImportsMapObj = {
  "mineflayer": () => import("mineflayer"),
  "mineflayer-pathfinder": () => import("mineflayer-pathfinder"),
  "minecraft-data": () => import("minecraft-data"),
  "prismarine-item": () => import("prismarine-item"),
};

const VirtualBasicNodeImports: VirtualImportsMapObj = {
  "node:util": () => import("node:util"),
  "node:util/types": () => import("node:util/types"),
};

const VirtualSystemNodeImports: VirtualImportsMapObj = {
  "node:process": () => import("node:process"),
  "node:fs": () => import("node:fs"),
};


export class SkillEnvironmentExemplar implements SkillEnvironment {
  #friendKey_SkillsHandler: symbol;
  #skillManifest: SkillManifest | undefined;
  #isDefined = false;
  #skillId: string | undefined;
  #grantedIntents: SkillIntent[] = [];
  #requireProvider: RestrictedRequireProvider;
  #brain: Brain;
  #handler: SkillsHandler;
  #filepath: string;
  #deferredLoading?: SomeFunction;

  constructor(brain: Brain, handler: SkillsHandler, filepath: string, friendKey_SkillsHandler: symbol) {
    this.#friendKey_SkillsHandler = friendKey_SkillsHandler;
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
    else if (moduleName in VirtualBasicNodeImports) {
      this.#assertIntentRequested(SkillIntent.ImportBasicNodeModules);
      return this.#requireProvider.require(moduleName);
    }
    else if (moduleName in VirtualSystemNodeImports) {
      this.#assertIntentRequested(SkillIntent.ImportSystemNodeModules);
      return this.#requireProvider.require(moduleName);
    }
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
    const loadFn = () => {
      const instance = Reflect.construct(skillClass, [this.#brain]);
      const skillData: BotSkillMetadata = {
        manifest: this.#skillManifest!,
        constructor_: skillClass,
        id: this.skillId,
        filepath: this.filepath,
        instance,
      };
      this.#handler.registerSkill(skillData);
    };
    this.#deferredLoading = loadFn;
  }

  checkIntent(intent: SkillIntent): boolean {
    return this.#grantedIntents.includes(intent);
  }

  #executeDeferredLoad() {
    if (this.#deferredLoading === undefined)
      throw new Error("Failed to load bot skill after reading all skill files");
    this.#deferredLoading?.call(this);
  }
  ["derestrict:executeDeferredLoad"] (friendKey_SkillsHandler: symbol) {
    if (friendKey_SkillsHandler !== this.#friendKey_SkillsHandler)
      throw new RestrictedAccessViolation(SkillEnvironmentExemplar.name, this.#executeDeferredLoad.name);
    else return this.#executeDeferredLoad.bind(this);
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


function validateManifest(manifest: SkillManifest): boolean {
  return true; //TODO
}
