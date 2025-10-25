import * as libFs from "node:fs";
import { join as joinPath } from "node:path";
import * as libVm from "vm"; //Unsecure!
import { debugLog, InvalidManifestError, SkillIntent, type BotSkillMetadata, type Brain, type SkillEnvironment } from "../index.js";
import { SkillEnvironmentExemplar } from "./skill_env.js";


export class SkillsHandler {
  #rootKey: symbol;
  #brain: Brain;
  #skillsDir?: libFs.Dir;
  /** Format: `"full_filepath" => sandbox` */
  #sandboxes = new Map<string, libVm.Script>();
  /** Format: `"full_filepath" => mcaEnv` */
  #environments = new Map<string, SkillEnvironmentExemplar>();

  constructor(brain: Brain, rootKey: symbol) {
    this.#brain = brain;
    this.#rootKey = rootKey;
  }

  /**
   * Must be called from `SkillEnvironmentExemplar.loadSkill()`
   * @internal
   * @throws {...}
   */
  registerSkill(skillData: BotSkillMetadata) {
    const skills = this.#brain.res["derestrict:skills"](this.#rootKey);
    //TODO: Resolve this case & Ask user
    //TODO: Find suspicious names (almost similar, but only 1-2 characters differ)
    if (this.#brain.res.querySkillManifest({
      nameId: skillData.manifest.nameId, authorId: skillData.manifest.authorId
    }) !== undefined)
      throw new InvalidManifestError(`Skill with authorID '${skillData.manifest.authorId}'`
        + ` and nameID '${skillData.manifest.nameId}' already exists.`);
    if (!this.#environments.has(skillData.filepath))
      throw new Error(`[INTERNAL] Cannot find environment exemplar for skill '${skillData.id}'`
        + ` by filepath '${skillData.filepath}'.`);
    skills.set(skillData.id, skillData);
    debugLog(`Successfully registered skill: [${skillData.id}]`);
  }

  /**
   * @returns Granted intents
   */
  async requestIntents(intents: SkillIntent[]): Promise<SkillIntent[]> {
    //TODO: Ask user
    return intents;
  }

  async loadSkillsDirectory() {
    const skills = this.#brain.res["derestrict:skills"](this.#rootKey);

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
    if (processingSkills.length == 0) debugLog("No skills to load.");
  }

  #setupSkillSandbox(skillPath: string, skillFileName: string): Promise<boolean> {
    //TODO: Sandboxing
    return new Promise((pReturn, pThrow) => {
      let skillCode;
      try { skillCode = libFs.readFileSync(skillPath, "utf-8") }
      catch (error: unknown) { this.#reportError(error, skillFileName, "file reading"); return pReturn(false) }

      skillCode = `(async () => {;${skillCode};})()`;

      const mcaEnv = new SkillEnvironmentExemplar(this.#brain, this, skillPath);
      let vmScript;
      try {
        const vmContext = libVm.createContext(this.#createVmContext(mcaEnv));
        vmScript = new libVm.Script(skillCode, { filename: skillFileName });
        vmScript.runInContext(vmContext)
      }
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
