import { Task } from "grimoire-kolmafia";
import { create, handlingChoice, runChoice, toInt, useSkill } from "kolmafia";
import { $item, $items, $skill, get, have } from "libram";
import { globalOptions } from "../lib";
import { garboValue } from "../session";

function bestLockPickChoice(): number {
  return (
    1 +
    toInt(
      $items`Boris's key lime, Jarlsberg's key lime, Sneaky Pete's key lime`.sort(
        (a, b) => garboValue(b) - garboValue(a)
      )[0]
    ) -
    toInt($item`Boris's key lime`)
  );
}

export const AscendingTasks: Task[] = [
  {
    name: "Lock Picking",
    ready: () => have($skill`Lock Picking`) && globalOptions.ascending,
    completed: () => get("lockPicked"),
    do: (): void => {
      useSkill($skill`Lock Picking`);
      if (handlingChoice()) runChoice(-1);
    },
    choices: { [1414]: () => bestLockPickChoice() },
  },
  {
    name: "Cook Boris's key lime",
    ready: () => globalOptions.ascending,
    completed: () =>
      !have($item`Boris's key`) || garboValue($item`Boris's key lime`) < garboValue($item`lime`),
    do: () => create($item`Boris's key lime`),
  },
  {
    name: "Cook Jarlsberg's key lime",
    ready: () => globalOptions.ascending,
    completed: () =>
      !have($item`Jarlsberg's key`) ||
      garboValue($item`Jarlsberg's key lime`) < garboValue($item`lime`),
    do: () => create($item`Jarlsberg's key lime`),
  },
  {
    name: "Cook Sneaky Pete's key lime",
    ready: () => globalOptions.ascending,
    completed: () =>
      !have($item`Sneaky Pete's key`) ||
      garboValue($item`Sneaky Pete's key lime`) < garboValue($item`lime`),
    do: () => create($item`Sneaky Pete's key lime`),
  },
  {
    name: "Cook digital key lime",
    ready: () => globalOptions.ascending,
    completed: () =>
      !have($item`digital key`) || garboValue($item`digital key lime`) < garboValue($item`lime`),
    do: () => create($item`digital key lime`),
  },
  {
    name: "Cook star key lime",
    ready: () => globalOptions.ascending,
    completed: () =>
      !have($item`Richard's star key`) ||
      garboValue($item`star key lime`) < garboValue($item`lime`),
    do: () => create($item`star key lime`),
  },
];
