/* Pre-defined globals those can be used in all skills (`/src/skills/`),
because imports are not available. This allows to restrict & control module imports */

export type * from "../index.ts";

declare global {
  export const mcaEnv: import("./types.ts").SkillEnvironment;
}

export {}
