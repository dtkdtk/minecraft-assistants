import * as fs from "fs";
import * as libPath from "path";
import assert from "assert";
import { exec } from "child_process";

assert(process.cwd().split(libPath.sep).at(-1) != "scripts", "Process CWD must be project root");

const distDirPath = "./dist/";
const originalPath = libPath.join(distDirPath, "skills");
const destinationPath = libPath.join(distDirPath, "skills_flat");

assert(fs.existsSync(distDirPath) && fs.existsSync(originalPath),
  "You must build core & skills before testing.");

if (!fs.existsSync(destinationPath)) fs.mkdirSync(destinationPath);
const originalDir = fs.opendirSync(originalPath);

for await (const subdirName of originalDir) {
  const entryFilePath = libPath.join(process.cwd(), originalPath, subdirName.name, subdirName.name + ".js");
  const bundlePath = libPath.join(process.cwd(), destinationPath, subdirName.name + ".js");

  if (!fs.existsSync(entryFilePath)) {
    console.error(`The 'dist/skills/${subdirName.name}/' must contain '${subdirName.name}.js' file.`);
    continue;
  }
  const batchCallPrefix = process.argv[2] == "--WinBatch" ? "call " : "";
  exec(batchCallPrefix + `npx esbuild "${entryFilePath}" --bundle --outfile="${bundlePath}" --format=iife --platform=neutral`,
    (E, stdout, stderr) => { process.stdout.write(stdout); process.stderr.write(stderr) });
}
