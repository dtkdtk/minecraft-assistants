import { JobPriority, LocationPoint, LocationType } from "../../types.js";
import type Brain from "../brain.js";
import { Item } from "prismarine-item";
import _mfPathfinder from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
import assert from "assert";
const { Movements, goals } = _mfPathfinder;

const MODULE_NAME = "Mod_Farm"

const HOES = ["wooden_hoe", "stone_hoe", "iron_hoe", "diamond_hoe", "netherite_hoe"];
const HOES_IDS = [290, 291, 292, 293, 494];
const SEEDS = ["wheat_seeds", "beetroot_seeds", "carrot", "potato"];
const SEEDS_IDS = [295, 457, 391, 392];
const kLocationChest = "chest" // TODO: учёт сундуков с ловушкой
const kJobFarming = Symbol("job:farm")

export default class Mod_Farm {
  
  constructor(private readonly B: Brain) {}
  
  update() {
    this.B.addJob({
      cursor: 0,
      jobIdentifier: kJobFarming,
      jobDisplayName: "Farming",
      createdAt: Date.now(),
      priority: JobPriority.Plain,
      prepare: () => this.getReadyToPlant(),
      validate: () => this.test(),
      execute: () => this.test(),
      finalize: () => this.test(),
    });
  }

  test() {
    console.log("TESTED SUCCESFULLY");
    return true;
  }

  getReadyToPlant() {
    if (!this.hasNeededItems()) this.takeNeededItems();
    return true;
  }

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

  async takeNeededItems() {
    const chestPoint = await this.getChestLocation();
    if (chestPoint === null) return false;
    const movements = new Movements(this.B.bot);
    movements.canDig = false;
    movements.canOpenDoors = true;
    const goal = new goals.GoalNear(chestPoint.x, chestPoint.y, chestPoint.z, 1);
    this.B.bot.pathfinder.setMovements(movements);
    debugLog(`Going to chest at ${stringifyCoordinates(chestPoint)}`);
    await this.B.bot.pathfinder.goto(goal);

    const chestBlock = this.B.bot.blockAt(new Vec3(chestPoint.x, chestPoint.y, chestPoint.z));
    if (chestBlock === null) {
      this.B.warn(`[${MODULE_NAME}] Cannot find chest block at ${stringifyCoordinates(chestPoint)}.`);
      return false;
    };
    if (chestBlock.name !== "minecraft:chest") {
      this.B.warn(`[${MODULE_NAME}] Block at ${stringifyCoordinates(chestPoint)} is not a chest.`);
      return false;
    }; // TODO: Выделить ходьбу в отдельный метод

    const chest = await this.B.bot.openChest(chestBlock)
    const itemsInChest = chest.items();
    if (itemsInChest === null) {
      this.B.warn(`[${MODULE_NAME}] There is no items in the chest.`);
      return false;
    }

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
    
    return true; // TODO: Учесть переполнение инвенторя
  }

  async getChestLocation(): Promise<LocationPoint | null> {
    const locationsStore = await DB.locations.findOneAsync({ _id: MODULE_NAME });
    assert(locationsStore !== null);
    const chestPoint = locationsStore.locations.find(loc => loc.key == kLocationChest); // TODO: учёт сундуков с ловушкой
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