/** Economic simulator: the field adapter. Tokens and Recipes describe the same idea (a work cycle that consumes items and produces others) in two vocabularies: skill is `config.skill` / `skill`, required level `config.skillRequired` / `levelRequirement`, cycle length `config.cycleTimeMs` / `durationMs`, and I/O is `config.outputs` + `config.inputs` / `outputs` + `inputs`. Every pass reads adapted entities only; no pass in `sim/` may contain `entity.config?.skillRequired ?? entity.levelRequirement`, because a field name is chosen here, once. Every pass in this directory is a pure function over data a caller hands in. */

import { catchPoolsOf, hasCatchPools } from '../../../../src/config/registries/catchPools.js';
import { cropTermsOf, fieldOf, stationKindOffers } from '../../../../src/config/registries/tokenConstants.js';
import { stationSkillOf, stationKindOf } from '../../../../src/systems/effects/statements.js';

/** The Token kinds this simulator does not model, plus passives. Such a Token can never anchor an item, but if it has a work cycle it is still seen, as a deferred-scope Info row, so a passive producer is not silently forgotten. */
export const DEFERRED_TOKEN_TYPES = Object.freeze([
    'passive',
    'buff',
    'manager',
    'market',
    'enemy',
    'spawner',
]);

/**
 * A Token's live charge count.
 * ⚠️ `uses` is the field; `charges` is never read. `tokenStartingUses` in `src/config/registries/tokenRegistry.js` is the game's only reader and is `def.uses ?? null`; the CMS cannot import it (it reads the game's registry singleton, not the CMS store), so the semantics are mirrored here. Reading `charges` would not fail loudly, it would silently multiply some Tokens' lifetimes.
 */
export function liveCharges(def) {
    return def?.uses ?? null;
}

/**
 * An output's expected quantity per successful roll.
 * ⚠️ Must agree with the runtime's `expectedOutputQuantity` in `tokenRegistry.js`, `(min + max) / 2` over `outputRange`, or every band the simulator computes is quietly wrong; `EconSimTime.test.js` pins the agreement. Authored intent lives in `baseQty {min,max}` while `minQty`/`maxQty` are derived, so intent is preferred when present.
 */
export function expectedQuantity(output) {
    const range = quantityRange(output);
    return (range.min + range.max) / 2;
}

/** `{ min, max }` for an output, intent first, tolerating an inverted range. */
export function quantityRange(output) {
    const base = output?.baseQty;
    const fallback = output?.quantity ?? 1;
    const min = base?.min ?? output?.minQty ?? fallback;
    const max = base?.max ?? output?.maxQty ?? fallback;
    return min <= max ? { min, max } : { min: max, max: min };
}

/**
 * An output's authored drop chance, as a percentage. `chance` is a derived field, so once the tuning pass has turned one it holds the simulator's answer; `baseChance` is the authored intent that keeps a tuned chance re-derivable.
 * ⚠️ `writeBack.js` seeds `baseChance` the first time it tunes an output's chance and never otherwise, so untouched content keeps its original shape.
 */
export function authoredChance(output) {
    if (Number.isFinite(output?.baseChance)) return output.baseChance;
    return Number.isFinite(output?.chance) ? output.chance : 100;
}

/**
 * One normalised output entry. `chance` is a fraction; `chancePercent` is authored.
 * ⚠️ An output of an `exempt` item (a map) keeps its place but names no item, like a currency or Token output: every pass skips it, and the write-back's index join still lines up.
 */
function adaptOutput(output, exempt) {
    const { min, max } = quantityRange(output);
    const percent = authoredChance(output);
    const avgQty = expectedQuantity(output);
    const chance = percent / 100;
    const itemId = output?.itemId ?? null;
    return Object.freeze({
        itemId: itemId !== null && exempt.has(itemId) ? null : itemId,
        chancePercent: percent,
        chance,
        minQty: min,
        maxQty: max,
        avgQty,
        // Units produced per cycle, in expectation; this is the pricing pass's abundance.
        abundance: avgQty * chance,
        variable: output?.variable === true,
        anchor: output?.anchor === true,
    });
}

function adaptInput(input, exempt) {
    const itemId = input?.itemId ?? null;
    return Object.freeze({
        itemId: itemId !== null && exempt.has(itemId) ? null : itemId,
        quantity: Number.isFinite(input?.quantity) ? input.quantity : 1,
    });
}

const NO_EXEMPT = new Set();

function adaptCommon({ id, name, kind, skill, level, cycleTimeMs, inputs, outputs, sim, downcycle, rarity, tokenType, charges }, exempt = NO_EXEMPT) {
    const adaptedOutputs = Object.freeze((outputs || []).map((o) => adaptOutput(o, exempt)));
    const adaptedInputs = Object.freeze((inputs || []).map((i) => adaptInput(i, exempt)));
    return Object.freeze({
        id,
        name: name ?? id,
        kind,
        skill: skill ?? null,
        // A Token with no `skillRequired` is a level-1 Token (the same reading
        // `tempoBands.levelScale` takes).
        level: Number.isFinite(level) && level >= 1 ? level : 1,
        authoredCycleTimeMs: Number.isFinite(cycleTimeMs) ? cycleTimeMs : null,
        inputs: adaptedInputs,
        outputs: adaptedOutputs,
        tempo: sim?.tempo ?? null,
        purpose: sim?.purpose ?? null,
        downcycle: downcycle === true,
        rarity: rarity ?? null,
        tokenType: tokenType ?? null,
        charges,
    });
}

/**
 * A water Token's work as Outputs: one catch a cycle from its no-bait pools, each fish at its share.
 * Several no-bait pools (a rod's and a net's) share the cycles evenly, so a fish in both counts once
 * at its average share. A baited pool is left out: bait is a choice, the no-bait catch is the
 * water's own.
 * ⚠️ The catch replaces the Token's Outputs in the game, so its authored `config.outputs` are never
 * read here, and `writeBack.applyTokenResults` never writes them.
 */
