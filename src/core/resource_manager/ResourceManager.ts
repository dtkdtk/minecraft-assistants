import { type CoreContext } from "../coreContext.js";
import { RestrictedAccessViolation, type BotSkillMetadata, type SkillManifest } from "../index.js";

/* De-restriction keys */
const DK_skills = Symbol();
const DK_querySkillData = Symbol();

export class ResourceManager {
  /** TODO: document */
  #ctx: CoreContext;
  #skills = new Map<string, BotSkillMetadata>();

  constructor(ctx: CoreContext) {
    this.#ctx = ctx;
  }

  getSkill(skillId: string) {
    return this.#skills.get(skillId);
  }
  querySkillId(query: Partial<BotSkillMetadata>) {
    return runSingleMapQuery(this.#skills, query);
  }
  querySkillManifest(query: Partial<SkillManifest>) {
    const queryKeys = Object.keys(query) as (keyof SkillManifest)[];;
    for (const {manifest} of this.#skills.values()) {
      const queryResult = partialFullCompare(manifest, query, queryKeys);
      if (queryResult) return manifest;
    }
  }
  #querySkillData(query: Partial<BotSkillMetadata>) {
    const K = this.querySkillId(query);
    return K ? this.#skills.get(K) : undefined;
  }

  static readonly DK_skills: typeof DK_skills = DK_skills;
  [DK_skills](trustKey: symbol) {
    if (trustKey !== this.#ctx.trustKey)
      throw new RestrictedAccessViolation(ResourceManager.name, "#skills");
    return this.#skills;
  }
  static readonly DK_querySkillData: typeof DK_querySkillData = DK_querySkillData;
  [DK_querySkillData](trustKey: symbol) {
    if (trustKey !== this.#ctx.trustKey)
      throw new RestrictedAccessViolation(ResourceManager.name, "#querySkillData");
    return this.#querySkillData.bind(this);
  }
}


export class SkillResources {
  get() {}
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
