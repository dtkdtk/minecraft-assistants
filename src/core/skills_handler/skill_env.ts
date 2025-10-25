/* Currently, the security system is not done.
TODO: Move untrusted things to core-land
TODO: Add validation & sanitization; separate untrusted'n'trusted data'n'sources */

import { type Brain } from "../index.js";
import type { SkillsHandler } from "./handler.js";
import { ModuleNotFoundError, RestrictedRequireProvider } from "./restricted_require.js";
import {
  InvalidManifestError, MissingIntent, type SkillConstructor, type SkillEnvironment,
  skillId_From,
  SkillIntent, SkillIsNotDefined, type SkillManifest
} from "./types.js";


type VirtualImportsMapObj = Record<string, () => Promise<any>>;

const VirtualCoreImports: VirtualImportsMapObj = {
  "core": () => import("../index.js"),
};

const VirtualTrustedImports: VirtualImportsMapObj = {
  "mineflayer": () => import("mineflayer"),
  "mineflayer-pathfinder": () => import("mineflayer-pathfinder"),
  "minecraft-data": () => import("minecraft-data").then(D => D.default),
  "prismarine-item": () => import("prismarine-item"),
  "vec3": () => import("vec3"),
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
    else if (moduleName in VirtualSystemNodeImports) {
      this.#assertIntentRequested("ImportSystemNodeModules");
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


function validateManifest(manifest: SkillManifest): boolean {
  return true; //TODO
}
