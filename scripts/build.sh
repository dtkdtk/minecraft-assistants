#!/bin/sh
#CWD: Project root

rm -r -f ./dist
rm -r -f ./build
npm i --no-fund
npx tsc
powershell -File ./scripts/generate-mcdata-index-patch.ps1
powershell -File ./scripts/generate-mcversions-table.ps1
powershell -File ./scripts/generate-version-dependencies-table.ps1

#Little patch
cp ./node_modules/minecraft-data/data.js ./~__minecraft-data--data.js
cp ./src/launcher/_mcdata-index.cjs ./node_modules/minecraft-data/data.js

#Bundle launcher
mkdir ./build
cp -r ./src/launcher/program ./build/program
cp ./src/launcher/ReleaseReadme.md ./build/README.md
cp ./LICENSE ./build/LICENSE
cp ./package.json ./build/program/package.json

#Bundle core & dependencies
npx esbuild ./dist/core/init_bot.js --bundle --outfile=./build/program/mca-bundle.cjs --format=cjs --platform=node

#Revert patch
cp ./~__minecraft-data--data.js ./node_modules/minecraft-data/data.js
rm ./~__minecraft-data--data.js