export function waterOutputs(def) {
    const basic = catchPoolsOf(def).filter(p => !p.bait);
    const shares = new Map();
    for (const pool of basic) {
        const total = pool.catches.reduce((s, c) => s + c.weight, 0);
        for (const c of pool.catches) shares.set(c.itemId, (shares.get(c.itemId) || 0) + c.weight * 100 / total);
    }
    return [...shares].map(([itemId, percent]) => ({ itemId, chance: percent / basic.length, minQty: 1, maxQty: 1 }));
}

export function adaptToken(def, id = def?.id, exempt = NO_EXEMPT) {
    return adaptCommon({
        id,
        name: def?.name,
        kind: 'token',
        skill: def?.config?.skill,
        level: def?.config?.skillRequired,
        cycleTimeMs: def?.config?.cycleTimeMs,
        inputs: def?.config?.inputs,
        outputs: hasCatchPools(def) ? waterOutputs(def) : def?.config?.outputs,
        sim: def?.sim,
        // Tokens have no downcycle concept today; the field is read anyway so
        // one shape serves both kinds.
        downcycle: def?.downcycle,
        rarity: def?.rarity,
        tokenType: def?.tokenType,
        charges: liveCharges(def),
    }, exempt);
}

/**
 * A crop's inputs as one harvest cycle pays them: its seed (`cropTermsOf(...).seeds`, what one sowing
 * costs) divided by its load, since a ripe Field is harvested `load` times per sowing.
 * ⚠️ `crop.growMs` is not read: the harvest cycle is `durationMs`, and growing is waiting, which the
 * simulator does not value (as with any other timed growth). A Crop Load bonus in reach (a Composter)
 * is not counted either: the load is the crop's own.
 */
function cropInputs(def) {
    const { seeds, load } = cropTermsOf(def);
    return seeds.map(s => ({ itemId: s.itemId, quantity: s.quantity / load }));
}

/** `crop`: whether this recipe is grown on a Field (see `cropRecipeIds`). */
export function adaptRecipe(def, id = def?.id, exempt = NO_EXEMPT, crop = false) {
    return adaptCommon({
        id,
        name: def?.name,
        kind: 'recipe',
        skill: def?.skill,
        level: def?.levelRequirement,
        cycleTimeMs: def?.durationMs,
        inputs: crop ? cropInputs(def) : def?.inputs,
        outputs: def?.outputs,
        sim: def?.sim,
        downcycle: def?.downcycle,
        // Recipes carry no rarity. See `rarityRank` in `anchorPass.js` for how
        // the tie-break handles that.
        rarity: null,
        tokenType: null,
        charges: null,
    }, exempt);
}

/** Accept either a keyed object or an array of records, and yield `[id, def]`. */
function entries(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection.map((def, i) => [def?.id ?? String(i), def]);
    return Object.entries(collection);
}

/**
 * The recipes grown on a Field: each one a Field Token in the corpus offers (its `Works as` skill,
 * its station kind, never a building recipe, as the game's `recipesForToken` reads them), and each
 * one with a `crop` block of its own, whose author meant it as a crop.
 * ⚠️ Tokens must be expanded (their rules resolved), as Recalculate hands them in: a Field's station
 * skill is one of its rules.
 */
export function cropRecipeIds(tokens, recipes) {
    const fields = entries(tokens).map(([, def]) => def).filter(def => fieldOf(def) && stationSkillOf(def));
    const ids = new Set();
    for (const [key, def] of entries(recipes)) {
        if (!def) continue;
        const id = def.id ?? key;
        if (def.crop && typeof def.crop === 'object' && !Array.isArray(def.crop)) { ids.add(id); continue; }
        if (Array.isArray(def.foundationKinds) && def.foundationKinds.length) continue;
        if (fields.some(f => stationSkillOf(f) === def.skill && stationKindOffers(stationKindOf(f), def))) ids.add(id);
    }
    return ids;
}

/** Adapt a whole corpus. Returns entities sorted by id: every later pass iterates this array, and a stable order is what makes two runs byte-identical. `exempt` names the items no pass may see (the maps). */
export function adaptCorpus({ tokens, recipes, exempt = NO_EXEMPT } = {}) {
    const crops = cropRecipeIds(tokens, recipes);
    const adapted = [
        ...entries(tokens).map(([id, def]) => adaptToken(def, def?.id ?? id, exempt)),
        ...entries(recipes).map(([id, def]) => adaptRecipe(def, def?.id ?? id, exempt, crops.has(def?.id ?? id))),
    ];
    adapted.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return adapted;
}

/**
 * Has this entity a work cycle at all?
 * ⚠️ Inert is not the same as untagged. Inert (`config: null`, or a config that produces nothing) has nothing to tag, so it is skipped silently; filing a row for each would bury every real row under permanent noise. Untagged is a real producer with no `sim.tempo` / `sim.purpose`: you forgot, and it files exactly one Info row (see `tempoPass.js`).
 */
export function isInert(entity) {
    if (!entity) return true;
    if (!entity.outputs || entity.outputs.length === 0) return true;
    return !entity.outputs.some(o => o.itemId);
}

/** Is this a Token kind the v1 simulator does not model? (Never anchors.) */
export function isDeferredKind(entity) {
    return entity?.kind === 'token' && DEFERRED_TOKEN_TYPES.includes(entity.tokenType);
}

/** A producer with no Tempo/Purpose tags — "you forgot", not "nothing to tag". */
export function isUntagged(entity) {
    return !entity?.tempo || !entity?.purpose;
}
