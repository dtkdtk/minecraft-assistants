import { Item } from "prismarine-item";
import _mfPathfinder from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
// import assert from "assert"; // Don't delete ! 
import { debugLog, Durat, JobPriority, type LocationPoint, type LocationRegion, LocationType, stringifyCoordinates } from "../../index.js";
import type Brain from "../brain.js";
const { Movements, goals } = _mfPathfinder;

const MODULE_NAME = "Mod_Farm"

const HOES = ["wooden_hoe", "stone_hoe", "iron_hoe", "diamond_hoe", "golden_hoe", "netherite_hoe"];
const SEEDS = ["wheat_seeds", "beetroot_seeds", "carrot", "potato"];
const kLocationChest = "chest" ;
const kJobFarming = Symbol("job:farm");

const chestPoint: LocationPoint = {
  key: "chestPoint",
  type: LocationType.Point,
  
  x: 280,   // 280, 64, 300
  y: 64,
  z: 300,   // 260, 65, 280
}

const fieldLocation: LocationRegion = {
  key: "fieldLocation",
  type: LocationType.Region,

  x1: 276,
  y1: 64,
  z1: 306,

  x2: 284,
  y2: 64,
  z2: 314,
}

export default class Mod_Farm {
  
  constructor(private readonly B: Brain) {
    this.update();
  }

  // cd test; node test_bot.js    // it's for me

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

  /*
   *
   *  PREPARE
   * 
   */

