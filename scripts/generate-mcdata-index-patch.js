import * as fs from "fs";
import * as libPath from "path";
//Currently, supported only PC versions
const inputFile = "./node_modules/minecraft-data/data.js";
const outputFile = "./src/launcher/_mcdata-index.cjs";

const oldStorePath = "minecraft-data/data/";
const newStorePath = "game-versions/";

let text = fs.readFileSync(inputFile).toString("utf8");
text = text.replaceAll(oldStorePath, newStorePath);
text = Array.from(text.matchAll(/return require\("(.+?)"\)/g))
  .map((match) => match[1])
  .map((X) => X.match(/(pc|bedrock)\/(.+?)\//))
  
