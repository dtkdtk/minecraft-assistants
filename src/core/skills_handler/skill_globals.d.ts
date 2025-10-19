/* Pre-defined globals those can be used in all skills (`/src/skills/`),
because imports are not available. This allows to restrict & control module imports */

import type { SkillEnvironment } from "./skill_env.ts";

export type * from "../index.ts";


declare global {
  export const mcaEnv: readonly SkillEnvironment;
  export const process: never;
  export const console: never;
  export const require: never;
}

export {}
