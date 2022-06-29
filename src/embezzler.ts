import {
  booleanModifier,
  chatPrivate,
  cliExecute,
  fullnessLimit,
  getClanLounge,
  getCounters,
  haveEquipped,
  inebrietyLimit,
  itemAmount,
  Location,
  mallPrice,
  myAdventures,
  myFamiliar,
  myFullness,
  myHash,
  myInebriety,
  myTurncount,
  print,
  retrieveItem,
  runChoice,
  runCombat,
  toInt,
  toMonster,
  toUrl,
  use,
  userConfirm,
  visitUrl,
  wait,
} from "kolmafia";
import {
  $effect,
  $familiar,
  $item,
  $items,
  $location,
  $locations,
  $monster,
  $skill,
  adventureMacro,
  adventureMacroAuto,
  ChateauMantegna,
  CombatLoversLocket,
  Counter,
  CrystalBall,
  get,
  have,
  property,
  questStep,
  Requirement,
  set,
  sum,
} from "libram";
import { acquire } from "./acquire";
import { Macro, withMacro } from "./combat";
import { usingThumbRing } from "./dropsgear";
import { crateStrategy, doingExtrovermectin, equipOrbIfDesired } from "./extrovermectin";
import { bestWitchessPiece } from "./fights";
import {
  averageEmbezzlerNet,
  globalOptions,
  HIGHLIGHT,
  ltbRun,
  setChoice,
  userConfirmDialog,
  WISH_VALUE,
} from "./lib";
import { waterBreathingEquipment } from "./outfit";
import { determineDraggableZoneAndEnsureAccess, DraggableFight } from "./wanderer";

const witchessPiece = bestWitchessPiece();

/**
 * Configure the behavior of the fights in use in different parts of the fight engine
 * @interface witchessPieceFightConfigOptions
 * @member {Requirement[]?} requirements maximizer requirements to use for this fight (defaults to empty)
 * @member {draggableFight?} draggable if this fight can be pulled into another zone and what kind of draggable it is (defaults to undefined)
 * @member {boolean?} canInitializeWandererCounters if this fight can be used to initialize wanderers (defaults to false)
 * @member {boolean?} gregariousReplace if this is a "monster replacement" fight - pulls another monster from the CSV (defautls to false)
 * @member {boolean?} wrongEncounterName if mafia does not update the lastEncounter properly when doing this fight (defaults to value of gregariousReplace)
 */
interface witchessPieceFightConfigOptions {
  requirements?: Requirement[];
  draggable?: DraggableFight;
  canInitializeWandererCounters?: boolean;
  wrongEncounterName?: boolean;
  gregariousReplace?: boolean;
}

class witchessPieceFightRunOptions {
  #macro: Macro;
  #location?: Location;
  #useAuto: boolean;

  constructor(macro: Macro, location?: Location, useAuto = true) {
    this.#macro = macro;
    this.#location = location;
    this.#useAuto = useAuto;
  }

  get macro(): Macro {
    return this.#macro;
  }

  get location(): Location {
    if (!this.#location) {
      throw "witchessPiece fight tried to access a location, but none was set";
    } else {
      return this.#location;
    }
  }

  get useAuto(): boolean {
    return this.#useAuto;
  }
}

export class witchessPieceFight {
  name: string;
  available: () => boolean;
  potential: () => number;
  execute: (options: witchessPieceFightRunOptions) => void;
  requirements: Requirement[];
  draggable?: DraggableFight;
  canInitializeWandererCounters: boolean;
  wrongEncounterName: boolean;
  gregariousReplace: boolean;

