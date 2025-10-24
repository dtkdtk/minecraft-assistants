#!/bin/sh
#CWD: Project root

if [ $(basename "$PWD") = "scripts" ]; then
  echo "Error: Process CWD must be project root"
  exit 1
fi

rm -r -f ./dist
rm -r -f ./build
mkdir ./build
mkdir ./build/repository
mkdir ./build/repository/game-versions
npm i --no-fund
cd ./src/core ; npx tsc ; cd -
cd ./src/skills ; npx tsc ; cd -
node ./scripts/generate-compressed-mcdata.js
node ./scripts/generate-mcdata-index-patch.js
node ./scripts/generate-mcversions-table.js
node ./scripts/build-skills.js

#Little patch
cp ./node_modules/minecraft-data/data.js ./build/~original--mcdata-index.js #Save origin
cp ./src/launcher/_mcdata-provider.cjs ./node_modules/minecraft-data/data.js #Inject modified
cp ./dist/mcdata-real-index.cjs ./node_modules/minecraft-data/_real-index.js

#Bundle launcher
cp -r ./src/launcher/program ./build/
cp -r ./dist/compressed-mcdata/pc ./build/repository/game-versions/pc
cp -r ./dist/skills_flat ./build/skills
cp ./src/launcher/ReleaseReadme.md ./build/README.md
cp ./LICENSE ./build/LICENSE
cp ./package.json ./build/program/package.json
cp ./dist/mcversions-index.json ./build/program/

#Bundle core & dependencies
npx esbuild ./dist/core/init_bot.js --bundle \
  --outfile=./build/program/mca-bundle.cjs --format=cjs --platform=node

#Revert patch
cp ./build/~original--mcdata-index.js ./node_modules/minecraft-data/data.js
rm ./build/~original--mcdata-index.js
rm ./node_modules/minecraft-data/_real-index.js
