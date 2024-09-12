import { Familiar, holiday } from "kolmafia";
import {
  $effect,
  $familiar,
  $item,
  $items,
  clamp,
  findLeprechaunMultiplier,
  getModifier,
  have,
  Robortender,
  totalFamiliarWeight,
} from "libram";
import { baseMeat, felizValue, newarkValue } from "../lib";
import { garboAverageValue, garboValue } from "../garboValue";
import { GeneralFamiliar } from "./lib";

type ConstantValueFamiliar = {
  familiar: Familiar;
  value: (_mode: "barf" | "free") => number;
};

const bestAlternative = getModifier("Meat Drop", $item`amulet coin`);
// Constant Value familiars are those that drop items at a constant rate without limit, compare Rotating Value familiars
const standardFamiliars: ConstantValueFamiliar[] = [
  {
    familiar: $familiar`Obtuse Angel`,
    value: () => 0.02 * garboValue($item`time's arrow`),
  },
  {
    familiar: $familiar`Stocking Mimic`,
    value: (mode) =>
      garboAverageValue(...$items`Polka Pop, BitterSweetTarts, Piddles`) / 6 -
      // We can't equip an amulet coin if we equip the bag of many confections
      (mode === "barf" ? (bestAlternative * baseMeat()) / 100 : 0) +
      (1 / 3 + (have($effect`Jingle Jangle Jingle`) ? 0.1 : 0)) *
        totalFamiliarWeight($familiar`Stocking Mimic`),
  },
  {
    familiar: $familiar`Shorter-Order Cook`,
    value: () =>
      garboAverageValue(
        ...$items`short beer, short stack of pancakes, short stick of butter, short glass of water, short white`,
      ) / 11, // 9 with blue plate
  },
  {
    familiar: $familiar`Robortender`,
    value: (mode) =>
      (mode === "barf" ? garboValue($item`elemental sugarcube`) / 5 : 0) +
      (Robortender.currentDrinks().includes($item`Feliz Navidad`)
        ? felizValue() * 0.25
        : 0) +
      (Robortender.currentDrinks().includes($item`Newark`)
        ? newarkValue() * 0.25
        : 0),
  },
  {
    familiar: $familiar`Twitching Space Critter`,

    // Item is ludicrously overvalued and incredibly low-volume.
    // We can remove this cap once the price reaches a lower equilibrium
    // we probably won't, but we can.
    value: () => Math.min(garboValue($item`twitching space egg`) * 0.0002, 690),
  },
  {
    familiar: $familiar`Hobo Monkey`,
    value: () => 75,
  },
  {
    familiar: $familiar`Trick-or-Treating Tot`,
    // This is the value of getting a pirate costume over getting an amulet coin or whatever
    value: (mode) =>
      have($item`li'l pirate costume`) && mode === "barf"
        ? (baseMeat() * (300 - bestAlternative)) / 100
        : 0,
  },
  {
    familiar: $familiar`Cookbookbat`,
    value: () =>
      (3 *
        garboAverageValue(
          ...$items`Vegetable of Jarlsberg, Yeast of Boris, St. Sneaky Pete's Whey`,
        )) /
      11,
  },
  {
    familiar: $familiar`Patriotic Eagle`,
    value: () =>
      holiday().includes("Dependence Day")
        ? 0.05 * garboValue($item`souvenir flag`)
        : 0,
  },
  {
    familiar: $familiar`Mini Kiwi`,
    value: (mode) =>
      mode === "barf"
        ? 0 // Handled in outfit caching code
        : clamp(totalFamiliarWeight($familiar`Mini Kiwi`) * 0.005, 0, 1) *
          garboValue($item`mini kiwi`), // faster with aviator goggles
  },
];

export default function getConstantValueFamiliars(
  mode: "barf" | "free",
): GeneralFamiliar[] {
  return standardFamiliars
    .filter(({ familiar }) => have(familiar))
    .map(({ familiar, value }) => ({
      familiar,
      expectedValue: value(mode),
      leprechaunMultiplier: findLeprechaunMultiplier(familiar),
      limit: "none",
    }));
}
