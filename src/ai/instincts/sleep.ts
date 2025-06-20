import _mfPathfinder from "mineflayer-pathfinder";
import { JobPriority, LocationPoint, LocationType } from "../../types.js";
import type Brain from "../brain.js";
import assert from "assert";
import { Vec3 } from "vec3";
const { Movements, goals } = _mfPathfinder;

const MODULE_NAME = "Mod_Sleep";

const NIGHT_CHECK_INTERVAL = +Durat.sec(10);
const DAY_CHECK_INTERVAL = +Durat.sec(1);
const NIGHT_TIME = 12542; /* Magic constant (minecraft ticks) */
const kLocationBed = "bed";
const kJobSleep = Symbol("job:sleep");

/* TODO: Аппроксимация времени на путь; движение заранее */

export default class Mod_Sleep {
  private timer: NodeJS.Timeout | undefined
  
  constructor(private readonly B: Brain) {
    if (B.bot.entity) this.whenBotSpawn();
    else B.bot.once("spawn", this.whenBotSpawn.bind(this));
  }
  
  async whenBotSpawn() {
    await this.loadDatabaseDefaults();
    this.timer = setInterval(() => this.update(), NIGHT_CHECK_INTERVAL);
  }
  
  update() {
    if (!this.checkTime()) return;
    this.B.addJob({
      jobIdentifier: kJobSleep,
      jobDisplayName: "Going to sleep",
      createdAt: Date.now(),
      priority: JobPriority.Foreground,
      validate: () => this.checkTime(),
      execute: () => this.whenNight(),
    })
  }
  
  checkTime(): boolean {
    return this.B.bot.time.timeOfDay > NIGHT_TIME;
  }
  
  /** Возвращает успех/неудачу */
  async whenNight(): Promise<boolean> {
    const bedPoint = await this.getBedLocation();
    if (bedPoint === null) return false;
    const movements = new Movements(this.B.bot); /* TODO: 'movements.canDig' & other options configuration */
    movements.canDig = false;
    movements.canOpenDoors = true;
    const goal = new goals.GoalNear(bedPoint.x, bedPoint.y, bedPoint.z, 1);
    this.B.bot.pathfinder.setMovements(movements);
    debugLog(`Going to bed at ${stringifyCoordinates(bedPoint)}`);
    await this.B.bot.pathfinder.goto(goal);

    /* TODO: Relocate (заново найти) кровать если блок отсутствует.
      Поиск будет по команде / по настройке. */
    const block = this.B.bot.blockAt(new Vec3(bedPoint.x, bedPoint.y, bedPoint.z));
    if (block === null) {
      this.B.warn(`[${MODULE_NAME}] Cannot find bed block at ${stringifyCoordinates(bedPoint)}.`);
      return false;
    }
    if (!this.B.bot.isABed(block)) {
      this.B.warn(`[${MODULE_NAME}] Block at ${stringifyCoordinates(bedPoint)} is not a bed.`);
      return false;
    }
    await this.B.bot.sleep(block);
    await Promise.all([
      new Promise<void>((pReturn) => {
        setInterval(() => this.checkTime() ? undefined : pReturn(), DAY_CHECK_INTERVAL);
      })
    ]);
    return true;
  }
  
  async getBedLocation(): Promise<LocationPoint | null> {
    const locationsStore = await DB.locations.findOneAsync({ _id: MODULE_NAME });
    assert(locationsStore !== null);
    const bedPoint = locationsStore.locations.find(loc => loc.key == kLocationBed);
    if (bedPoint === undefined) {
      this.B.warn(`[${MODULE_NAME}] Bed location not found.`);
      return null;
    }
    if (bedPoint.type != LocationType.Point) {
      this.B.warn(`[${MODULE_NAME}] Bed location must be a single point, not an area/region.`);
      return null;
    }
    return bedPoint;
  }

  async loadDatabaseDefaults() {
    const found = await DB.locations.findOneAsync({ _id: MODULE_NAME });
    if (!found) await DB.locations.insertAsync({ _id: MODULE_NAME, locations: [{ key: "bed", type: LocationType.Point,
      x: -185, y: 63, z: 412 }] });
  }
}