  /**
   * This is the class that creates all the different ways to fight witchessPieces
   * @classdesc witchessPiece Fight enc
   * @prop {string} name The name of the source of this fight, primarily used to identify special cases.
   * @prop {() => boolean} available Returns whether or not we can do this fight right now (this may change later in the day).
   * @prop {() => number} potential Returns the number of witchessPieces we expect to be able to fight from this source given the current state of hte character
   *  This is used when computing turns for buffs, so it should be as accurate as possible to the number of KGE we will fight
   * @prop {(options: witchessPieceFightRunOptions) => void} execute This runs the combat, optionally using the provided location and macro. Location is used only by draggable fights.
   *  This is the meat of each fight. How do you initialize the fight? Are there any special considerations?
   * @prop {witchessPieceFightConfigOptions} options configuration options for this fight. see witchessPieceFightConfigOptions for full details of all available options
   * @example
   * // suppose that we wanted to add a fight that will use print screens repeatedly, as long as we have them in our inventory
   * new witchessPieceFight(
   *  "Print Screen Monster",
   *  () => have($item`screencapped monster`) && get('screencappedMonster') === witchessPiece, // in order to start this fight, a KGE must already be screen capped
   *  () => availableAmount($item`screencapped monster`) + availableAmount($item`print screen button`) // the total of potential of this fight is the number of already copied KGE + the number of potentially copiable KGE
   *  () => (options: witchessPieceFightRunOptions) => {
   *    const macro = Macro
   *      .externalIf(have($item`print screen button`), Macro.tryItem($item`print screen button`))
   *      .step(options.macro); // you should always include the macro passed in via options, as it may have special considerations for this fight
   *    withMacro(macro, () => useItem($item`screen capped monster`));
   *  },
   *  {
   *    canInitializeWnadererCounts: false; // this copy cannot be used to start wanderer counters, since the combats are not adv.php
   *  }
   * )
   */
  constructor(
    name: string,
    available: () => boolean,
    potential: () => number,
    execute: (options: witchessPieceFightRunOptions) => void,
    options: witchessPieceFightConfigOptions = {}
  ) {
    this.name = name;
    this.available = available;
    this.potential = potential;
    this.execute = execute;
    this.requirements = options.requirements ?? [];
    this.draggable = options.draggable;
    this.canInitializeWandererCounters = options.canInitializeWandererCounters ?? false;
    this.gregariousReplace = options.gregariousReplace ?? false;
    this.wrongEncounterName = options.wrongEncounterName ?? this.gregariousReplace;
  }

  run(options: { macro?: Macro; location?: Location; useAuto?: boolean} = {}): void {
		if (!this.available() || !myAdventures()) return;
    const fightMacro = options.macro ?? witchessPieceMacro();
    if (this.draggable) {
      this.execute(new witchessPieceFightRunOptions(fightMacro, this.location(options.location), options.useAuto));
    } else {
      this.execute(new witchessPieceFightRunOptions(fightMacro, undefined, options.useAuto));
    }
  }

  location(location?: Location): Location {
    const suggestion = location;

    if (
      (this.draggable && !suggestion) ||
      (this.draggable === "backup" && suggestion && suggestion.combatPercent < 100)
    ) {
      return determineDraggableZoneAndEnsureAccess(this.draggable);
    }
    return suggestion ?? $location`Noob Cave`;
  }
}

function checkUnderwater() {
  // first check to see if underwater even makes sense
  if (
    questStep("questS01OldGuy") >= 0 &&
    !(get("_envyfishEggUsed") || have($item`envyfish egg`)) &&
    (get("_garbo_weightChain", false) || !have($familiar`Pocket Professor`)) &&
    (booleanModifier("Adventure Underwater") ||
      waterBreathingEquipment.some((item) => have(item))) &&
    (have($effect`Fishy`) || (have($item`fishy pipe`) && !get("_fishyPipeUsed")))
  ) {
    if (!have($effect`Fishy`) && !get("_fishyPipeUsed")) use($item`fishy pipe`);

    return have($effect`Fishy`);
  }

  return false;
}

function checkFax(): boolean {
  if (!have($item`photocopied monster`)) cliExecute("fax receive");
  if (property.getString("photocopyMonster") === witchessPiece.name) return true;
  cliExecute("fax send");
  return false;
}

