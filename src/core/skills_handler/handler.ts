import * as libFs from "node:fs";
import { join as joinPath } from "node:path";
import * as libVm from "vm"; //Unsecure!
import type { CoreContext } from "../coreContext.js";
import { InvalidManifestError, SkillIntent, type BotSkillMetadata, type SkillEnvironment } from "../index.js";
import { SkillEnvironmentExemplar } from "./skill_env.js";


export class SkillsHandler {
  #ctx: CoreContext.With<"brain">;
  #skillsDir?: libFs.Dir;
  /** Format: `"full_filepath" => sandbox` */
  #sandboxes = new Map<string, libVm.Script>();
  /** Format: `"full_filepath" => mcaEnv` */
  #environments = new Map<string, SkillEnvironmentExemplar>();

  constructor(ctx: CoreContext.With<"brain">) {
    this.#ctx = ctx;
  }

  /**
   * Must be called from `SkillEnvironmentExemplar.loadSkill()`
   * @internal
   * @throws {...}
   */
  registerSkill(skillData: BotSkillMetadata) {
    const skills = this.#ctx.resources[this.#ctx.restrictedProps.ResourceManager.skills](this.#ctx.trustKey);
    //TODO: Resolve this case & Ask user
    //TODO: Find suspicious names (almost similar, but only 1-2 characters differ)
    if (this.#ctx.resources.querySkillManifest({
      nameId: skillData.manifest.nameId, authorId: skillData.manifest.authorId
    }) !== undefined)
      throw new InvalidManifestError(`Skill with authorID '${skillData.manifest.authorId}'`
        + ` and nameID '${skillData.manifest.nameId}' already exists.`);
    if (!this.#environments.has(skillData.filepath))
      throw new Error(`[INTERNAL] Cannot find environment exemplar for skill '${skillData.id}'`
        + ` by filepath '${skillData.filepath}'.`);
    skills.set(skillData.id, skillData);
    this.#ctx.coreLogger.logInfo(`Successfully registered skill: [${skillData.id}]`);
  }

  /**
   * @returns Granted intents
   */
  async requestIntents(intents: SkillIntent[]): Promise<SkillIntent[]> {
    //TODO: Ask user
    return intents;
  }

  async loadSkillsDirectory() {
    const skills = this.#ctx.resources[this.#ctx.restrictedProps.ResourceManager.skills](this.#ctx.trustKey);

    if (skills.size > 0) skills.clear();
    if (this.#skillsDir) await this.#skillsDir.close();
    const dirPath = joinPath(process.cwd(), this.#ctx.brain.configuration.skillsDirPath!);
    if (!libFs.existsSync(dirPath))
      libFs.mkdirSync(dirPath, { recursive: true });
    this.#skillsDir = libFs.opendirSync(dirPath);

    const processingSkills: Promise<unknown>[] = [];
    for await (const skillEnt of this.#skillsDir) {
      if (!skillEnt.isFile() || !skillEnt.name.endsWith(".js")) continue;
      this.#ctx.coreLogger.logDebug(`Loading skill at file '${skillEnt.name}'`);
  
      const skillPath = joinPath(skillEnt.parentPath, skillEnt.name);
      processingSkills.push(this.#setupSkillSandbox(skillPath, skillEnt.name));
    }
    if (processingSkills.length == 0) this.#ctx.coreLogger.logInfo("No skills to load.");
  }

  #setupSkillSandbox(skillPath: string, skillFileName: string): Promise<boolean> {
    //TODO: Sandboxing
    return new Promise((pReturn, pThrow) => {
      let skillCode;
      try { skillCode = libFs.readFileSync(skillPath, "utf-8") }
      catch (error: unknown) { this.#reportError(error, skillFileName, "file reading"); pReturn(false); return }

      skillCode = `(async () => {;${skillCode};})()`;

      const mcaEnv = new SkillEnvironmentExemplar(this.#ctx.brain, this, skillPath);
      let vmScript;
      try {
        const vmContext = libVm.createContext(this.#createVmContext(mcaEnv));
        vmScript = new libVm.Script(skillCode, { filename: skillFileName });
        vmScript.runInContext(vmContext)
      }
      catch (error: unknown) { this.#reportError(error, skillFileName, "script invocation"); pReturn(false); return }
      
      this.#sandboxes.set(skillPath, vmScript);
      this.#environments.set(skillPath, mcaEnv);
      pReturn(true); return
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
    this.#ctx.coreLogger.logError("Cannot load bot skill: '" + skillFileName + "' (file)");
    this.#ctx.coreLogger.logDevWarn(`Error through skill loading (${phase} phase).`
      + `\n\tFile: '${skillFileName}'`
      + `\n\tError: ${error?.toString()}`);
  }
}
