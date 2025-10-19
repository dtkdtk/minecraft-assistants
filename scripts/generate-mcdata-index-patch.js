//CWD: project root
import * as fs from "fs";
import * as libPath from "path";

if (process.cwd().split(libPath.sep).at(-1) == "scripts")
  throw new Error("Process CWD must be project root");

const inputFile = "./node_modules/minecraft-data/data.js";
const outputFile = "./dist/mcdata-real-index.cjs";

const oldStorePath = "minecraft-data/data/";
const newStorePath = "repository/game-versions/";

let text = fs.readFileSync(inputFile).toString("utf8");
text = text.replaceAll(oldStorePath, newStorePath)
  .replaceAll("return require", "return getData")
  .replaceAll("__dirname", "currentDir")
  .replace("module.exports =", "module.exports = getData => (")
  + ")";
text = "//This file is auto-generated. Please do not make changes manually.\n"
  + "//This file must be re-generated if 'minecraft-data' module was updated.\n"
  + "//Script: '/scripts/generate-mcdata-index-patch.js'\n"
  + "const currentDir = process.cwd().replaceAll('\\\\', '/');\n"
  + text;

fs.writeFileSync(outputFile, text);
