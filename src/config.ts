import { Args } from "grimoire-kolmafia";
import { get } from "libram";

export const globalOptions = Args.create(
  "garbo",
  'This script is an automated turn-burning script for the Kingdom of Loathing that spends a day\'s resources and adventures on farming\n\
You can use multiple options in conjunction, e.g. "garbo nobarf ascend"',
  {
    nobarf: Args.flag({
      setting: "",
      help: "do beginning of the day setup, embezzlers, and various daily flags, but will terminate before normal Barf Mountain turns. May close NEP for the day.",
      default: false,
    }),
    ascend: Args.flag({
      setting: "",
      help: "operate under the assumption that you're ascending after running it, rather than experiencing rollover. It will use borrowed time, it won't charge stinky cheese items, etc.",
      default: false,
    }),
    turns: Args.number({
      setting: "",
      help: 'terminate after the specified number of turns, e.g. "garbo 200" or "garbo turns=200" will terminate after 200 turns are spent. Negative inputs will cause garbo to terminate when the specified number of turns remain.',
      default: 0,
    }),
    simdiet: Args.flag({
      setting: "",
      help: "print out what it computes as an optimal diet and then exit.",
      default: false,
    }),
    nodiet: Args.flag({
      setting: "",
      help: "skip eating and drinking anything as a part of its run (including pantsgiving).",
      default: false,
    }),
    quick: Args.flag({
      setting: "",
      help: "*EXPERIMENTAL* garbo will sacrifice some optimal behaviors to run quicker. Estimated and actual profits may be less accurate in this mode.",
      default: false,
    }),
    version: Args.flag({
      setting: "",
      help: "Print the current version and exit.",
    }),
    prefs: Args.group(
      "You can manually set the properties below, but it's recommended that you use the relay interface (dropdown menu at the top left in the browser)",
      {
        valueOfAdventure: Args.number({
          setting: "valueOfAdventure",
          help: "This is a native mafia property, garbo will make purchasing decisions based on this value. Recommended to be at least 3501.",
        }),
        valueOfFreeFight: Args.number({
          setting: "garbo_valueOfFreeFight",
          help: "Set to whatever you estimate the value of a free fight/run to be for you. (Default 2000)",
          default: 2000,
        }),
        yachtzeechain: Args.flag({
          setting: "garbo_yachtzeechain",
          help: "only diets after free fights, and attempts to estimate if Yachtzee! chaining is profitable for you - if so, it consumes a specific diet which uses ~30-41 spleen;\
      if not it automatically continues with the regular diet. Requires Spring Break Beach access (it will not grab a one-day pass for you, but will make an attempt if one is used).\
      Sweet Synthesis is strongly recommended, as with access to other meat% buffs from Source Terminal, Fortune Teller, KGB and the summoning chamber. Having access to a PYEC (on hand or in the clan stash) is a plus.",
          default: false,
        }),
        stashClan: Args.string({
          setting: "garbo_stashClan",
          help: "If set, garbo will attempt to switch to this clan to take and return useful clan stash item, i.e. a Haiku Katana or Repaid Diaper. Leave blank to disable.",
          default: "",
        }),
        vipClan: Args.string({
          setting: "garbo_vipClan",
          help: "If set, garbo will attempt to switch to this clan to utilize VIP furniture if you have a key. Leave blank to disable",
          default: "",
        }),
        skipAscensionCheck: Args.boolean({
          setting: "garbo_skipAscensionCheck",
          help: "Set to true to skip verifying that your account has broken the prism, otherwise you will be warned upon starting the script.",
        }),
        fightGlitch: Args.boolean({
          setting: "garbo_fightGlitch",
          help: "Set to true to fight the glitch season reward. You need certain skills, see relay for info.",
        }),
        buyPass: Args.boolean({
          setting: "garbo_buyPass",
          help: "Set to true to buy a Dinsey day pass with FunFunds at the end of the day, if possible.",
        }),
        autoUserConfirm: Args.boolean({
          setting: "garbo_autoUserConfirm",
          help: "**WARNING: Experimental** Don't show user confirm dialogs, instead automatically select yes/no in a way that will allow garbo to continue executing. Useful for scripting/headless. Risky and potentially destructive.",
        }),
        restoreHpTarget: Args.number({
          setting: "garbo_restoreHpTarget",
          help: "If you're a very high level, what HP threshold should garbo aim to maintain?",
          default: 2000,
        }),
      }
    ),
    /*
      Hidden preferences, CLI input ignored
    */
    stopTurncount: Args.custom<number | null>({ hidden: true, default: null }, () => null, ""),
    saveTurns: Args.custom<number>({ hidden: true, default: 0 }, () => 0, ""),
    askedAboutWish: Args.custom<boolean>({ hidden: true, default: false }, () => false, ""),
    triedToUnlockHiddenTavern: Args.custom<boolean>(
      { hidden: true, default: false },
      () => false,
      ""
    ),
    wishAnswer: Args.custom<boolean>({ hidden: true, default: false }, () => false, ""),
    clarasBellClaimed: Args.custom<boolean>(
      { hidden: true, setting: "_claraBellUsed" },
      () => get("_claraBellUsed"),
      ""
    ),
  },
  { positionalArgs: ["turns"] }
);
