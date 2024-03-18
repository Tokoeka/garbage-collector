import { inebrietyLimit, Item, myInebriety, print } from "kolmafia";
import { $items, get, Session, set } from "libram";
import { globalOptions } from "./config";
import { formatNumber, HIGHLIGHT, resetDailyPreference } from "./lib";
import { failedWishes } from "./potions";
import { garboValue } from "./garboValue";
import { estimatedGarboTurns } from "./turns";

type SessionKey = "full" | "barf" | "meat-start" | "meat-end" | "item" | "item-end";
const sessions: Map<SessionKey, Session> = new Map();
/**
 * Start a new session, deleting any old session
 */
export function startSession(): void {
  sessions.set("full", Session.current());
  print("DEBUG: Starting Session", "red");
}

/**
 * Compute the difference between the current drops and starting session (if any)
 * @returns The difference
 */
export function sessionSinceStart(): Session {
  const session = sessions.get("full");
  if (session) {
    return Session.current().diff(session);
  }
  return Session.current();
}

let extraValue = 0;
export function trackMarginalTurnExtraValue(additionalValue: number) {
  extraValue += additionalValue;
}

export function trackMarginalMpa() {
  const barf = sessions.get("barf");
  const current = Session.current();
  if (!barf) {
    sessions.set("barf", Session.current());
    print("DEBUG: Starting Barf Tracking", "red");
  } else {
    const turns = barf.diff(current).totalTurns;
    let overDrunk = 0;
    if (globalOptions.ascend && myInebriety() <= inebrietyLimit()) {
      overDrunk = -40;
    }
    // track items if we have run at least 100 turns in barf mountain or we have less than 200 turns left in barf mountain
    const item = sessions.get("item");
    if (!item && (turns > 100 || estimatedGarboTurns() <= 200)) {
      sessions.set("item", current);
      print("DEBUG: Starting Item Tracking", "red");
    }

    // end tracking items prior to depositing clan stash items back
    const itemEnd = sessions.get("item-end");
    if (!itemEnd && estimatedGarboTurns() + overDrunk <= 3) {
      sessions.set("item-end", current);
      print("DEBUG: Ending Item Tracking", "red");
    }

    // start tracking meat if there are less than 75 turns left in barf mountain
    const meatStart = sessions.get("meat-start");
    if (!meatStart && estimatedGarboTurns() <= 75) {
      sessions.set("meat-start", current);
      // print("DEBUG: Starting Meat tracking", "red");
    }

    // stop tracking meat if there are less than 25 turns left in barf moutain
    const meatEnd = sessions.get("meat-end");
    if (!meatEnd && estimatedGarboTurns() + overDrunk <= 25) {
      sessions.set("meat-end", current);
      print("DEBUG: Ending Meat tracking", "red");
    }
  }
}

const outlierItemList = $items`Extrovermectin™, Volcoino, Poké-Gro fertilizer`;

