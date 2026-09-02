/**
 * Economic simulator — the field adapter (phase P3+4).
 *
 * ## Why this file exists (finding S24/B5)
 *
 * Tokens and Recipes describe the *same* idea — "a work cycle that consumes
 * some items and produces others" — in two different vocabularies:
 *
 * | Idea | Token | Recipe |
 * | :--- | :--- | :--- |
 * | skill | `config.skill` | `skill` |
 * | required level | `config.skillRequired` | `levelRequirement` |
 * | cycle length | `config.cycleTimeMs` | `durationMs` |
 * | outputs / inputs | `config.outputs` / `config.inputs` | `outputs` / `inputs` |
 *
 * (`RecipeResolver.js:196` is where the running game maps `durationMs` onto
 * `io.cycleTimeMs`, i.e. the game already does this reconciliation once, at its
 * own edge.)
 *
 * Every pass downstream of this module reads **adapted entities only**. No pass
 * anywhere in `sim/` may contain `entity.config?.skillRequired ??
 * entity.levelRequirement`; if a field name has to be chosen, it is chosen
 * here, once.
 *
 * Every pass in this directory is a pure function over data a caller hands in.
 * `recalculateEconomy` is that caller, and `sim/writeBack.js` is the only place
 * a result reaches the store.
 */

/**
 * The Token kinds this simulator does not model in v1 (plan §17's deferred
 * list, plus passives).
 *
 * A Token of one of these kinds **can never anchor an item** (plan §3.2) — but
 * if it has a work cycle it is still *seen*, as a deferred-scope Info row, so a
 * passive producer is not silently forgotten. That is the "Wind Trap wrinkle".
 */
export const DEFERRED_TOKEN_TYPES = Object.freeze([
    'passive',
    'buff',
    'manager',
    'market',
    'enemy',
]);

/**
 * A Token's live charge count.
 *
 * **`uses` is the field. `charges` is never read.** Source of truth:
 * `src/config/registries/tokenRegistry.js:146` (`tokenStartingUses`), which is
 * literally `def.uses ?? null` and is the game's only reader.
 *
 * The CMS cannot import that helper — it reads the game's registry singleton
 * (`TOKENS`), not the CMS's own store — so the semantics are mirrored here in
 * one line rather than re-derived.
 *
 * ⚠️ `charges` was dead data on Token records (finding S6/A5): the retired CMS
 * balance engine's proposal, written back on every recalculation, disagreeing
 * with `uses` on 33 of the 37 Tokens that carried it (one was `uses: 25` beside
 * `charges: 500`). It was deleted from `data/tokens.json` on 2026-09-01. The
 * rule stays because the name could be coined again: reading it would not fail
 * loudly, it would silently multiply some Tokens' lifetimes twentyfold.
 */
export function liveCharges(def) {
    return def?.uses ?? null;
}

/**
 * An output's expected quantity per successful roll.
 *
 * ⚠️ **This must agree with the runtime's `expectedOutputQuantity`**
 * (`tokenRegistry.js:224-238`, `(min + max) / 2` over `outputRange`) or every
 * band the simulator computes is quietly wrong (finding S17/A6).
 * `EconSimTime.test.js` pins the agreement by importing the game's helper.
 *
 * The one addition: authored intent lives in `baseQty {min,max}` and the
 * `minQty`/`maxQty` pair is *derived* output (plan §16), so intent is preferred
 * when present. On the shipped corpus the two agree exactly; when they stop
 * agreeing the pin test is the drift alarm.
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
 * An output's **authored** drop chance, as a percentage.
 *
 * Plan §16 lists `chance` among the *derived* fields, so once the tuning pass
 * (P6) has turned one, the number sitting in `chance` is the simulator's answer
 * rather than the author's question. `baseChance` is the intent, exactly as
 * `baseQty` is the intent behind `minQty`/`maxQty` — and it is what makes a
 * tuned chance re-derivable instead of a one-way overwrite that loses the
 * authored value forever.
 *
 * ⚠️ `writeBack.js` seeds `baseChance` the first time it tunes an output's
 * chance, and never otherwise: an output nothing has tuned carries no
 * `baseChance` and reads straight from `chance`, so untouched content keeps
 * exactly the shape it has always had.
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
        // Units produced per cycle, in expectation. The pricing pass's
        // "abundance" (plan §3.3's multi-output split) is exactly this number.
        abundance: avgQty * chance,
        variable: output?.variable === true,
        anchor: output?.anchor === true,
    });
}

/** One normalised input entry. */
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

/** Adapt one Token definition. `id` may come from the record or its store key. */
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

/** Adapt one Recipe definition. */
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

/**
 * Adapt a whole corpus.
 *
 * Returns entities **sorted by id**. The order is load-bearing for idempotence
 * (plan §11): every later pass iterates this array, and a stable order is what
 * makes two runs byte-identical.
 */
export function adaptCorpus({ tokens, recipes } = {}) {
    const adapted = [
        ...entries(tokens).map(([id, def]) => adaptToken(def, def?.id ?? id)),
        ...entries(recipes).map(([id, def]) => adaptRecipe(def, def?.id ?? id)),
    ];
    adapted.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return adapted;
}

/**
 * Has this entity a **work cycle** at all?
 *
 * ⚠️ **Inert is not the same as untagged** (findings A10 / B11/S21):
 *
 * - *Inert* — `config: null`, or a config that produces nothing. There is
 *   nothing here to tag, so the entity is skipped **silently**. 23 of the 39
 *   shipped Tokens are `config: null` (pickaxes, maps, buffs, the guild hall).
 *   Filing a row for each would bury every real row under permanent noise.
 * - *Untagged* — a real producer with no `sim.tempo` / `sim.purpose`. That is
 *   "you forgot", and it files exactly one Info row (see `tempoPass.js`).
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
