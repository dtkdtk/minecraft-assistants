import { JobPriority, LocationPoint, LocationType } from "../../types.js";
import type Brain from "../brain.js";
import { Item } from "prismarine-item";
import _mfPathfinder from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
import assert from "assert"; // Don't delete !
const { Movements, goals } = _mfPathfinder;

const MODULE_NAME = "Mod_Farm"

const HOES = ["wooden_hoe", "stone_hoe", "iron_hoe", "diamond_hoe", "golden_hoe", "netherite_hoe"];
const HOES_IDS = [290, 291, 292, 293, 294, 494];
const SEEDS = ["wheat_seeds", "beetroot_seeds", "carrot", "potato"];
const SEEDS_IDS = [295, 457, 391, 392];
const kLocationChest = "chest" ;
const kJobFarming = Symbol("job:farm");

const chestPoint: LocationPoint = {
  key: "chestPoint",
  type: LocationType.Point,
  
  x: 260,   // 280, 64, 300
  y: 65,
  z: 280,   // 260, 65, 280
}

export default class Mod_Farm {
  
  constructor(private readonly B: Brain) {
    //this.update();
  }

  // cd test; node test_bot.js    // it's for me

  // It's main metod, that adding in brain's job's queue a job.
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
    debugLog("VALIDATE TESTED SUCCESSFULLY");
    return true;
  }

  testE() {
    debugLog("EXECUTE TESTED SUCCESSFULLY");
    return true;
  }

  testF() {
    debugLog("FINALIZE TESTED SUCCESSFULLY");
    return true;
  }

  // Did bot ready to plant?
  async getReadyToPlant() {
    if (!this.hasNeededItems()) {
      debugLog("I hasn't needed items; trying to find it...");
      if (!await this.takeNeededItems()) return false;
    }
    debugLog("I have needed items.");
    return true;
  }

  // Did bot have needed item?
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
    if (!await this.goToChest()) {
      this.B.warn(`[${MODULE_NAME}] Cannot reach the chest.`);
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
    await this.B.bot.lookAt(chestBlock.position.offset(0.5, 0.5, 0.5));
    debugLog("I looked at the chest.")
    await new Promise(resolve => setTimeout(resolve, +Durat.sec(0.5)))
    const chest = await this.B.bot.openChest(chestBlock)
    const itemsInChest = chest.containerItems();


    if (itemsInChest.length == 0) {
      this.B.warn(`[${MODULE_NAME}] There is no items in the chest.`);
      chest.close();
      return false;
    }

    const hasChestHoe = itemsInChest.some(item => item && HOES.includes(item.name));
    const hasChestSeeds = itemsInChest.some(item => item && SEEDS.includes(item.name));
    if (!hasChestHoe || !hasChestSeeds) {
      this.B.warn(`[${MODULE_NAME}] There is no needed items in the chest.`);
      chest.close();
      return false;
    }

    // Taking needed items
    let tookItems = false
    const inventoryItems = this.B.bot.inventory.items();
    if (!(inventoryItems.some((item: Item | null) => 
      item !== null && HOES.includes(item.name)))) {
        const hoeItem = itemsInChest.find(item => item && HOES.includes(item.name));
        if (hoeItem) {
          await chest.withdraw(hoeItem.type, null, 1);
          debugLog(`I took hoe: ${hoeItem.name}`);
          tookItems = true;
        }
    }
    
    if (!(inventoryItems.some((item: Item | null) => 
      item !== null && HOES.includes(item.name)))) {
        const seedsItem = itemsInChest.find(item => item && SEEDS.includes(item.name));
        if (seedsItem) {
          await chest.withdraw(seedsItem.type, null, seedsItem.count);
          debugLog(`I took seeds: ${seedsItem.name}`);
          tookItems = true;
      } 
    }

    if (!tookItems) {
      chest.close();
      debugLog("I haven't tooked needeed items.")
      return false;
    }

    chest.close();
    debugLog("I took needed items.");
    return true;
  }

  // How to go to chest
  async goToChest(): Promise<boolean> {
    // Taking chest's coordinates
    const chestPoint = await this.getChestLocation();
    if (chestPoint === null) {
      this.B.warn("Can't get chest location.");
      return false;
    }

    // Haven't bot already at the chest?
    const botPos = this.B.bot.entity.position;
    const distance = botPos.distanceTo(new Vec3(chestPoint.x, chestPoint.y, chestPoint.z));
    if (distance < 2) {
        debugLog("Bot near the chest now.");
        return true;
    }

    // Stopping any others moves
    if (this.B.bot.pathfinder.isMoving()) {
      this.B.bot.pathfinder.stop();
      debugLog("I stopped any others moves.");
      await new Promise(resolve => setTimeout(resolve, +Durat.sec(0.5)));
    }

    // Set's mineflayer-pathfinder's movements
    const movements = new Movements(this.B.bot);
    movements.canDig = false;
    movements.canOpenDoors = true;
    this.B.bot.pathfinder.setMovements(movements);

    const goal = new goals.GoalNear(chestPoint.x, chestPoint.y, chestPoint.z, 1);
    debugLog(`Going to chest at ${stringifyCoordinates(chestPoint)}...`);

    // Trying to reach the chest
    try {
      await this.B.bot.pathfinder.goto(goal);
    } catch (err) {
      this.B.warn(`[${MODULE_NAME}] Movements error.`);
      return false;
    } finally {
      this.B.bot.pathfinder.setGoal(null);
      debugLog("Bot reached the chest.");
      return true;
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