function printMarginalSession() {
  const barf = sessions.get("barf");
  const meatStart = sessions.get("meat-start");
  const meatEnd = sessions.get("meat-end");
  const item = sessions.get("item");
  const itemEnd = sessions.get("item-end");
  print("DEBUG: PMS1", "red");
  if (barf) {
    print("DEBUG: PMS Barf");
  }
  if (meatStart) {
    print("DEBUG: PMS MeatStart");
  }
  if (meatEnd) {
    print("DEBUG: PMS MeatEnd");
  }

  // we can only print out marginal items if we've started tracking for marginal value
  if (barf && meatStart && meatEnd) {
    print("DEBUG: PMS2", "red");
    const { itemDetails: barfItemDetails } = barf.value(garboValue);

    const isOutlier = (detail: { item: Item; value: number; quantity: number }) =>
      outlierItemList.includes(detail.item) ||
      (detail.quantity === 1 &&
        detail.value >= 5000 &&
        barfItemDetails.some((d) => d.item === detail.item && d.quantity <= 2));

    const meatMpa = Session.computeMPA(meatStart, meatEnd, {
      value: garboValue,
      isOutlier,
    });

    if (item && itemEnd) {
      print("DEBUG: PMS3", "red");
      // MPA printout including maringal items
      const itemMpa = Session.computeMPA(item, itemEnd, {
        value: garboValue,
        isOutlier,
        excludeValue: { item: extraValue },
      });

      print(`Outliers:`, HIGHLIGHT);
      for (const detail of itemMpa.outlierItems) {
        print(
          `${detail.quantity} ${detail.item} worth ${detail.value.toFixed(0)} total`,
          HIGHLIGHT,
        );
      }

      const effectiveMpa = itemMpa.mpa.effective - itemMpa.mpa.meat + meatMpa.mpa.meat;
      const totalMpa = itemMpa.mpa.total - itemMpa.mpa.meat + meatMpa.mpa.meat;

      print(
        `Marginal MPA: ${formatNumber(
          Math.round(meatMpa.mpa.meat * 100) / 100,
        )} [raw] + ${formatNumber(
          Math.round(itemMpa.mpa.items * 100) / 100,
        )} [items] (${formatNumber(
          Math.round((itemMpa.mpa.total - itemMpa.mpa.effective) * 100) / 100,
        )} [outliers]) = ${formatNumber(
          Math.round(effectiveMpa * 100) / 100,
        )} [total] (${formatNumber(Math.round(totalMpa * 100) / 100)} [w/ outliers])`,
        HIGHLIGHT,
      );
    } else {
      // MPA printout excluding marginal items
      print(
        "Warning: Insufficient turns were run, so this estimate is subject to large variance. Be careful when using these values as is.",
        "red",
      );
      print(
        `Marginal MPA: ${formatNumber(
          Math.round(meatMpa.mpa.meat * 100) / 100,
        )} [raw] + ${formatNumber(
          Math.round(meatMpa.mpa.items * 100) / 100,
        )} [items] = ${formatNumber(Math.round(meatMpa.mpa.total * 100) / 100)} [total]`,
        HIGHLIGHT,
      );
    }
  }
}

const garboResultsProperties = [
  "garboResultsMeat",
  "garboResultsItems",
  "garboResultsTurns",
] as const;
type GarboResultsProperty = (typeof garboResultsProperties)[number];

function getGarboDaily(property: GarboResultsProperty): number {
  return get(property, 0);
}
function setGarboDaily(property: GarboResultsProperty, value: number) {
  set(property, value);
}
function resetGarboDaily() {
  print("DEBUG: Garbo Daily Reset", "red");
  if (resetDailyPreference("garboResultsDate")) {
    print("DEBUG: Reset TRUE", "red");
    for (const prop of garboResultsProperties) {
      setGarboDaily(prop, 0);
    }
  }
}

export function endSession(printLog = true): void {
  print("DEBUG: Session End", "red");
  resetGarboDaily();
  const message = (head: string, turns: number, meat: number, items: number) =>
    print(
      `${head}, across ${formatNumber(turns)} turns you generated ${formatNumber(
        meat + items,
      )} meat, with ${formatNumber(meat)} raw meat and ${formatNumber(items)} from items`,
      HIGHLIGHT,
    );

  const { meat, items, itemDetails, turns } = sessionSinceStart().value(garboValue);
  const totalMeat = meat + getGarboDaily("garboResultsMeat");
  const totalItems = items + getGarboDaily("garboResultsItems");
  const totalTurns = turns + getGarboDaily("garboResultsTurns");

  if (printLog) {
    // list the top 3 gaining and top 3 losing items
    const losers = itemDetails.sort((a, b) => a.value - b.value).slice(0, 10);
    const winners = itemDetails.reverse().slice(0, 10);
    print(`Extreme Items:`, HIGHLIGHT);
    for (const detail of [...winners, ...losers]) {
      print(`${detail.quantity} ${detail.item} worth ${detail.value.toFixed(0)} total`, HIGHLIGHT);
    }
  }

  setGarboDaily("garboResultsMeat", totalMeat);
  setGarboDaily("garboResultsItems", totalItems);
  setGarboDaily("garboResultsTurns", totalTurns);

  if (printLog) {
    message("This run of garbo", turns, meat, items);
    message("So far today", totalTurns, totalMeat, totalItems);

    printMarginalSession();
  }
  if (globalOptions.loginvalidwishes) {
    if (failedWishes.length === 0) {
      print("No invalid wishes found.");
    } else {
      print("Found the following unwishable effects:");
      failedWishes.forEach((effect) => print(`${effect}`));
    }
  }
}
