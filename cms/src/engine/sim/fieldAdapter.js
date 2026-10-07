/** Economic simulator: the field adapter. Tokens and Recipes describe the same idea (a work cycle that consumes items and produces others) in two vocabularies: skill is `config.skill` / `skill`, required level `config.skillRequired` / `levelRequirement`, cycle length `config.cycleTimeMs` / `durationMs`, and I/O is `config.outputs` + `config.inputs` / `outputs` + `inputs`. Every pass reads adapted entities only; no pass in `sim/` may contain `entity.config?.skillRequired ?? entity.levelRequirement`, because a field name is chosen here, once. Every pass in this directory is a pure function over data a caller hands in. */

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

/** One normalised output entry. `chance` is a fraction; `chancePercent` is authored. */
function adaptOutput(output) {
    const { min, max } = quantityRange(output);
    const percent = authoredChance(output);
    const avgQty = expectedQuantity(output);
    const chance = percent / 100;
    return Object.freeze({
        itemId: output?.itemId ?? null,
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

function adaptInput(input) {
    return Object.freeze({
        itemId: input?.itemId ?? null,
        quantity: Number.isFinite(input?.quantity) ? input.quantity : 1,
    });
}

function adaptCommon({ id, name, kind, skill, level, cycleTimeMs, inputs, outputs, sim, downcycle, rarity, tokenType, charges }) {
    const adaptedOutputs = Object.freeze((outputs || []).map(adaptOutput));
    const adaptedInputs = Object.freeze((inputs || []).map(adaptInput));
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

export function adaptToken(def, id = def?.id) {
    return adaptCommon({
        id,
        name: def?.name,
        kind: 'token',
        skill: def?.config?.skill,
        level: def?.config?.skillRequired,
        cycleTimeMs: def?.config?.cycleTimeMs,
        inputs: def?.config?.inputs,
        outputs: def?.config?.outputs,
        sim: def?.sim,
        // Tokens have no downcycle concept today; the field is read anyway so
        // one shape serves both kinds.
        downcycle: def?.downcycle,
        rarity: def?.rarity,
        tokenType: def?.tokenType,
        charges: liveCharges(def),
    });
}

export function adaptRecipe(def, id = def?.id) {
    return adaptCommon({
        id,
        name: def?.name,
        kind: 'recipe',
        skill: def?.skill,
        level: def?.levelRequirement,
        cycleTimeMs: def?.durationMs,
        inputs: def?.inputs,
        outputs: def?.outputs,
        sim: def?.sim,
        downcycle: def?.downcycle,
        // Recipes carry no rarity. See `rarityRank` in `anchorPass.js` for how
        // the tie-break handles that.
        rarity: null,
        tokenType: null,
        charges: null,
    });
}

/** Accept either a keyed object or an array of records, and yield `[id, def]`. */
function entries(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection.map((def, i) => [def?.id ?? String(i), def]);
    return Object.entries(collection);
}

/** Adapt a whole corpus. Returns entities sorted by id: every later pass iterates this array, and a stable order is what makes two runs byte-identical. */
export function adaptCorpus({ tokens, recipes } = {}) {
    const adapted = [
        ...entries(tokens).map(([id, def]) => adaptToken(def, def?.id ?? id)),
        ...entries(recipes).map(([id, def]) => adaptRecipe(def, def?.id ?? id)),
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