function faxwitchessPiece(): void {
  if (!get("_photocopyUsed")) {
    if (checkFax()) return;
    chatPrivate("cheesefax", witchessPiece.name);
    for (let i = 0; i < 3; i++) {
      wait(10);
      if (checkFax()) return;
    }
    throw new Error(`Failed to acquire photocopied ${witchessPiece.name}.`);
  }
}

export const witchessPieceMacro = (): Macro =>
  Macro.if_(
    witchessPiece,
    Macro.if_($location`The Briny Deeps`, Macro.tryCopier($item`pulled green taffy`))
      .externalIf(
        myFamiliar() === $familiar`Reanimated Reanimator`,
        Macro.trySkill($skill`Wink at`)
      )
      .externalIf(
        myFamiliar() === $familiar`Obtuse Angel`,
        Macro.trySkill($skill`Fire a badly romantic arrow`)
      )
      .externalIf(
        get("beGregariousCharges") > 0 &&
          (get("beGregariousMonster") !== witchessPiece || get("beGregariousFightsLeft") === 0),
        Macro.trySkill($skill`Be Gregarious`)
      )
      .tryCopier($item`Spooky Putty sheet`)
      .tryCopier($item`Rain-Doh black box`)
      .tryCopier($item`4-d camera`)
      .tryCopier($item`unfinished ice sculpture`)
      .externalIf(get("_enamorangs") === 0, Macro.tryCopier($item`LOV Enamorang`))
      .meatKill()
  ).abort();

const wandererFailsafeMacro = () =>
  Macro.externalIf(
    haveEquipped($item`backup camera`) &&
      get("_backUpUses") < 11 &&
      get("lastCopyableMonster") === witchessPiece,
    Macro.if_(`!monsterid ${witchessPiece.id}`, Macro.skill($skill`Back-Up to your Last Enemy`))
  );

