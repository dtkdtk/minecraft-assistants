import { SkillManifest, type BotSkillMetadata } from "./skills_handler/types.js";
import { RestrictedAccessViolation } from "./types.js";

export class ResourceManager {
  /** TODO: document */
  #friendKey_Brain: symbol;
  #skills = new Map<string, BotSkillMetadata>();

  constructor(friendKey: symbol) {
    this.#friendKey_Brain = friendKey;
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
  ["derestrict:skills"] (friendKey_Brain: symbol) {
    if (friendKey_Brain !== this.#friendKey_Brain)
      throw new RestrictedAccessViolation(ResourceManager.name, "#skills");
    else return this.#skills;
  }
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
