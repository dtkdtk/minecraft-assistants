import { Item } from "prismarine-item";
import _mfPathfinder from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
// import assert from "assert"; // Don't delete !  It's for functions like get***Location()  // ***DO NOT FORGET TO UNCOMMENT ALL COMMENTED USES OF COORDINATES !!!!!!!!!!!!!***
import { debugLog, Durat, JobPriority, AggregateJob, JobUnit, type LocationPoint, type LocationRegion, LocationType, stringifyCoordinates } from "../../index.js";
import type Brain from "../brain.js";
import { Block } from "prismarine-block";
const { Movements, goals } = _mfPathfinder;

const MODULE_NAME = "Mod_Farm"

const HOES = ["wooden_hoe", "stone_hoe", "iron_hoe", "diamond_hoe", "golden_hoe", "netherite_hoe"];
const SEEDS = ["wheat_seeds", "beetroot_seeds", "carrot", "potato"];
const CROPS = ["wheat_seeds", "wheat", "beetroot_seeds", "beetroot", "carrot", "potato", "poisonous_potato"];
const CROP_BLOCKS = ["wheat", "beetroots", "carrots", "potatoes"];
const DIRT_BLOCKS = ["farmland", "dirt", "grass_block"];
const WATER_BLOCKS = ["water", "kelp", "seagrass"];
const CONTAINERS = ['chest', 'dispenser', 'ender_chest', 'shulker_box', 'hopper', 'container', 'dropper', 'trapped_chest', 'barrel', 'white_shulker_box', 'orange_shulker_box', 'magenta_shulker_box', 'light_blue_shulker_box', 'yellow_shulker_box', 'lime_shulker_box', 'pink_shulker_box', 'gray_shulker_box', 'light_gray_shulker_box', 'cyan_shulker_box', 'purple_shulker_box', 'blue_shulker_box', 'brown_shulker_box', 'green_shulker_box', 'red_shulker_box', 'black_shulker_box'];

const kLocationContainer = CONTAINERS;
const kJobFarming = Symbol("job:farm");

type MatrixCell = Vec3 | null;    //  [ X, Y, Z ] | null
type DynamicMatrix = MatrixCell[][];

const containerPoint: LocationPoint = {
  key: "chestPoint",
  type: LocationType.Point,
  
  x: -126,
  y: 66,
  z: 25,
}

const fieldLocation: LocationRegion = {
  key: "fieldLocation",
  type: LocationType.Region,

  x1: -124,
  y1: 66,
  z1: 11,

  x2: -132,
  y2: 66,
  z2: 19,
}

export default class Mod_Farm {
  
  constructor(private readonly B: Brain) {
    this.update();
  }

  update() {
    this.B.addJob(new Job_Farming(this));
  }

  // #region FUNCTIONS 

  /**
   * Отправляет бота в определённую точку.
   * @param botGoal Точка, в которую боту необходимо прийти.
   * @param pointDisplayName Отображаемое в логах имя точки.
   * @param range Радиус, в котором цель считается достигнутой. По умолчанию 0 (бот идёт строго на координаты).
   * @returns `true` если цель достигнута; `false` если нет.
   */
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
      this.B.warn(`[${MODULE_NAME}] I stopped any others moves.`);
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