export const witchessPieceSources = [
  new witchessPieceFight(
    "Guaranteed Romantic Monster",
    () =>
      get("_romanticFightsLeft") > 0 &&
      Counter.get("Romantic Monster window begin") <= 0 &&
      Counter.get("Romantic Monster window end") <= 0,
    () => 0,
    (options: witchessPieceFightRunOptions) => {
      adventureMacro(options.location, wandererFailsafeMacro().step(options.macro));
    },
    {
      draggable: "wanderer",
    }
  ),
  new witchessPieceFight(
    "Enamorang",
    () => getCounters("Enamorang", 0, 0).trim() !== "" && get("enamorangMonster") === witchessPiece,
    () =>
      (getCounters("Enamorang", 0, 0).trim() !== "" && get("enamorangMonster") === witchessPiece) ||
      (have($item`LOV Enamorang`) && !get("_enamorangs"))
        ? 1
        : 0,
    (options: witchessPieceFightRunOptions) => {
      adventureMacro(options.location, wandererFailsafeMacro().step(witchessPieceMacro()));
    },
    {
      draggable: "wanderer",
    }
  ),
  new witchessPieceFight(
    "Orb Prediction",
    () => 
		have($item`miniature crystal ball`) &&
		!get("_garbo_doneGregging", false) &&
		CrystalBall.ponder().get($location`The Dire Warren`) === witchessPiece,
    () =>
      (have($item`miniature crystal ball`) ? 1 : 0) *
      (get("beGregariousCharges") +
        (get("beGregariousFightsLeft") > 0 ||
        CrystalBall.ponder().get($location`The Dire Warren`) === witchessPiece
          ? 1
          : 0)),
    (options: witchessPieceFightRunOptions) => {
      visitUrl("inventory.php?ponder=1");
      if (CrystalBall.ponder().get($location`The Dire Warren`) !== witchessPiece) {
        return;
      }
      const adventureFunction = options.useAuto ? adventureMacroAuto : adventureMacro;
      adventureFunction($location`The Dire Warren`, options.macro, options.macro);
      toasterGaze();
      if (!doingExtrovermectin()) set("_garbo_doneGregging", true);
    },
    {
      requirements: [new Requirement([], { forceEquip: $items`miniature crystal ball` })],
      canInitializeWandererCounters: true,
    }
  ),
  new witchessPieceFight(
    "Time-Spinner",
    () =>
      have($item`Time-Spinner`) &&
      $locations`Noob Cave, The Dire Warren`.some((location) =>
        location.combatQueue.includes(witchessPiece.name)
      ) &&
      get("_timeSpinnerMinutesUsed") <= 7,
    () =>
      have($item`Time-Spinner`) &&
      $locations`Noob Cave, The Dire Warren`.some(
        (location) =>
          location.combatQueue.includes(witchessPiece.name) || get("beGregariousCharges") > 0
      )
        ? Math.floor((10 - get("_timeSpinnerMinutesUsed")) / 3)
        : 0,
    (options: witchessPieceFightRunOptions) => {
      withMacro(options.macro, () => {
        visitUrl(`inv_use.php?whichitem=${toInt($item`Time-Spinner`)}`);
        runChoice(1);
        visitUrl(`choice.php?whichchoice=1196&monid=${witchessPiece.id}&option=1`);
        runCombat();
      });
    }
  ),
  new witchessPieceFight(
    "Macrometeorite",
    () =>
      get("beGregariousMonster") === witchessPiece &&
      get("beGregariousFightsLeft") > 0 &&
      have($skill`Meteor Lore`) &&
      get("_macrometeoriteUses") < 10 &&
      proceedWithOrb(),
    () =>
      ((get("beGregariousMonster") === witchessPiece && get("beGregariousFightsLeft") > 0) ||
        get("beGregariousCharges") > 0) &&
      have($skill`Meteor Lore`)
        ? 10 - get("_macrometeoriteUses")
        : 0,
    (options: witchessPieceFightRunOptions) => {
      equipOrbIfDesired();

      const crateIsSabered = get("_saberForceMonster") === $monster`crate`;
      const notEnoughCratesSabered = get("_saberForceMonsterCount") < 2;
      const weWantToSaberCrates = !crateIsSabered || notEnoughCratesSabered;
      setChoice(1387, 2);

      const macro = Macro.if_(
        $monster`crate`,
        Macro.externalIf(
          crateStrategy() !== "Saber" && !have($effect`On the Trail`) && get("_olfactionsUsed") < 2,
          Macro.tryHaveSkill($skill`Transcendent Olfaction`)
        )
          .externalIf(
            haveEquipped($item`Fourth of May Cosplay Saber`) &&
              weWantToSaberCrates &&
              get("_saberForceUses") < 5,
            Macro.trySkill($skill`Use the Force`)
          )
          .skill($skill`Macrometeorite`)
      ).step(options.macro);
      const adventureFunction = options.useAuto ? adventureMacroAuto : adventureMacro;
      adventureFunction($location`Noob Cave`, macro, macro);
      if (CrystalBall.ponder().get($location`Noob Cave`) === witchessPiece) toasterGaze();
    },
    {
      gregariousReplace: true,
    }
  ),
  new witchessPieceFight(
    "Powerful Glove",
    () =>
      get("beGregariousMonster") === witchessPiece &&
      get("beGregariousFightsLeft") > 0 &&
      have($item`Powerful Glove`) &&
      get("_powerfulGloveBatteryPowerUsed") <= 90 &&
      proceedWithOrb(),
    () =>
      ((get("beGregariousMonster") === witchessPiece && get("beGregariousFightsLeft") > 0) ||
        get("beGregariousCharges") > 0) &&
      have($item`Powerful Glove`)
        ? Math.min((100 - get("_powerfulGloveBatteryPowerUsed")) / 10)
        : 0,
    (options: witchessPieceFightRunOptions) => {
      equipOrbIfDesired();

      const crateIsSabered = get("_saberForceMonster") === $monster`crate`;
      const notEnoughCratesSabered = get("_saberForceMonsterCount") < 2;
      const weWantToSaberCrates = !crateIsSabered || notEnoughCratesSabered;
      setChoice(1387, 2);

      const macro = Macro.if_(
        $monster`crate`,
        Macro.externalIf(
          crateStrategy() !== "Saber" && !have($effect`On the Trail`) && get("_olfactionsUsed") < 2,
          Macro.tryHaveSkill($skill`Transcendent Olfaction`)
        )
          .externalIf(
            haveEquipped($item`Fourth of May Cosplay Saber`) &&
              weWantToSaberCrates &&
              get("_saberForceUses") < 5,
            Macro.trySkill($skill`Use the Force`)
          )
          .skill($skill`CHEAT CODE: Replace Enemy`)
      ).step(options.macro);
      const adventureFunction = options.useAuto ? adventureMacroAuto : adventureMacro;
      adventureFunction($location`Noob Cave`, macro, macro);
      if (CrystalBall.ponder().get($location`Noob Cave`) === witchessPiece) toasterGaze();
    },
    {
      requirements: [new Requirement([], { forceEquip: $items`Powerful Glove` })],
      gregariousReplace: true,
    }
  ),
  new witchessPieceFight(
    "Be Gregarious",
    () => get("beGregariousMonster") === witchessPiece && 
		get("beGregariousFightsLeft") > (have($item`miniature crystal ball`) ? 1 : 0),
    () =>
      get("beGregariousMonster") === witchessPiece
        ? get("beGregariousCharges") * 3 + get("beGregariousFightsLeft")
        : 0,
    (options: witchessPieceFightRunOptions) => {
      const run = ltbRun();
      run.constraints.preparation?.();
      const adventureFunction = options.useAuto ? adventureMacroAuto : adventureMacro;
      adventureFunction(
        $location`The Dire Warren`,
        Macro.if_($monster`fluffy bunny`, run.macro).step(options.macro),
        Macro.if_($monster`fluffy bunny`, run.macro).step(options.macro)
      );
      // reset the crystal ball prediction by staring longingly at toast
      if (get("beGregariousFightsLeft") === 1 && have($item`miniature crystal ball`)) {
        const warrenPrediction = CrystalBall.ponder().get($location`The Dire Warren`);
        if (warrenPrediction !== witchessPiece) toasterGaze();
      }
    },
    {
      canInitializeWandererCounters: true,
    }
  ),
  new witchessPieceFight(
    "Be Gregarious (Set Up Crystal Ball)",
    () =>
      get("beGregariousMonster") === witchessPiece &&
      get("beGregariousFightsLeft") === 1 &&
      have($item`miniature crystal ball`) &&
      !CrystalBall.ponder().get($location`The Dire Warren`),
    () =>
      (get("beGregariousMonster") === witchessPiece && get("beGregariousFightsLeft") > 0) ||
      get("beGregariousCharges") > 0
        ? 1
        : 0,
    (options: witchessPieceFightRunOptions) => {
      adventureMacro($location`The Dire Warren`, Macro.if_(witchessPiece, options.macro).abort());
    },
    {
      requirements: [
        new Requirement([], {
          forceEquip: $items`miniature crystal ball`.filter((item) => have(item)),
        }),
      ],
      canInitializeWandererCounters: true,
    }
  ),
  new witchessPieceFight(
    "Backup",
    () =>
      get("lastCopyableMonster") === witchessPiece &&
      have($item`backup camera`) &&
      get("_backUpUses") < 11,
    () => (have($item`backup camera`) ? 11 - get("_backUpUses") : 0),
    (options: witchessPieceFightRunOptions) => {
      const adventureFunction = options.useAuto ? adventureMacroAuto : adventureMacro;
      adventureFunction(
        options.location,
        Macro.if_(
          `!monsterid ${witchessPiece.id}`,
          Macro.skill($skill`Back-Up to your Last Enemy`)
        ).step(options.macro)
      );
    },
    {
      requirements: [
        new Requirement([], {
          forceEquip: $items`backup camera`,
          bonusEquip: new Map([[$item`backup camera`, 5000]]),
        }),
      ],
      draggable: "backup",
      wrongEncounterName: true,
      canInitializeWandererCounters: true,
    }
  ),
  new witchessPieceFight(
    "Spooky Putty & Rain-Doh",
    () =>
      (have($item`Spooky Putty monster`) && get("spookyPuttyMonster") === witchessPiece) ||
      (have($item`Rain-Doh box full of monster`) && get("rainDohMonster") === witchessPiece),
    () => {
      if (
        (have($item`Spooky Putty sheet`) ||
          (have($item`Spooky Putty monster`) && get("spookyPuttyMonster") === witchessPiece)) &&
        (have($item`Rain-Doh black box`) ||
          (have($item`Rain-Doh box full of monster`) && get("rainDohMonster") === witchessPiece))
      ) {
        return (
          6 -
          get("spookyPuttyCopiesMade") -
          get("_raindohCopiesMade") +
          (get("spookyPuttyMonster") === witchessPiece
            ? itemAmount($item`Spooky Putty monster`)
            : 0) +
          (get("rainDohMonster") === witchessPiece
            ? itemAmount($item`Rain-Doh box full of monster`)
            : 0)
        );
      } else if (
        have($item`Spooky Putty sheet`) ||
        (have($item`Spooky Putty monster`) && get("spookyPuttyMonster") === witchessPiece)
      ) {
        return 5 - get("spookyPuttyCopiesMade") + itemAmount($item`Spooky Putty monster`);
      } else if (
        have($item`Rain-Doh black box`) ||
        (have($item`Rain-Doh box full of monster`) && get("rainDohMonster") === witchessPiece)
      ) {
        return 5 - get("_raindohCopiesMade") + itemAmount($item`Rain-Doh box full of monster`);
      }
      return 0;
    },
    (options: witchessPieceFightRunOptions) => {
      const macro = options.macro;
      withMacro(macro, () => {
        if (have($item`Spooky Putty monster`)) return use($item`Spooky Putty monster`);
        return use($item`Rain-Doh box full of monster`);
      });
    }
  ),
  new witchessPieceFight(
    "4-d Camera",
    () =>
      have($item`shaking 4-d camera`) &&
      get("cameraMonster") === witchessPiece &&
      !get("_cameraUsed"),
    () =>
      have($item`shaking 4-d camera`) &&
      get("cameraMonster") === witchessPiece &&
      !get("_cameraUsed")
        ? 1
        : 0,
    (options: witchessPieceFightRunOptions) => {
      withMacro(options.macro, () => use($item`shaking 4-d camera`));
    }
  ),
  new witchessPieceFight(
    "Ice Sculpture",
    () =>
      have($item`ice sculpture`) &&
      get("iceSculptureMonster") === witchessPiece &&
      !get("_iceSculptureUsed"),
    () =>
      have($item`ice sculpture`) &&
      get("iceSculptureMonster") === witchessPiece &&
      !get("_iceSculptureUsed")
        ? 1
        : 0,
    (options: witchessPieceFightRunOptions) => {
      withMacro(options.macro, () => use($item`ice sculpture`));
    }
  ),
  new witchessPieceFight(
    "Green Taffy",
    () =>
      have($item`envyfish egg`) &&
      get("envyfishMonster") === witchessPiece &&
      !get("_envyfishEggUsed"),
    () =>
      have($item`envyfish egg`) &&
      get("envyfishMonster") === witchessPiece &&
      !get("_envyfishEggUsed")
        ? 1
        : 0,
    (options: witchessPieceFightRunOptions) => {
      withMacro(options.macro, () => use($item`envyfish egg`));
    }
  ),
  new witchessPieceFight(
    "Screencapped Monster",
    () =>
      have($item`screencapped monster`) &&
      property.getString("screencappedMonster") === "Knob Goblin witchessPiece",
    () =>
      property.getString("screencappedMonster") === "Knob Goblin witchessPiece"
        ? itemAmount($item`screencapped monster`)
        : 0,
    (options: witchessPieceFightRunOptions) => {
      withMacro(options.macro, () => use($item`screencapped monster`));
    }
  ),
  new witchessPieceFight(
    "Sticky Clay Homunculus",
    () =>
      have($item`sticky clay homunculus`) &&
      property.getString("crudeMonster") === "Knob Goblin witchessPiece",
    () =>
      property.getString("crudeMonster") === "Knob Goblin witchessPiece"
        ? itemAmount($item`sticky clay homunculus`)
        : 0,
    (options: witchessPieceFightRunOptions) =>
      withMacro(options.macro, () => use($item`sticky clay homunculus`))
  ),
  new witchessPieceFight(
    "Chateau Painting",
    () =>
      ChateauMantegna.have() &&
      !ChateauMantegna.paintingFought() &&
      ChateauMantegna.paintingMonster() === witchessPiece,
    () =>
      ChateauMantegna.have() &&
      !ChateauMantegna.paintingFought() &&
      ChateauMantegna.paintingMonster() === witchessPiece
        ? 1
        : 0,
    (options: witchessPieceFightRunOptions) => {
      withMacro(options.macro, () => ChateauMantegna.fightPainting());
    }
  ),
  new witchessPieceFight(
    "Combat Lover's Locket",
    () => CombatLoversLocket.availableLocketMonsters().includes(witchessPiece),
    () => (CombatLoversLocket.availableLocketMonsters().includes(witchessPiece) ? 1 : 0),
    (options: witchessPieceFightRunOptions) => {
      withMacro(options.macro, () => CombatLoversLocket.reminisce(witchessPiece));
    }
  ),
  new witchessPieceFight(
    "Fax",
    () => have($item`Clan VIP Lounge key`) && !get("_photocopyUsed"),
    () => (have($item`Clan VIP Lounge key`) && !get("_photocopyUsed") ? 1 : 0),
    (options: witchessPieceFightRunOptions) => {
      faxwitchessPiece();
      withMacro(options.macro, () => use($item`photocopied monster`));
    }
  ),

  new witchessPieceFight(
    "Pocket Wish (untapped potential)",
    () => {
      const potential = Math.floor(witchessPieceCount());
      if (potential < 1) return false;
      if (get("_genieFightsUsed") >= 3) return false;
      if (globalOptions.askedAboutWish) return globalOptions.wishAnswer;
      const profit = (potential + 1) * 6000 - WISH_VALUE;
      if (profit < 0) return false;
      print(`You have the following witchessPiece-sources untapped right now:`, HIGHLIGHT);
      witchessPieceSources
        .filter((source) => source.potential() > 0)
        .map((source) => `${source.potential()} from ${source.name}`)
        .forEach((text) => print(text, HIGHLIGHT));
      globalOptions.askedAboutWish = true;
      globalOptions.wishAnswer = userConfirm(
        `Garbo has detected you have ${potential} potential ways to copy an witchessPiece, but no way to start a fight with one. Current witchessPiece net (before potions) is ${6000}, so we expect to earn ${profit} meat, after the cost of a wish. Should we wish for an witchessPiece?`
      );
      return globalOptions.wishAnswer;
    },
    () => 0,
    (options: witchessPieceFightRunOptions) => {
      withMacro(options.macro, () => {
        acquire(1, $item`pocket wish`, WISH_VALUE);
        visitUrl(`inv_use.php?pwd=${myHash()}&which=3&whichitem=9537`, false, true);
        visitUrl(
          "choice.php?pwd&whichchoice=1267&option=1&wish=to fight a Knob Goblin witchessPiece ",
          true,
          true
        );
        visitUrl("main.php", false);
        runCombat();
        globalOptions.askedAboutWish = false;
      });
    }
  ),
  new witchessPieceFight(
    "Professor MeatChain",
    () => false,
    () =>
      have($familiar`Pocket Professor`) && !get("_garbo_meatChain", false)
        ? Math.max(10 - get("_pocketProfessorLectures"), 0)
        : 0,
    () => {
      return;
    }
  ),
  new witchessPieceFight(
    "Professor WeightChain",
    () => false,
    () =>
      have($familiar`Pocket Professor`) && !get("_garbo_weightChain", false)
        ? Math.min(15 - get("_pocketProfessorLectures"), 5)
        : 0,
    () => {
      return;
    }
  ),
];

