Welcome to the minecraft-assistants developer documentation. There you can find some information.

# Table of contents

1. Introducing the project; Structure
2. Building the project



# 1. Introducing the project; Structure

## Intro

Minecraft-assistants is an user-end application that adds multifunctional bots to the Minecraft game.
App must be user-friendly (don't forget: Our target auditory is kids & teens) and super-simply to install.

## Requirements

- NodeJS v22+ (but the project is MAYBE compatible with v18)
- Shell/Bash (for windows: Batch) scripts support
- (Test environment) Minecraft server (with no mods and `online-mode=false`)
- 450+ MB of disk space *(yes, MCA dev env is fat)*

## Technical part

Minecraft-assistants is built with TypeScript, JavaScript and Node (because the main library `mineflayer` is written in JS).
We are using some of JS libraries:
- `mineflayer` :: The main project library. A simple way to communicate with Minecraft server
- `mineflayer-pathfinder`, `minecraft-data`, `prismarine-item`, `vec3` :: Mineflayer additional libraries
- `@sealdio/nedb` :: Simply JSON database
- `chalk` :: Terminal colors
> Note: Node v20+ has builtin `node:util/stylizeText()` function. Our target Node version is v18, so we can't use this feature.
- `ini` :: Parse & serialize user-oriented `.ini` configuration file format

For development:
- `eslint` :: JS/TS code checker & linter
- `esbuild` :: JS/TS code bundler (compress source code to one file)
- `typescript` :: TypeScript language compiler

### Project structure

All source code is in the `/src/` directory.
- `/src/`
  - `launcher/` :: User-friendly minecraft-assistants (MCA) wrapper. Provides bootstrapping, error handling, configuration management, and so on
  - `core/` :: Minecraft-assistants core. The bot. Provides control-panel, job management, data storing
  - `skills/` :: Bot skills, such as sleeping, eating, farming. Like plugins
- `/scripts/`
  - `build.sh` :: Build & bundle the application
  - `build.bat` :: Windows version of `build.sh`
  - `dev.bat` :: Windows version of `npm run dev`
- `/test/`
  - `pen_test/` :: Simply & fast development test (WITHOUT launcher)
  - `prod_test/` :: Full production test (WITH launcher)

After build:
- `/dist/` :: Compiled TypeScript code (from `/src/`)
- `/build/` :: User-end product (bundle + launcher)



# 2. Building the project

.
