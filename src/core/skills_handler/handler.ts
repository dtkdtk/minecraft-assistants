import * as libFs from "fs";
import { join as joinPath } from "path";
import * as libVm from "vm"; //Unsecure!
import { debugLog, InvalidManifestError, SkillIntent, type BotSkillMetadata, type Brain, type SkillEnvironment } from "../index.js";
import { SkillEnvironmentExemplar } from "./skill_env.js";

const kFriendKey_SkillsHandler = Symbol("friendKey_SkillsHandler");

export class SkillsHandler {
  #friendKey_Brain: symbol;
  #brain: Brain;
  #skillsDir?: libFs.Dir;
  /** Format: `"full_filepath" => sandbox` */
  #sandboxes = new Map<string, libVm.Script>();
  /** Format: `"full_filepath" => mcaEnv` */
  #environments = new Map<string, SkillEnvironmentExemplar>();

  constructor(brain: Brain, friendKey_Brain: symbol) {
    this.#brain = brain;
    this.#friendKey_Brain = friendKey_Brain;
  }

  /**
   * Must be called from `SkillEnvironmentExemplar.loadSkill()`
   * @internal
   */
  registerSkill(skillData: BotSkillMetadata) {
    const skills = this.#brain.res["derestrict:skills"](this.#friendKey_Brain);
    //TODO: Resolve this case & Ask user
    //TODO: Find suspicious names (almost similar, but only 1-2 characters differ)
    if (this.#brain.res.querySkillManifest({
      nameId: skillData.manifest.nameId, authorId: skillData.manifest.authorId
    }) !== undefined)
      throw new InvalidManifestError(`Skill with authorID '${skillData.manifest.authorId}'`
        + ` and nameID '${skillData.manifest.nameId}' already exists.`);
    const env = this.#environments.get(skillData.filepath);
    if (!env) throw new Error(`[INTERNAL] Cannot find environment exemplar for skill '${skillData.id}'`
      + ` by filepath '${skillData.filepath}'.`);
    const executeDeferredLoad = env["derestrict:executeDeferredLoad"](kFriendKey_SkillsHandler);
    skills.set(skillData.id, skillData);
    executeDeferredLoad();
  }

  /**
   * @returns Granted intents
   */
  async requestIntents(intents: SkillIntent[]): Promise<SkillIntent[]> {
    //TODO: Ask user
    return intents;
  }

  async loadSkillsDirectory() {
    const skills = this.#brain.res["derestrict:skills"](this.#friendKey_Brain);

    if (skills.size > 0) skills.clear();
    if (this.#skillsDir) await this.#skillsDir.close();
    const dirPath = joinPath(process.cwd(), this.#brain.configuration.skillsDirPath!);
    if (!libFs.existsSync(dirPath))
      libFs.mkdirSync(dirPath, { recursive: true });
    this.#skillsDir = libFs.opendirSync(dirPath);

    const processingSkills: Promise<unknown>[] = [];
    for await (const skillEnt of this.#skillsDir) {
      if (!skillEnt.isFile() || !skillEnt.name.endsWith(".js")) continue;
      debugLog(`Loading skill at file '${skillEnt.name}'`);
  
      const skillPath = joinPath(skillEnt.parentPath, skillEnt.name);
      processingSkills.push(this.#setupSkillSandbox(skillPath, skillEnt.name));
    }
    
  }

  #setupSkillSandbox(skillPath: string, skillFileName: string): Promise<boolean> {
    //TODO: Sandboxing
    return new Promise((pReturn, pThrow) => {
      let skillCode;
      try { skillCode = libFs.readFileSync(skillPath, "utf-8") }
      catch (error: unknown) { this.#reportError(error, skillFileName, "file reading"); return pReturn(false) }

      const mcaEnv = new SkillEnvironmentExemplar(this.#brain, this, skillPath, kFriendKey_SkillsHandler);
      const vmContext = libVm.createContext(this.#createVmContext(mcaEnv));
      const vmScript = new libVm.Script(skillCode, { filename: skillFileName });
      try { vmScript.runInContext(vmContext) }
      catch (error: unknown) { this.#reportError(error, skillFileName, "script invocation"); return pReturn(false) }
      
      this.#sandboxes.set(skillPath, vmScript);
      this.#environments.set(skillPath, mcaEnv);
      return pReturn(true);
    });
  }

  #createVmContext(mcaEnv: SkillEnvironment): object {
    return {
      ...globalThis,
      process: undefined,
      require: undefined,
      console: undefined,
      mcaEnv,
    };
  }

  #reportError(error: unknown, skillFileName: string, phase: string) {
    this.#brain.warn("Cannot load bot skill: '" + skillFileName + "' (file)");
    debugLog(`Error through skill loading (${phase} phase).`
      + `\n\tFile: '${skillFileName}'`
      + `\n\tError: ${error?.toString()}`);
  }
}
