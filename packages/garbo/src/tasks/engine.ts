import { Engine, EngineOptions, getTasks, Quest, StrictCombatTask } from "grimoire-kolmafia";
import { eventLog, safeInterrupt, sober } from "../lib";
import { wanderer } from "../garboWanderer";
import { $skill, Delayed, get, SourceTerminal, undelay } from "libram";
import { myTotalTurnsSpent, print } from "kolmafia";
import postCombatActions from "../post";
import { GarboStrategy } from "../combat";

export type GarboTask = StrictCombatTask<never, GarboStrategy> & {
  sobriety?: Delayed<"drunk" | "sober">;
  spendsTurn: Delayed<boolean>;
  duplicate?: Delayed<boolean>;
};

function logEmbezzler(encounterType: string) {
  const isDigitize = encounterType === "Digitize Wanderer";
  isDigitize ? eventLog.digitizedEmbezzlersFought++ : eventLog.initialEmbezzlersFought++;
  eventLog.embezzlerSources.push(isDigitize ? "Digitize" : "Unknown Source");
}

/** A base engine for Garbo!
 * Runs extra logic before executing all tasks.
 */
export class BaseGarboEngine extends Engine<never, GarboTask> {
  available(task: GarboTask): boolean {
    const taskSober = undelay(task.sobriety);
    if (taskSober) {
      return (
        ((taskSober === "drunk" && !sober()) || (taskSober === "sober" && sober())) &&
        super.available(task)
      );
    }
    return super.available(task);
  }

  execute(task: GarboTask): void {
    safeInterrupt();
    const spentTurns = myTotalTurnsSpent();
    const duplicate = undelay(task.duplicate);
    const before = SourceTerminal.getSkills();
    if (duplicate && SourceTerminal.have() && SourceTerminal.duplicateUsesRemaining() > 0) {
      SourceTerminal.educate([$skill`Extract`, $skill`Duplicate`]);
    }
    super.execute(task);
    postCombatActions();
    if (myTotalTurnsSpent() !== spentTurns) {
      if (!undelay(task.spendsTurn)) {
        print(`Task ${task.name} spent a turn but was marked as not spending turns`);
      }
    }
    const foughtAnEmbezzler = get("lastEncounter") === "Knob Goblin Embezzler";
    if (foughtAnEmbezzler) logEmbezzler(task.name);
    wanderer().clear();
    if (duplicate && SourceTerminal.have()) {
      for (const skill of before) {
        SourceTerminal.educate(skill);
      }
    }
  }
}

/**
 * A safe engine for Garbo!
 * Treats soft limits as tasks that should be skipped, with a default max of one attempt for any task.
 */
export class SafeGarboEngine extends BaseGarboEngine {
  constructor(tasks: GarboTask[]) {
    const options = new EngineOptions();
    options.default_task_options = { limit: { skip: 1 } };
    super(tasks, options);
  }
}

export function runSafeGarboTasks(tasks: GarboTask[]): void {
  const engine = new SafeGarboEngine(tasks);

  try {
    engine.run();
  } finally {
    engine.destruct();
  }
}

export function runSafeGarboQuests(quests: Quest<GarboTask>[]): void {
  runSafeGarboTasks(getTasks(quests));
}

export function runGarboTasks(tasks: GarboTask[]): void {
  const engine = new BaseGarboEngine(tasks);

  try {
    engine.run();
  } finally {
    engine.destruct();
  }
}

export function runGarboQuests(quests: Quest<GarboTask>[]): void {
  runGarboTasks(getTasks(quests));
}
