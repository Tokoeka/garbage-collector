import { haveEquipped, Location, mallPrice, retrieveItem } from "kolmafia";
import { $item, $location, $skill, get } from "libram";
import { propertyManager, VPE } from "../lib";
import { checkUnderwater, EmbezzlerFightConfigOptions, RunOptions } from "./lib";
import { Macro } from "../combat";
import { wanderer } from "../garboWanderer";
import { globalOptions } from "../config";

const taffyIsWorthIt = () =>
  mallPrice($item`pulled green taffy`) < VPE() - get("valueOfAdventure") &&
  retrieveItem($item`pulled green taffy`);

const wandererFailsafeMacro = () =>
  Macro.externalIf(
    haveEquipped($item`backup camera`) &&
      get("_backUpUses") < 11 &&
      get("lastCopyableMonster") === globalOptions.target,
    Macro.if_(
      `!monsterid ${globalOptions.target.id}`,
      Macro.skill($skill`Back-Up to your Last Enemy`),
    ),
  );

export class EmbezzlerFightRunOptions implements RunOptions {
  configOptions: EmbezzlerFightConfigOptions;
  #macro?: Macro;
  #location?: Location;
  #useAuto?: boolean;
  constructor(
    configOptions: EmbezzlerFightConfigOptions,
    { macro, location, useAuto }: Partial<RunOptions> = {},
  ) {
    this.configOptions = configOptions;
    this.#macro = macro;
    this.#location = location;
    this.#useAuto = useAuto;
  }

  get location(): Location {
    if (this.configOptions.location) return this.configOptions.location;

    const suggestion =
      this.configOptions.draggable && !this.#location && checkUnderwater() && taffyIsWorthIt()
        ? $location`The Briny Deeps`
        : this.#location;

    if (
      (this.configOptions.draggable && !suggestion) ||
      (this.configOptions.draggable === "backup" && suggestion && suggestion.combatPercent < 100)
    ) {
      const wanderOptions = {
        wanderer: this.configOptions.draggable,
        allowEquipment: false,
      };
      propertyManager.setChoices(wanderer().getChoices(wanderOptions));
      return wanderer().getTarget(wanderOptions);
    }
    return suggestion ?? $location`Noob Cave`;
  }

  get macro(): Macro {
    const baseMacro = this.#macro ?? Macro.embezzler();
    return this.configOptions.draggable === "wanderer"
      ? wandererFailsafeMacro().step(baseMacro)
      : baseMacro;
  }

  get useAuto(): boolean {
    return this.#useAuto ?? true;
  }
}