  async interactWithContainer(operation: 'take' | 'put'): Promise<boolean> {
    // Taking container's coordinates
    const containerPoint = await this.getContainerLocation();
    if (containerPoint == null) {
      this.B.warn(`[${MODULE_NAME}] Cannot get container location.`);
      return false;
    }
    // Going to the container
    if (!await this.goToPoint(containerPoint, "container", 1.5)) {
      this.B.warn(`[${MODULE_NAME}] Cannot reach the container.`);
      return false;
    }

    const containerBlock = this.B.bot.blockAt(new Vec3(containerPoint.x, containerPoint.y, containerPoint.z));
    if (containerBlock === null) {
      this.B.warn(`[${MODULE_NAME}] Cannot find container block at ${stringifyCoordinates(containerPoint)}.`);
      return false;
    }
    if (!(CONTAINERS.includes(containerBlock.name))) {
      this.B.warn(`[${MODULE_NAME}] Block at ${stringifyCoordinates(containerPoint)} is not a container.`);
      return false;
    }

    // Opening the container
    const container = await this.B.bot.openContainer(containerBlock);
    const itemsInContainer = container.containerItems();
    const inventoryItems = this.B.bot.inventory.items();



    if (operation == 'take') {

    if (itemsInContainer.length == 0) {
      this.B.warn(`[${MODULE_NAME}] There is no any items in the container.`);
      container.close();
      return false;
    }

    const hasContainerHoe = itemsInContainer.some(item => item && HOES.includes(item.name));
    const hasContainerSeeds = itemsInContainer.some(item => item && SEEDS.includes(item.name));
    if (!hasContainerHoe && !hasContainerSeeds) {
      this.B.warn(`[${MODULE_NAME}] There is no needed items in the container.`);
      container.close();
      return false;
    }

    // Taking needed items
    let tookItems = false;
    if (!(inventoryItems.some((item: Item | null) => 
      item !== null && HOES.includes(item.name)))) {
        const hoeItem = itemsInContainer.find(item => item && HOES.includes(item.name));
        if (hoeItem) {
          await container.withdraw(hoeItem.type, null, 1);
          debugLog(`I took hoe: ${hoeItem.name}`);
          tookItems = true;
      } else {
          this.B.warn(`[${MODULE_NAME}] There is no any hoes.`);
          return false;
        }
    }
    
    if (!(inventoryItems.some((item: Item | null) => 
      item !== null && SEEDS.includes(item.name)))) {
        const seedsItem = itemsInContainer.find(item => item && SEEDS.includes(item.name));
        if (seedsItem) {
          await container.withdraw(seedsItem.type, null, seedsItem.count);
          debugLog(`I took seeds: ${seedsItem.count} ${seedsItem.name}`);
          tookItems = true;
      } else {
          this.B.warn(`[${MODULE_NAME}] There is no any seeds.`);
          return false;
        }
    }

    if (!tookItems) {
      container.close();
      this.B.warn(`[${MODULE_NAME}] I didn't take any needed items.`)
      return false;
    }

    }



    if (operation == 'put') {
      for (let i = 0; i < inventoryItems.length; i++) {
        if (CROPS.includes(inventoryItems[i].name) || HOES.includes(inventoryItems[i].name)) {
          await container.deposit(inventoryItems[i].type, null, inventoryItems[i].count);
          await new Promise(resolve => setTimeout(resolve, Durat({ sec: 0.05 })));
        }
      }
    }



    container.close();
    debugLog("I interacted with container.");
    return true;
  }

  async getContainerLocation(): Promise<LocationPoint | null> {
    // const locationsStore = await DB.locations.findOneAsync({ _id: MODULE_NAME });
    // assert(locationsStore !== null);
    // const containerPoint = locationsStore.locations.find(loc => kLocationContainer.includes(loc.key));

    if (containerPoint === undefined) {
      this.B.warn(`[${MODULE_NAME}] Container location not found.`);
      return null;
    }
    if (containerPoint.type != LocationType.Point) {
      this.B.warn(`[${MODULE_NAME}] Container location must be a single point, not an area/region.`);
      return null;
    }
    return containerPoint;
  }

  // #endregion








  // #region PREPARE

  /**
   * Основной метод проверки готовности бота к выполнению сельскохозяйственных работ. Проверяет наличие необходимых предметов и создаёт маршрут по полю.
   * @returns `true` если бот готов к посадке; `false` если нет.
   */
  async getReadyToPlant(): Promise<boolean> {
    if (!this.hasNeededItems()) {
      debugLog("I hasn't needed items; trying to find it...");
      if (!await this.interactWithContainer('take')) return false;
    }
    if (!this.createFieldMatrix()) {
      this.B.warn(`[${MODULE_NAME}] Can't create field matrix.`); 
      return false;
    }
    debugLog("I am ready to plant.");
    return true;
  }

  /**
   * Выполняемая в `getReadyToPlant()` проверка на наличие необходимых предметов: мотыга, семена, ~~(опционально) костная мука~~.
   * @returns `true` если у бота есть все необходимые предметы; `false` если нет.
   */
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

  private _fieldMatrix: DynamicMatrix = [];

  createFieldMatrix(): boolean {
    // const fieldLocation = await this.getFieldLocation;
    if (fieldLocation == null) { 
      this.B.warn(`[${MODULE_NAME}] Can't find field location.`);
      return false;
    }

    const xRows: number = Math.abs(fieldLocation.x1 - fieldLocation.x2) + 1;  
    const zCols: number = Math.abs(fieldLocation.z1 - fieldLocation.z2) + 1;

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
    return true;
  }

  // #endregion







