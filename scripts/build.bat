@rem CWD: Project root

@rmdir /S /Q .\dist
@rmdir /S /Q .\build
@mkdir .\build
@mkdir .\build\repository
@mkdir .\build\repository\game-versions
call npm i --no-fund

@cd .\src\core
call npx tsc
@cd ..\..\

@cd .\src\skills
call npx tsc
@cd ..\..\

node .\scripts\generate-compressed-mcdata.js
node .\scripts\generate-mcdata-index-patch.js
node .\scripts\generate-mcversions-table.js
node .\scripts\build-skills.js --WinBatch

rem Little patch
@copy /Y .\node_modules\minecraft-data\data.js .\build\~original--mcdata-index.js > nul
@copy /Y .\src\launcher\_mcdata-provider.cjs .\node_modules\minecraft-data\data.js > nul
@copy /Y .\dist\mcdata-real-index.cjs .\node_modules\minecraft-data\_real-index.js > nul

rem Bundle launcher
@xcopy /E /I /Y .\src\launcher\program .\build\program > nul
@xcopy /E /I /Y .\dist\compressed-mcdata\pc .\build\repository\game-versions\pc > nul
@xcopy /E /I /Y .\dist\skills_flat .\build\skills > nul
@copy /Y .\Release_README.md .\build\README.md > nul
@copy /Y .\src\launcher\START.bat .\build\START.bat > nul
@copy /Y .\LICENSE .\build\LICENSE > nul
@copy /Y .\package.json .\build\program\package.json > nul
@copy /Y .\dist\mcversions-index.json .\build\program\mcversions-index.json > nul

rem Bundle core & dependencies
call npx esbuild .\dist\core\init_bot.js --bundle --outfile=.\build\program\mca-bundle.cjs --format=cjs --platform=node

rem Revert patch
@copy /Y .\build\~original--mcdata-index.js .\node_modules\minecraft-data\data.js > nul
@del .\build\~original--mcdata-index.js
@del .\node_modules\minecraft-data\_real-index.js
