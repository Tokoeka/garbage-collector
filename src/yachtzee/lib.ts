import { cliExecute, Effect, Item, totalFreeRests, useFamiliar, visitUrl } from "kolmafia";
import {
	$effect,
	$familiar,
	$item,
	$items,
	$location,
	$skill,
	clamp,
	get,
	getActiveSongs,
	getModifier,
	have,
	Mood,
	Requirement,
	set,
	sum,
	sumNumbers,
	tryFindFreeRun,
} from "libram";
import { withStash } from "../clan";
import { garboAdventureAuto, Macro } from "../combat";
import { globalOptions } from "../config";
import { EmbezzlerFight, embezzlerSources } from "../embezzler";
import { freeFightFamiliar } from "../familiar";
import { ltbRun, realmAvailable } from "../lib";
import { freeFightOutfit } from "../outfit";
import postCombatActions from "../post";

const ignoredSources = [
	"Orb Prediction",
	"Pillkeeper Semirare",
	"Lucky!",
	"11-leaf clover (untapped potential)",
];
export const expectedEmbezzlers = sum(
	embezzlerSources.filter((source: EmbezzlerFight) => !ignoredSources.includes(source.name)),
	(source: EmbezzlerFight) => source.potential()
);

export function pyecAvailable(): boolean {
	if (get("_PYECAvailable") === "") {
		set(
			"_PYECAvailable",
			get("expressCardUsed")
				? false
				: have($item`Platinum Yendorian Express Card`)
				? true
				: withStash($items`Platinum Yendorian Express Card`, () => {
						return have($item`Platinum Yendorian Express Card`);
				  })
		);
	}
	return get("_PYECAvailable", false);
}

export function shrugIrrelevantSongs(): void {
	for (const song of getActiveSongs()) {
		const slot = Mood.defaultOptions.songSlots.find((slot) => slot.includes(song));
		if (
			!slot &&
			song !== $effect`Ode to Booze` &&
			song !== $effect`Polka of Plenty` &&
			song !== $effect`Chorale of Companionship` &&
			song !== $effect`The Ballad of Richie Thingfinder`
		) {
			cliExecute(`shrug ${song}`);
		}
	}
	// Shrug default Mood songs
	cliExecute("shrug ur-kel");
	cliExecute("shrug phat loot");
}

export function cinchNCs(): number {
	if (!have($item`Cincho de Mayo`)) return 0;
	const cinchRestored = Array(100)
		.fill(0)
		.map((_, i) => clamp(50 - 5 * i, 5, 30));
	const cinchRestsUsed = get("_cinchoRests", 0);
	const freeRestsLeft = Math.max(0, totalFreeRests() - get("timesRested"));
	const useableCinch =
		100 -
		get("_cinchUsed", 0) +
		sumNumbers(cinchRestored.slice(cinchRestsUsed, cinchRestsUsed + freeRestsLeft));
	return Math.floor(useableCinch / 60);
}

export const freeNCs = (): number =>
	(have($item`Clara's bell`) && !globalOptions.clarasBellClaimed ? 1 : 0) +
	(have($item`Jurassic Parka`) ? 5 - get("_spikolodonSpikeUses") : 0) +
	cinchNCs();

export function yachtzeeBuffValue(obj: Item | Effect): number {
	return (
		(2000 * (getModifier("Meat Drop", obj) + getModifier("Familiar Weight", obj) * 2.5)) / 100
	);
}

export function useSpikolodonSpikes(): void {
	if (get("_spikolodonSpikeUses") >= 5) return;
	const run = tryFindFreeRun() ?? ltbRun();

	const canJelly =
		have($familiar`Space Jellyfish`) && !run.constraints.familiar && realmAvailable("stench");
	const familiar =
		run.constraints.familiar?.() ??
		(canJelly
			? $familiar`Space Jellyfish`
			: freeFightFamiliar({ allowAttackFamiliars: false }));
	useFamiliar(familiar);
	const mergedRequirements = new Requirement([], { forceEquip: $items`Jurassic Parka` }).merge(
		run.constraints.equipmentRequirements?.() ?? new Requirement([], {})
	);
	run.constraints.preparation?.();
	freeFightOutfit(mergedRequirements);
	cliExecute("parka spikolodon");

	const targetZone = canJelly
		? $location`Pirates of the Garbage Barges`
		: $location`Sloppy Seconds Diner`;
	const macro = Macro.familiarActions()
		.skill($skill`Launch spikolodon spikes`)
		.step(run.macro);
	const startingSpikes = get("_spikolodonSpikeUses");
	do {
		garboAdventureAuto(targetZone, macro);
	} while (get("_spikolodonSpikeUses") === startingSpikes);

	postCombatActions();
}

export function freeRest(): boolean {
	if (get("timesRested") >= totalFreeRests()) return false;

	if (get("chateauAvailable")) {
		visitUrl("place.php?whichplace=chateau&action=chateau_restlabelfree");
	} else if (get("getawayCampsiteUnlocked")) {
		visitUrl("place.php?whichplace=campaway&action=campaway_tentclick");
	} else {
		visitUrl("campground.php?action=rest");
	}

	return true;
}