export function witchessPieceCount(): number {
  return sum(witchessPieceSources, (source: witchessPieceFight) => source.potential());
}

export function estimatedTurns(): number {
  // Assume roughly 2 fullness from pantsgiving and 8 adventures/fullness.
  const pantsgivingAdventures = have($item`Pantsgiving`)
    ? Math.max(0, 2 - get("_pantsgivingFullness")) * 8
    : 0;
  const potentialSausages =
    itemAmount($item`magical sausage`) + itemAmount($item`magical sausage casing`);
  const sausageAdventures = have($item`Kramco Sausage-o-Matic™`)
    ? Math.min(potentialSausages, 23 - get("_sausagesEaten"))
    : 0;
  const thesisAdventures = have($familiar`Pocket Professor`) && !get("_thesisDelivered") ? 11 : 0;
  const nightcapAdventures = globalOptions.ascending && myInebriety() <= inebrietyLimit() ? 60 : 0;
  const thumbRingMultiplier = usingThumbRing() ? 1 / 0.96 : 1;

  // We need to estimate adventures from our organs if we are only dieting after yachtzee chaining
  const fullnessAdventures = (fullnessLimit() - myFullness()) * 8;
  const inebrietyAdventures = (inebrietyLimit() - myInebriety()) * 7;
  const adventuresAfterChaining =
    globalOptions.yachtzeeChain && !get("_garboYachtzeeChainCompleted")
      ? Math.max(fullnessAdventures + inebrietyAdventures - 30, 0)
      : 0;

  let turns;
  if (globalOptions.stopTurncount) turns = globalOptions.stopTurncount - myTurncount();
  else if (globalOptions.noBarf) turns = witchessPieceCount();
  else {
    turns =
      (myAdventures() +
        sausageAdventures +
        pantsgivingAdventures +
        nightcapAdventures +
        thesisAdventures +
        adventuresAfterChaining) *
      thumbRingMultiplier;
  }

  return turns;
}

