import { JobPriority, LocationPoint, LocationType } from "../../types.js";
import type Brain from "../brain.js";
import { Item } from "prismarine-item";
import _mfPathfinder from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
import assert from "assert"; // Don't delete !
import { debuglog } from "util";
import { debug } from "console";
const { Movements, goals } = _mfPathfinder;

const MODULE_NAME = "Mod_Farm"

const HOES = ["wooden_hoe", "stone_hoe", "iron_hoe", "diamond_hoe", "netherite_hoe"];
const HOES_IDS = [290, 291, 292, 293, 494];
const SEEDS = ["wheat_seeds", "beetroot_seeds", "carrot", "potato"];
const SEEDS_IDS = [295, 457, 391, 392];
const kLocationChest = "chest" 
const kJobFarming = Symbol("job:farm")

const chestPoint: LocationPoint = {
  key: "chestPoint",
  type: LocationType.Point,
  
  x: 280,
  y: 64,
  z: 300,
}

export default class Mod_Farm {
  
  constructor(private readonly B: Brain) {
    // this.update();
  }

  // cd test; node test_bot.js // it's for me

  // It's main metod.
  update() {
    this.B.addJob({
      cursor: 0,
      jobIdentifier: kJobFarming,
      jobDisplayName: "Farming",
      createdAt: Date.now(),
      priority: JobPriority.Plain,
      validate: async () => this.testV(),
      prepare: async () => await this.getReadyToPlant(),
      execute: async () => this.testE(),
      finalize: async () => this.testF(),
    });
  }

  testV() {
    console.log("VALIDATE TESTED SUCCESFULLY");
    return true;
  }

  testE() {
    console.log("EXECUTE TESTED SUCCESFULLY");
    return true;
  }

  testF() {
    console.log("FINALIZE TESTED SUCCESFULLY");
    return true;
  }

  // Did bot ready to plant?
  async getReadyToPlant() {
    if (!this.hasNeededItems()) {
      debugLog("I hasn't needed items; trying to find it...");
      if (!(await this.takeNeededItems())) return false;
    }
    debugLog("I took needed items.")
    return true;
  }

  // Did bot have item?
  hasNeededItems() {
    const inventoryItems = this.B.bot.inventory.items();
    if (!(inventoryItems.some((item: Item | null) => 
      item !== null && HOES.includes(item.name)))) {
      return false;
    }
    if (!(inventoryItems.some((item: Item | null) => 
      item !== null && SEEDS.includes(item.name)))) {
      return false;
    }
    return true;
  }

  // If haven't needed items, taking it
  async takeNeededItems() {
    // Going to the chest
    if (!this.goToChest()) {
      this.B.warn(`[${MODULE_NAME}] Cannot go to the chest.`)
      return false;
    }    
    const chestBlock = this.B.bot.blockAt(new Vec3(chestPoint.x, chestPoint.y, chestPoint.z));
    if (chestBlock === null) {
      this.B.warn(`[${MODULE_NAME}] Cannot find chest block at ${stringifyCoordinates(chestPoint)}.`);
      return false;
    };
    if (chestBlock.name !== kLocationChest) {
      this.B.warn(`[${MODULE_NAME}] Block at ${stringifyCoordinates(chestPoint)} is not a chest.`);
      return false;
    };

    // Opening the chest
    const chest = await this.B.bot.openChest(chestBlock)
    const itemsInChest = chest.items();
    if (itemsInChest === null) {
      this.B.warn(`[${MODULE_NAME}] There is no items in the chest.`);
      this.B.bot.closeWindow;
      return false;
    }

    // Taking items from chest
    const inventoryItems = this.B.bot.inventory.items();
    if (!(inventoryItems.some((item: Item | null) => 
      item !== null && HOES.includes(item.name)))) {
      if (!(itemsInChest.some((item: Item | null) => 
        item !== null && HOES.includes(item.name)))) {
          this.B.warn(`[${MODULE_NAME}] Can't find any hoe in the chest.`)
          return false;
        } else { for (const hoe_id of HOES_IDS) try {
          const itemStack = await chest.withdraw(hoe_id, null, 1);
        } catch (err) {
          continue;
        }}
      }
    if (!(inventoryItems.some((item: Item | null) => 
      item !== null && SEEDS.includes(item.name)))) {
      if (!(itemsInChest.some((item: Item | null) => 
        item !== null && SEEDS.includes(item.name)))) {
          this.B.warn(`[${MODULE_NAME}] Can't find any seeds in the chest.`)
          return false;
        } else { for (const seed_id of SEEDS_IDS) try {
          const itemStack = await chest.withdraw(seed_id, null, 64);
        } catch (err) {
          continue;
        }}
      }
    
    this.B.bot.closeWindow;
    debugLog("I took needed items.");
    return true;
  }

  // How to go to chest
  async goToChest(): Promise<boolean> {
    // Taking chest's coordinates
    const chestPoint = await this.getChestLocation();
    if (chestPoint === null) {
      this.B.warn("Can't get chest location.")
      return false;
    }

    // Haven't bot already at the chest?
    const botPos = this.B.bot.entity.position;
    const distance = botPos.distanceTo(new Vec3(chestPoint.x, chestPoint.y, chestPoint.z));
    if (distance < 2) {
        debugLog("Bot near the chest now.");
        return true;
    }

    // Stopping any others moves (DON'T WORK)
    // if (this.B.bot.pathfinder.isMoving()) {
    //   this.B.bot.pathfinder.stop();
    //   await new Promise(resolve => setTimeout(resolve, +Durat.sec(1)));
    // }

    // Set's mineflayer-pathfinder's movements
    const movements = new Movements(this.B.bot);
    movements.canDig = false;
    movements.canOpenDoors = true;
    this.B.bot.pathfinder.setMovements(movements);

    const goal = new goals.GoalNear(chestPoint.x, chestPoint.y, chestPoint.z, 1);
    debugLog(`Going to chest at ${stringifyCoordinates(chestPoint)}`);

    // Try to reach the chest
    try {
      await this.B.bot.pathfinder.goto(goal);
      debuglog("Bot reached the chest.");
      return true;
    } catch (err) {
      this.B.warn(`[${MODULE_NAME}] Movements error.`);
      return false;
    } finally {
      this.B.bot.pathfinder.setGoal(null);
    }
  }

  // Taking chest coordinates
  async getChestLocation(): Promise<LocationPoint | null> {
    // const locationsStore = await DB.locations.findOneAsync({ _id: MODULE_NAME });
    // assert(locationsStore !== null);
    // const chestPoint = locationsStore.locations.find(loc => loc.key == kLocationChest);

    if (chestPoint === undefined) {
      this.B.warn(`[${MODULE_NAME}] Chest location not found.`);
      return null;
    }
    if (chestPoint.type != LocationType.Point) {
      this.B.warn(`[${MODULE_NAME}] Chest location must be a single point, not an area/region.`);
      return null;
    }
    return chestPoint;
  }
}