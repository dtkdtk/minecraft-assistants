@rmdir /S /Q .\dist

@cd .\src\core
call npx tsc
@cd ..\..\

@cd .\src\skills
call npx tsc
@cd ..\..\

@cd .\src\core
call npx tsc --watch
@cd ..\..\
