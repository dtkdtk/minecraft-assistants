//CWD: project root
import * as fs from "fs";
import * as libPath from "path";
import assert from "assert";

assert(process.cwd().split(libPath.sep).at(-1) != "scripts", "Process CWD must be project root");

const versionsDir = "./dist/compressed-mcdata/";
const outputFile = "./dist/mcversions-index.json";

if (!fs.existsSync(versionsDir))
  throw new Error("The '/dist/compressed-mcdata/' must be generated"
  + "before calling '/scripts/generate-mcversions-table.js'");

const allPlatforms = fs.readdirSync(versionsDir)
  .filter(item => {
    const fullPath = libPath.join(versionsDir, item);
    return fs.statSync(fullPath).isDirectory();
  });

const result = {};

for (const platform of allPlatforms) {
  const platformVersionsDir = fs.readdirSync(libPath.join(versionsDir, platform))
    .filter(item => {
      const fullPath = libPath.join(versionsDir, platform, item);
      return fs.statSync(fullPath).isDirectory();
    });
  
  result[platform] = [];
  for (const version of platformVersionsDir) {
    result[platform].push(version);
  }
}

fs.writeFileSync(outputFile, JSON.stringify(result));