  // Пометки  для себя (удалю потом)
  // Как засадить грядки?
  // 1. Получить координаты места работ и прийти туда.
  // 2. Скорее всего змейкой пройтись по всем блокам и *обработать* их:
  //  а) если это земля, убрать траву (блок травы, не дёрн), вспахать и, если она запитана водой (вроде бы есть тег в майнкрафте у блока), засадить
  //  б) если культура выросла, то собрать и засадить обратно ту же культуру
  // Алгоритм змейки:
  // 1. Получить координаты каждого блока на поле (который пшеница, не земля) в виде массива. 
  // 2. Пройтись по всем координатам змейкой, и из каждых координат сделать отдельную работу.

  // #region EXECUTE

  async processBlock(blockVec3: Vec3 | null): Promise<boolean> {
    if (blockVec3 == null) return true;

    const block = this.B.bot.blockAt(blockVec3);
    if (!(block == null || block.name == "air" || CROP_BLOCKS.includes(block.name))) {
      debugLog(`There is skipped block: ${stringifyCoordinates(blockVec3)}.`);
      blockVec3 = null;
      return true;
    }

    const underBlock = this.B.bot.blockAt(new Vec3(blockVec3.x, blockVec3.y - 1, blockVec3.z));
    if (!(underBlock == null || DIRT_BLOCKS.includes(underBlock.name))) {
      debugLog(`Block ${stringifyCoordinates(blockVec3)} is skipped (${underBlock?.displayName}).`);
      blockVec3 = null;
      return true;
    }

    if (!await this.goToPoint(blockVec3)) {
      this.B.warn(`[${MODULE_NAME}] Cannot reach next point: ${stringifyCoordinates(blockVec3)}`);
      return false;
    }

    if (!await this.farmABlock(blockVec3)) return false;

    debugLog(`Block processed.\n`);
    return true;
  }

  async farmABlock(blockVec3: Vec3,): Promise<boolean> {
    const underBlockVec3 = new Vec3(blockVec3.x, blockVec3.y - 1, blockVec3.z);
    const underBlock = this.B.bot.blockAt(underBlockVec3);
    if (underBlock == null) {      // `underBlock` cannot be a null, but VSC can't understand it :(
      this.B.warn(`[${MODULE_NAME}] !!! UNEXPECTED ERROR, REPORT DEVELOPERS. error code: 1`);
      return false;
    }

    if (!this.hasNeededItems()) {
      debugLog("I hasn't needed items; trying to find it...");
      if (!await this.interactWithContainer('take')) return false;
    }

    if (!await this.isBlockWatered(underBlock)){
      debugLog(`This block at ${stringifyCoordinates(underBlockVec3)} is not supplied with water.`);
      return false;
    }

    if (underBlock.name == DIRT_BLOCKS[0]) {   // farmland
      debugLog(`This block ${stringifyCoordinates(new Vec3(blockVec3.x, blockVec3.y - 1, blockVec3.z))} is FARMLAND.`)
      if (!await this.procFarmlandBlock(blockVec3, underBlockVec3)) {
        debugLog(`Can't process this block.`);
        return false;
      }
    } 

    if (underBlock.name == DIRT_BLOCKS[1] || underBlock.name == DIRT_BLOCKS[2]) {  // dirt || grass_block
      debugLog(`This block ${stringifyCoordinates(new Vec3(blockVec3.x, blockVec3.y - 1, blockVec3.z))} isn't farmland.`);
      if (!await this.useItem(underBlock, 'hoe')) {
        debugLog(`Can't process this block.`);
        return false;
      }
      if (!await this.procFarmlandBlock(blockVec3, underBlockVec3)) {
        debugLog(`Can't process this block.`);
        return false;
      }
    }

    debugLog(`This block is successfully farmed.`);
    return true;
  }

  async procFarmlandBlock(blockVec3: Vec3, underBlockVec3: Vec3): Promise<boolean> {
    const block = this.B.bot.blockAt(blockVec3);
    if (block == null) {            // `block` cannot be a null, but VSC can't understand it :(
      this.B.warn(`[${MODULE_NAME}] !!! UNEXPECTED ERROR, REPORT DEVELOPERS. error code: 2`);
      return false;
    }
    const underBlock = this.B.bot.blockAt(underBlockVec3);
    if (underBlock == null) {       // the same
      this.B.warn(`[${MODULE_NAME}] !!! UNEXPECTED ERROR, REPORT DEVELOPERS. error code: 3`);
      return false;
    }

    if (block.type == 0) {   // 0 - air id
      await this.useItem(underBlock, 'seed');
    } 
    else if (CROP_BLOCKS.includes(block.name)) {
      if ((block.name == CROP_BLOCKS[1] && block.metadata == 3) || block.metadata == 7) {  // 7 is the maximum growth progress level; 3 is the exception for beetroot
        await this.B.bot.dig(block);
        await this.useItem(underBlock, 'seed');
        await new Promise(resolve => setTimeout(resolve, Durat({ sec: 0.2 })));
      }
    } 
    else { 
      debugLog(`${block.name}`)
      debugLog(`[${MODULE_NAME}] !!! UNEXPECTED ERROR, REPORT DEVELOPERS. error code: 4`);
      return false;
    }

    return true;
  }