/**
 * Gets next available witchessPiece fight. If there is no way to generate a fight, but copies are available,
 * the user is prompted to purchase a pocket wish to start the witchessPiece chain.
 * @returns the next available witchessPiece fight
 */
export function getNextwitchessPieceFight(): witchessPieceFight | null {
  for (const fight of witchessPieceSources) {
    if (fight.available()) {
      print(`getNextwitchessPieceFight(): Next fight ${fight.name}`);
      return fight;
    }
  }
  print(`getNextwitchessPieceFight(): No next fight`);
  return null;
}

/**
 * Determines whether we want to do this particular witchessPiece fight; if we aren't using orb, should always return true. If we're using orb and it's a crate, we'll have to see!
 * @returns
 */
function proceedWithOrb(): boolean {
  const strat = crateStrategy();
  // If we can't possibly use orb, return true
  if (!have($item`miniature crystal ball`) || strat === "Saber") return true;

  // If we're sniffing and an witchessPiece is in the queue already, return true
  if (
    strat === "Sniff" &&
    $location`Noob Cave`.combatQueue
      .split(";")
      .map((monster) => toMonster(monster))
      .includes(witchessPiece)
  ) {
    return true;
  }

  // If we're using orb, we have a KGE prediction, and we can reset it, return false
  const gregFightNames = ["Macrometeorite", "Powerful Glove", "Be Gregarious", "Orb Prediction"];
  if (
    CrystalBall.ponder().get($location`Noob Cave`) === witchessPiece &&
    witchessPieceSources
      .filter((source) => !gregFightNames.includes(source.name))
      .find((source) => source.available())
  ) {
    return false;
  }

  return true;
}

function toasterGaze(): void {
  try {
    const store = visitUrl(toUrl($location`The Shore, Inc. Travel Agency`));
    if (!store.includes("Check out the gift shop")) {
      print("Unable to stare longingly at toast");
    }
    runChoice(4);
  } catch {
    // orb reseting raises a mafia error
  }
  visitUrl("main.php");
}
