import { SkillManifest, type BotSkillMetadata } from "./skills_handler/types.js";
import { RestrictedAccessViolation } from "./types.js";

export class ResourceManager {
  /** TODO: document */
  #rootKey: symbol;
  #skills = new Map<string, BotSkillMetadata>();

  constructor(rootKey: symbol) {
    this.#rootKey = rootKey;
  }

  getSkill(skillId: string) {
    return this.#skills.get(skillId);
  }
  querySkillId(query: Partial<BotSkillMetadata>) {
    return runSingleMapQuery(this.#skills, query);
  }
  querySkillData(query: Partial<BotSkillMetadata>) {
    const K = this.querySkillId(query);
    return K ? this.#skills.get(K) : undefined;
  }
  querySkillManifest(query: Partial<SkillManifest>) {
    const queryKeys = Object.keys(query) as (keyof SkillManifest)[];;
    for (const {manifest} of this.#skills.values()) {
      const queryResult = partialFullCompare(manifest, query, queryKeys);
      if (queryResult) return manifest;
    }
  }
  ["derestrict:skills"] (rootKey: symbol) {
    if (rootKey !== this.#rootKey)
      throw new RestrictedAccessViolation(ResourceManager.name, "#skills");
    else return this.#skills;
  }
}


export class SkillResources {
  get(resourceId: string) {}
}


function runSingleMapQuery<V extends object>(map: Map<string, V>, query: Partial<V>): string | undefined {
  const queryKeys = Object.keys(query) as (keyof typeof query)[];
  for (const [K, V] of map.entries())
    if (partialFullCompare(V, query, queryKeys)) return K;
  return undefined;
}

function partialFullCompare<T extends object>(obj: T, mask: Partial<T>, maskKeys: (keyof T)[]): boolean {
  for (const K of maskKeys)
    if (obj[K] !== mask[K]) return false;
  return true;
}
