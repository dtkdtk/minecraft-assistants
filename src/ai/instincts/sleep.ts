import type Brain from "../brain.js";

const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const CHECK_INTERVAL = Durat().sec(10).done;
const NIGHT_TIME = 12517

export default class Mod_sleep {
  private timer: NodeJS.Timeout | undefined
  
  constructor(private readonly B: Brain) {
    if (B.bot.entity) this.whenBotSpawn();
    else B.bot.once("spawn", this.whenBotSpawn.bind(this));
  }
  
  whenBotSpawn() {
    this.timer = setInterval(() => this.update(), CHECK_INTERVAL);
  }
  
  update() {
    if (!this.checkTime()) return;
    this.B.addJob({
      jobDisplayName: "Going to sleep (баю-баюшки)",
      createdAt: Date.now(),
      priority: JobPriority.Foreground,
      validate: () => this.checkTime(),
      execute: async () => await this.whenNight(),
    })
  }
  
  checkTime(): boolean {
    return this.B.bot.time > NIGHT_TIME
  }
  
  whenNight() {
    const [goal, movements] = this.getLocation();
    this.B.pathfinder.setMovements(movements);
    this.B.pathfinder.setGoal(goal);
    bot.useOn(goal);
  }
  
  getLocation() {
    const mcData = require('minecraft-data')(B.version);
    const movements = new Movements(B, mcData);
    const goal = new goals.GoalNear(BD.locations.Sleep_Mod.bed, 1);
    return [goal, movements]
  }
}