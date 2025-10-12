//CWD: project root
import * as fs from "fs";
import * as libPath from "path";
import * as zlib from "zlib";
import { promisify } from "util";

/* Only JSON files are being compressed, because only they are loaded dynamically,
  and YAML files' weight is under 5% of the original minecraft-data weight
  (so they won't be compressed) */

if (process.cwd().split(libPath.sep).at(-1) == "scripts")
  throw new Error("Process CWD must be project root");

const inputDir = "./node_modules/minecraft-data/minecraft-data/data/";
const outputDir = "./dist/compressed-mcdata/";

function mustBeDirectory(path) {
  return fs.statSync(path).isDirectory();
}

async function readAndCompress(path) {
  let content = fs.readFileSync(path).toString("utf8");
  if (path.endsWith(".json")) {
    content = JSON.stringify(JSON.parse(content)); //Uglify JSON
    content = zlib.gzipSync(content, { level: 2 });
  }
  return content;
}

function recursiveWriteFile(path, content) {
  const directory = libPath.dirname(path);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path, content);
}

const allPlatforms = fs.readdirSync(inputDir)
  .filter(path => mustBeDirectory(libPath.join(inputDir, path)));

for (const platformName of allPlatforms) {
  const platformVersionsDir = fs.readdirSync(libPath.join(inputDir, platformName))
    .filter(path => mustBeDirectory(libPath.join(inputDir, platformName, path)));
  for (const versionName of platformVersionsDir) {
    const versionPath = libPath.join(inputDir, platformName, versionName);
    const versionDir = fs.readdirSync(versionPath);
    for (const fileName of versionDir) {
      promisify(() => {
        const fullPath = libPath.join(versionPath, fileName);
        readAndCompress(fullPath).then(compressed => {
          const destPath = libPath.join(outputDir, platformName, versionName, fileName);
          recursiveWriteFile(destPath, compressed);
        });
      })();
    }
  }
}
