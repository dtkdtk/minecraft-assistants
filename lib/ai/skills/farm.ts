import { Item } from "prismarine-item";
import _mfPathfinder from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
// import assert from "assert"; // Don't delete ! 
import { debugLog, Durat, JobPriority, JobUnit, type LocationPoint, type LocationRegion, LocationType, stringifyCoordinates } from "../../index.js";
import type Brain from "../brain.js";
import { Block } from "prismarine-block";
const { Movements, goals } = _mfPathfinder;

const MODULE_NAME = "Mod_Farm"

const HOES = ["wooden_hoe", "stone_hoe", "iron_hoe", "diamond_hoe", "golden_hoe", "netherite_hoe"];
const SEEDS = ["wheat_seeds", "beetroot_seeds", "carrot", "potato"];
const CROPS = ["wheat", "beetroots", "carrots", "potatoes"];
const DIRT_BLOCKS = ["farmland", "dirt", "grass_block"];
const kLocationChest = "chest";
const kJobFarming = Symbol("job:farm");

type MatrixCell = Vec3 | null;    //  [ X, Y, Z ] | null
type DynamicMatrix = MatrixCell[][];

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

  private _fieldMatrix: DynamicMatrix = [];
  
  constructor(private readonly B: Brain) {
    this.update();
  }

  update() {
    this.B.addJob(new Job_Farming(this));
  }

  async goToPoint( botGoal: LocationPoint | Vec3, pointDisplayName?: string, range?: number ): Promise<boolean> {
    if (!pointDisplayName) pointDisplayName = "point";
    // Didn't the bot already gone to the point?
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
    // debugLog(`Going to ${pointDisplayName} at ${stringifyCoordinates(botGoal)}...`);

// Trying to reach the point
    try {
      await this.B.bot.pathfinder.goto(goal);
      this.B.bot.pathfinder.setGoal(null);
      // debugLog(`Bot reached the ${pointDisplayName}`);
      return true;
    } catch (err) {
      this.B.bot.pathfinder.setGoal(null);  
      this.B.warn(`[${MODULE_NAME}] Movements error.`);
      return false;
    } 
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

  async getReadyToPlant(): Promise<boolean> {
    if (!this.hasNeededItems()) {
      debugLog("I hasn't needed items; trying to find it...");
      if (!await this.takeNeededItems()) return false;
    }
    if (!this.createFieldMatrix()) {
      this.B.warn(`[${MODULE_NAME}] Can't create field matrix.`);
      return false;
    }
    if (!this.createFieldMatrix()) return false;
    debugLog("I am ready to plant.");
    return true;
  }

  hasNeededItems(): boolean {
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

  // this will be used later
  getNearestFieldCorner(): boolean | LocationPoint {
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

  async takeNeededItems(): Promise<boolean> {
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
  
  createFieldMatrix(): boolean {
    // const fieldLocation = await this.getFieldLocation;
    if (fieldLocation == null) { 
      this.B.warn(`[${MODULE_NAME}] Can't find field location.`);
      return false;
    }

    let xRows: number = Math.abs(fieldLocation.x1 - fieldLocation.x2) + 1;  
    let zCols: number = Math.abs(fieldLocation.z1 - fieldLocation.z2) + 1;

    if (fieldLocation.y1 !== fieldLocation.y2) {
      this.B.warn(`[${MODULE_NAME}] Field is not flat. Matrix creation aborted.`);
      return false;
    }

    const xStep: number = fieldLocation.x1 <= fieldLocation.x2 ? 1 : -1;
    const zStep: number = fieldLocation.z1 <= fieldLocation.z2 ? 1 : -1;

    this._fieldMatrix = [];

    for (let i = 0; i < xRows; i++) {
      const row: MatrixCell[] = [];
      for (let j = 0; j < zCols; j++) {
        const x = fieldLocation.x1 + i * xStep;
        const z = fieldLocation.z1 + j * zStep;
        row.push(new Vec3(x, fieldLocation.y1, z));
      }
      this._fieldMatrix.push(row);
    }
    console.log(this._fieldMatrix);
    return true;
  }

  // Пометки  для себя (удалю потом)
  // Как засадить грядки?
  // 1. Получить координаты места работ и прийти туда.
  // 2. Скорее всего змейкой пройтись по всем блокам и *обработать* их:
  //  а) если это земля, убрать траву (блок травы, не дёрн), вспахать и, если она запитана водой (вроде бы есть тег в майнкрафте у блока), засадить
  //  б) если культура выросла, то собрать и засадить обратно ту же культуру
  // Алгоритм змейки:
  // 1. Получить координаты каждого блока на поле (который пшеница, не земля) в виде массива. 
  // 2. Пройтись по всем координатам змейкой, и из каждых координат сделать отдельную работу.

  /*
   *
   *  EXECUTE
   * 
   */

  async processBlock(block: Vec3 | null): Promise<boolean> {
    if (block == null) return true;
    const Block = this.B.bot.blockAt(block);
    if (!(Block == null || Block.name == "air" || CROPS.includes(Block.name))) {
      debugLog(`There is skipped block: ${stringifyCoordinates(block)}.`);
      block = null;
      return true;
    }

    const underBlock = this.B.bot.blockAt(new Vec3(block.x, block.y - 1, block.z));
    if (!(underBlock == null || DIRT_BLOCKS.includes(underBlock.name))) {
      debugLog(`There is skipped block: ${stringifyCoordinates(block)}.`);
      block = null;
      return true;
    }

    if (!await this.goToPoint(block)) {
      this.B.warn(`[${MODULE_NAME}] Cannot reach next point: ${stringifyCoordinates(block)}`);
      return false;
    }

    if (!await this.farmABlock(block)) return false;

    debugLog(`Block processed.`);
    return true;
  }

  async farmABlock(block: Vec3,): Promise<boolean> {
    const Block = this.B.bot.blockAt(block);
    const underBlock = new Vec3(block.x, block.y - 1, block.z);
    const UnderBlock = this.B.bot.blockAt(underBlock);
    if (UnderBlock == null) {      // underBlock cannot be a null, but VSC can't understand it :(
      this.B.warn(`[${MODULE_NAME}] !!! UNEXPECTED ERROR AT farmABlock(), REPORT DEVELOPERS.`);
      return false;
    }

    if (UnderBlock.name == DIRT_BLOCKS[0]) {   // farmland
      debugLog(`This block ${stringifyCoordinates(new Vec3(block.x, block.y - 1, block.z))} is FARMLAND.`)
      if (!await this.procFarmlandBlock(block, underBlock)) {
        debugLog(`Can't process this block.`);
        return false;
      }
    } 

    if (UnderBlock.name == DIRT_BLOCKS[1] || UnderBlock.name == DIRT_BLOCKS[2]) {  // dirt || grass_block
      debugLog(`This block ${stringifyCoordinates(new Vec3(block.x, block.y - 1, block.z))} isn't farmland.`);

    }

    debugLog(`This block is successfully farmed.`);
    return true;
  }

  async procFarmlandBlock(block: Vec3, underBlock: Vec3): Promise<boolean> {
    const Block = this.B.bot.blockAt(block);
    if (Block == null) {            // Block cannot be a null, but VSC can't understand it :(
      this.B.warn(`[${MODULE_NAME}] !!! UNEXPECTED ERROR AT processFarmlandBlock(), REPORT DEVELOPERS.`);
      return false;
    }
    const UnderBlock = this.B.bot.blockAt(underBlock);
    if (UnderBlock == null) {       // the same
      this.B.warn(`[${MODULE_NAME}] !!! UNEXPECTED ERROR AT processFarmlandBlock(), REPORT DEVELOPERS.`);
      return false;
    }
    if (!this.isBlockWatered(UnderBlock)){
      debugLog(`This farmland isn't supplied with water.`)
      return false;
    }

    if (!this.hasNeededItems) return false;
    const inventoryItems = this.B.bot.inventory.items();

    if (Block.type == 0) {
      debugLog(`Planting seeds...`)
      const seed = inventoryItems.find(item => SEEDS.includes(item.name));
      if (!seed) return false;
      await this.B.bot.equip(seed, "hand");
      await this.B.bot.lookAt(underBlock)
      await this.B.bot.activateBlock(UnderBlock);
      await this.B.bot.unequip("hand");
    } else debugLog(`${Block.type}`)

    return true;
  }

  isBlockWatered(block: Block): boolean {
    const blockCoordinates: Vec3 = block.position;
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        const checkBlock = new Vec3(blockCoordinates.x + x, blockCoordinates.y, blockCoordinates.z + z);
        if (this.B.bot.blockAt(checkBlock)?.type == 8) return true;   // 8 - water id
      }
    }
    return false;
  }

  async createJobsQueue(): Promise<boolean> {
    let isForward = true;
    for (const row of this._fieldMatrix) {
      const start = isForward ? 0 : row.length - 1;
      const end = isForward ? row.length : -1;
      const step = isForward ? 1 : -1;

      for (let i = start; i !== end; i += step) {
        await this.processBlock(row[i]);
        debugLog("");
      }
      isForward = !isForward;
    }
    return true;
  }

  /*
  *
  *  FINALIZE
  * 
  */

  testF() {
    debugLog("FINALIZE TESTED SUCCESSFULLY");
    return true;
  }

  testP() {
    debugLog(`PAUSE TESTED SUCCESSFULLY`);
    return;
  }

}

class Job_Farming implements JobUnit {
  jobIdentifier: symbol | null;
  jobDisplayName: string;
  createdAt: number;
  priority: JobPriority;
  validate? (): Promise<boolean>;
  prepare? (): Promise<boolean>;
  execute: () => Promise<boolean>;
  finalize? (): Promise<boolean>;

  constructor(M: Mod_Farm) {
    this.jobIdentifier = kJobFarming,
    this.jobDisplayName = "Farming",
    this.createdAt = Date.now(),
    this.priority = JobPriority.Plain,
    this.validate = async () => M.testV(),
    this.prepare = async () => await M.getReadyToPlant(),
    this.execute = async () => await M.createJobsQueue(),
    this.finalize = async () => M.testF()
  }
}