import * as fs from "fs";
import * as libPath from "path";

const versionsDir = "./node_modules/minecraft-data/minecraft-data/data/pc";
const outputFile = "./src/launcher/program/available-mc-versions.json";

const dirs = fs.readdirSync(versionsDir)
  .filter(item => {
    const fullPath = libPath.join(versionsDir, item);
    return fs.statSync(fullPath).isDirectory();
  });

const result = [];

for (const dir of dirs) {
  const fullDirPath = libPath.join(versionsDir, dir);
  let totalSize = 0;
  
  function calculateSize(dirPath) {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = libPath.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory())
        calculateSize(fullPath);
      else
        totalSize += stat.size;
    }
  }
  
  calculateSize(fullDirPath);
  
  result.push({
    version: dir,
    sizeMB: Math.round(totalSize / 1024 / 1024 * 1000) / 1000
  });
}

fs.writeFileSync(outputFile, JSON.stringify(result));