  async useItem(underBlock: Block, seedOrHoe: 'seed' | 'hoe'): Promise<boolean> {
    const inventoryItems = this.B.bot.inventory.items();
    let itemsArray: string[];
    if (seedOrHoe == 'seed') itemsArray = SEEDS;
    if (seedOrHoe == 'hoe') itemsArray = HOES;
    const instrument = inventoryItems.find(item => itemsArray.includes(item.name));
    if (!instrument) {
      this.B.warn(`[${MODULE_NAME}] I hasn't needed items`)
      return false;
    }
    try {
      await this.B.bot.unequip("hand");
      await new Promise(resolve => setTimeout(resolve, Durat({ sec: 0.2 })));
      await this.B.bot.equip(instrument, "hand");
      await new Promise(resolve => setTimeout(resolve, Durat({ sec: 0.2 }))); 

      await this.B.bot.activateBlock(underBlock);
      await new Promise(resolve => setTimeout(resolve, Durat({ sec: 0.1 })));

      await this.B.bot.unequip("hand");
      return true;

    } catch (error) {
      this.B.warn(`[${MODULE_NAME}] UNEXPECTED EROOR, REPORT DEVELOPERS. error code: 5`);
      return false;
    }
  }

  async isBlockWatered(block: Block): Promise<boolean> {
    const blockVec3: Vec3 = block.position;
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        const checkBlock = this.B.bot.blockAt(new Vec3(blockVec3.x + x, blockVec3.y, blockVec3.z + z));
        if (checkBlock && (WATER_BLOCKS.includes(checkBlock.name) || checkBlock.isWaterlogged)) return true;
      }
    }
    return false;
  }

  jobs: JobUnit[] = [];

  async createJobsQueue(jobs: JobUnit[]): Promise<boolean> {
    let isForward = true;
    for (const row of this._fieldMatrix) {
      const start = isForward ? 0 : row.length - 1;
      const end = isForward ? row.length : -1;
      const step = isForward ? 1 : -1;

      for (let i = start; i !== end; i += step) {
        await jobs.push(new Farm_Block(this, row[i]));
      }
      isForward = !isForward;
    }
    return true;
  }

  // #endregion

  // #region FINALIZE

  async putItemsAway(): Promise<boolean> {
    if (!await this.interactWithContainer('put')) return false;
    return true;
  }

  // #endregion
}

class Job_Farming implements AggregateJob {
  jobIdentifier: symbol | null;
  jobDisplayName: string;
  createdAt: number;
  priority: JobPriority;
  cursor: number;
  jobs: JobUnit[];
  promisePause?: Promise<void> | undefined;
  reExecuteAfterFail?: boolean | undefined;
  prepare? (): Promise<boolean>;
  execute: () => Promise<boolean>;
  finalize? (): Promise<boolean>;

  constructor(M: Mod_Farm) {
    this.jobIdentifier = kJobFarming;
    this.jobDisplayName = "Farming";
    this.createdAt = Date.now();
    this.priority = JobPriority.Plain;
    this.cursor = 0;
    this.jobs = M.jobs;
    this.promisePause = undefined;
    this.reExecuteAfterFail = false;
    this.prepare = async () => await M.getReadyToPlant();
    this.execute = async () => await M.createJobsQueue(M.jobs);
    this.finalize = async () => await M.putItemsAway();
  }
}

class Farm_Block implements JobUnit {
  jobIdentifier: symbol | null;
  jobDisplayName: string;
  createdAt: number;
  priority: JobPriority;
  prepare?(): Promise<boolean>;
  execute: () => Promise<boolean>;
  failure?(): Promise<void>;
  
  constructor(M: Mod_Farm, Block: MatrixCell) {
    this.jobIdentifier = null;
    this.jobDisplayName = "Working on the field";
    this.createdAt = Date.now();
    this.priority = JobPriority.Plain;
    this.prepare = async () => await M.getReadyToPlant();
    this.execute = async () => await M.processBlock(Block);
  }
}