  async getReadyToPlant() {
    if (!this.hasNeededItems()) {
      debugLog("I hasn't needed items; trying to find it...");
      if (!await this.takeNeededItems()) return false;
    }
    if (!await this.isOnAField()) {
      debugLog("I'm not on a field; trying to reach it...")
      const closestCorner = this.getNearestFieldCorner();
      if (typeof closestCorner === 'boolean') return closestCorner;
      if (!await this.goToPoint(closestCorner, "field")) return false; 
    }
    debugLog("I am ready to plant.");
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

  async isOnAField(): Promise<boolean> {
    // const fieldLocation = await this.getFieldLocation;
    if (fieldLocation == null) { 
      this.B.warn(`[${MODULE_NAME}] Can't find field location.`);
      return false;
    }
    const atTheField = this.getNearestFieldCorner();
    if (atTheField == true) {
      debugLog(`I'm at the field.`);
      return true;  
    }
    return false;
  }

  getNearestFieldCorner() {
    // const fieldLocation = await this.getFieldLocation;
    if (fieldLocation == null) { 
      this.B.warn(`[${MODULE_NAME}] Can't find field location.`);
      return false;
    }

    debugLog(`Getting field's corners...`)
    const botPos = this.B.bot.entity.position;
    const corners = [
      new Vec3(fieldLocation.x1, fieldLocation.y1, fieldLocation.z1),
      new Vec3(fieldLocation.x2, fieldLocation.y2, fieldLocation.z2),
      new Vec3(fieldLocation.x1, fieldLocation.y1, fieldLocation.z2),
      new Vec3(fieldLocation.x2, fieldLocation.y2, fieldLocation.z1)
    ];
    let closestCorner = corners[0];
    let minDistance = botPos.distanceTo(closestCorner);
    for (const corner of corners) {
      const dist = botPos.distanceTo(corner);
      if (dist < minDistance) {
        minDistance = dist;
        closestCorner = corner;
      }
    }
    if (minDistance <= 0.5) {
      debugLog(`I'm already at the field`);
      return true;
    }
    const returnCorner: LocationPoint = {
      key: "targetFieldCorner",
      type: LocationType.Point,
      x: closestCorner.x,
      y: closestCorner.y,
      z: closestCorner.z
    }
    return returnCorner;
  }

  async takeNeededItems() {
    // Taking chest's coordinates
    const chestPoint = await this.getChestLocation();
    if (chestPoint == null) {
      this.B.warn(`[${MODULE_NAME}] Cannot get chest location.`);
      return false;
    }
    // Going to the chest
    if (!await this.goToPoint(chestPoint, "chest", 1.5)) {
      this.B.warn(`[${MODULE_NAME}] Cannot reach the chest.`);
      return false;
    }

    const chestBlock = this.B.bot.blockAt(new Vec3(chestPoint.x, chestPoint.y, chestPoint.z));
    if (chestBlock === null) {
      this.B.warn(`[${MODULE_NAME}] Cannot find chest block at ${stringifyCoordinates(chestPoint)}.`);
      return false;
    }
    if (chestBlock.name !== kLocationChest) {
      this.B.warn(`[${MODULE_NAME}] Block at ${stringifyCoordinates(chestPoint)} is not a chest.`);
      return false;
    }

    // Opening the chest
    await this.B.bot.lookAt(chestBlock.position.offset(0.5, 0.5, 0.5));
    debugLog("I looked at the chest.");
    await new Promise(resolve => setTimeout(resolve, Durat({ sec: 0.5 }))); // TODO: test, did this really needed timeout?
    const chest = await this.B.bot.openChest(chestBlock);
    const itemsInChest = chest.containerItems();


    if (itemsInChest.length == 0) {
      this.B.warn(`[${MODULE_NAME}] There is no items in the chest.`);
      chest.close();
      return false;
    }

    const hasChestHoe = itemsInChest.some(item => item && HOES.includes(item.name));
    const hasChestSeeds = itemsInChest.some(item => item && SEEDS.includes(item.name));
    if (!hasChestHoe && !hasChestSeeds) {
      this.B.warn(`[${MODULE_NAME}] There is no needed items in the chest.`);
      chest.close();
      return false;
    }

    // Taking needed items
    let tookItems = false;
    const inventoryItems = this.B.bot.inventory.items();
    if (!(inventoryItems.some((item: Item | null) => 
      item !== null && HOES.includes(item.name)))) {
        const hoeItem = itemsInChest.find(item => item && HOES.includes(item.name));
        if (hoeItem) {
          await chest.withdraw(hoeItem.type, null, 1);
          debugLog(`I took hoe: ${hoeItem.name}`);
          tookItems = true;
      } else {
          this.B.warn(`[${MODULE_NAME}] There is no any hoes.`);
          return false;
        }
    }
    
    if (!(inventoryItems.some((item: Item | null) => 
      item !== null && SEEDS.includes(item.name)))) {
        const seedsItem = itemsInChest.find(item => item && SEEDS.includes(item.name));
        if (seedsItem) {
          await chest.withdraw(seedsItem.type, null, seedsItem.count);
          debugLog(`I took seeds: ${seedsItem.name}`);
          tookItems = true;
      } else {
          this.B.warn(`[${MODULE_NAME}] There is no any seeds.`);
          return false;
        }
    }

    if (!tookItems) {
      chest.close();
      this.B.warn(`[${MODULE_NAME}] I didn't take any needed items.`)
      return false;
    }

    chest.close();
    debugLog("I took needed items.");
    return true;
  }

  async goToPoint( botGoal: LocationPoint, pointDisplayName?: string, range?: number ): Promise<boolean> {
    if (!pointDisplayName) pointDisplayName = "point";
    // Didn't the bot already gone to the chest?
    const botPos = this.B.bot.entity.position;
    const distance = botPos.distanceTo(new Vec3(botGoal.x, botGoal.y, botGoal.z));
    if (range && distance <= range) {
        debugLog(`Bot near the ${pointDisplayName} now.`);
        return true;
    }

    // Stopping any others moves
    if (this.B.bot.pathfinder.isMoving()) {
      this.B.bot.pathfinder.stop();
      debugLog("I stopped any others moves.");
      await new Promise(resolve => setTimeout(resolve, Durat({ sec: 0.5 })));
    }

    const movements = new Movements(this.B.bot);
    movements.canDig = false;
    movements.canOpenDoors = true;
    this.B.bot.pathfinder.setMovements(movements);

    if (!range) range = 0;
    const goal = new goals.GoalNear(botGoal.x, botGoal.y, botGoal.z, range);
    debugLog(`Going to ${pointDisplayName} at ${stringifyCoordinates(botGoal)}...`);

// Trying to reach the point
    try {
      await this.B.bot.pathfinder.goto(goal);
      this.B.bot.pathfinder.setGoal(null);
      debugLog(`Bot reached the ${pointDisplayName}`);
      return true;
    } catch (err) {
      this.B.bot.pathfinder.setGoal(null);  
      this.B.warn(`[${MODULE_NAME}] Movements error.`);
      return false;
    } 
  }

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

  async getFieldLocation(): Promise<LocationRegion | null> {
    // const locationsStore = await DB.locations.findOneAsync({ _id: MODULE_NAME });
    // assert(locationsStore !== null);
    // const fieldLocation = locationsStore.locations.find(loc => loc.key == kLocationField);

    if (fieldLocation === undefined) {
      this.B.warn(`[${MODULE_NAME}] Field location not found.`);
      return null;
    }
    if (fieldLocation.type != LocationType.Region) {
      this.B.warn(`[${MODULE_NAME}] Field location must be a region, not an point/area.`);
      return null;
    }
    return fieldLocation;
  }
  
  // Пометки  для себя (удалю потом)
  // Как засадить грядки?
  // 1. Получить координаты места работ и прийти туда.
  // 2. Скорее всего змейкой пройтись по всем блокам и *обработать* их:
  //  а) если это земля, убрать траву (блок травы, не дёрн), вспахать и, если она запитана водой (вроде бы есть тег в майнкрафте у блока), засадить
  //  б) если культура выросла, то собрать и засадить обратно ту же культуру
  // Алгоритм змейки:
  // 1. Получить координаты каждого блока на поле (который пшеница, не земля) в виде массива. Отсортировать этот массив в виде змейки.
  // 2. Пройтись по всем координатам, и из каждых координат сделать отдельную работу.

  /*
   *
   *  EXECUTE
   * 
   */

  testE() {
    debugLog("EXECUTE TESTED SUCCESSFULLY");
    return true;
  }

  testF() {
    debugLog("FINALIZE TESTED SUCCESSFULLY");
    return true;
  }

}