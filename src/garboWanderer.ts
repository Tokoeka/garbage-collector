import { Effect, getMonsters, Location } from "kolmafia";
import { globalOptions } from "./config";
import { freeFightFamiliarData } from "./familiar/freeFightFamiliar";
import { estimatedGarboTurns } from "./turns";
import { WandererManager } from "./libgarbo";
import { $item, $location, $monster, $monsters, get, have } from "libram";
import { garboValue } from "./garboValue";
import { Potion } from "./potions";
import { embezzlerCount } from "./embezzler/fights";
import { digitizedMonstersRemainingForTurns } from "./lib";

let _wanderer: WandererManager | undefined;
export function wanderer(): WandererManager {
  if (!_wanderer) {
    _wanderer = new WandererManager({
      ascend: globalOptions.ascend,
      estimatedTurns: estimatedGarboTurns,
      itemValue: garboValue,
      effectValue: (effect: Effect, duration: number) =>
        new Potion($item.none, { effect, duration }).gross(embezzlerCount()),
      prioritizeCappingGuzzlr: get("garbo_prioritizeCappingGuzzlr", false),
      freeFightExtraValue: (location: Location) =>
        freeFightFamiliarData({ location }).expectedValue,
      digitzesRemaining: digitizedMonstersRemainingForTurns,
      plentifulMonsters: [
        $monster`Knob Goblin Embezzler`,
        ...(globalOptions.nobarf ? [] : getMonsters($location`Barf Mountain`)),
        ...(have($item`Kramco Sausage-o-Matic™`) ? $monsters`sausage goblin` : []),
      ],
    });
  }
  return _wanderer;
}
