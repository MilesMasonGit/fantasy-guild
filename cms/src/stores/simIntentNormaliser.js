/**
 * Seed the simulator's **authoring intent** onto outputs that predate it.
 *
 * Added 2026-08-28 (economic simulator rework P2, findings A9 and B7).
 *
 * ## What it does
 *
 * Every output on a Token or a pooled recipe gains two optional fields, derived
 * from the numbers already authored on it:
 *
 * * `baseQty := { min: minQty, max: maxQty }`
 * * `variable := chance < 100`
 *
 * ⚠️ **This is preservation, not calibration.** Those numbers were typed by
 * hand and they are carried across unchanged. Nothing here rounds, clamps,
 * smooths or improves anything — the moment it did, it would be a balance pass
 * hiding inside a migration.
 *
 * The alternative was retyping the intent for every output on 39 Tokens by
 * hand in the tagging sitting. Seeding leaves that sitting to the part that
 * genuinely needs a person: tempo, purpose, and which output is the anchor.
 *
 * `anchor` is deliberately **not** seeded. There is no authored number that
 * implies it and guessing would put a wrong price on an item.
 *
 * ## Idempotent by construction
 *
 * An output that already has a `baseQty` is left completely alone — including
 * its `variable` — so running this twice changes nothing, and so a designer's
 * later edit is never overwritten by a reload.
 *
 * ## ⚠️ It must run on BOTH load paths
 *
 * The entity store is reached two ways and only one of them goes anywhere near
 * a persist migration (finding B7):
 *
 * 1. **localStorage rehydration** — hooked on the persist config's **`merge`**,
 *    not `migrate`. ⚠️ `migrate` is the wrong hook and would look right:
 *    zustand only calls it when the stored version is a *number*, and every
 *    workspace written before 2026-08-28 has no version key at all. See the long
 *    note on the persist config in `useEntityStore.js`.
 * 2. **`hydrate()`** — workspace imports and backup restores, which never touch
 *    localStorage on the way in and so **bypass the persist middleware
 *    entirely**.
 *
 * `useEntityStore.js` calls this from both. Installing it in one place only is
 * the documented way to get this half-right.
 *
 * Nothing reads the seeded fields yet; P3 and P4 build the passes that will.
 */

/** Has this output already been given an intent? */
function alreadySeeded(entry) {
    return entry != null && typeof entry === 'object' && entry.baseQty != null;
}

/** One output entry, seeded. Returns the same object when nothing changes. */
function seedOutput(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    if (alreadySeeded(entry)) return entry;

    const min = Number.isFinite(entry.minQty) ? entry.minQty : 1;
    const max = Number.isFinite(entry.maxQty) ? entry.maxQty : min;
    // A missing chance means "always", which is how the game reads it too.
    const chance = Number.isFinite(entry.chance) ? entry.chance : 100;

    return {
        ...entry,
        baseQty: { min, max },
        variable: chance < 100,
    };
}

/** A list of outputs, seeded. Returns the same array when nothing changes. */
function seedOutputs(outputs) {
    if (!Array.isArray(outputs)) return outputs;
    let changed = false;
    const next = outputs.map((entry) => {
        const seeded = seedOutput(entry);
        if (seeded !== entry) changed = true;
        return seeded;
    });
    return changed ? next : outputs;
}

/** Every Token's `config.outputs`, seeded. */
export function seedTokens(tokens) {
    if (!tokens || typeof tokens !== 'object') return tokens;
    let changed = false;
    const next = {};
    for (const [id, token] of Object.entries(tokens)) {
        const outputs = token?.config?.outputs;
        const seeded = seedOutputs(outputs);
        if (seeded !== outputs) {
            changed = true;
            next[id] = { ...token, config: { ...token.config, outputs: seeded } };
        } else {
            next[id] = token;
        }
    }
    return changed ? next : tokens;
}

/** Every pooled recipe's `outputs`, seeded. */
export function seedRecipePools(recipePools) {
    if (!recipePools || typeof recipePools !== 'object') return recipePools;
    let changed = false;
    const next = {};
    for (const [skillId, pool] of Object.entries(recipePools)) {
        if (!Array.isArray(pool)) { next[skillId] = pool; continue; }
        let poolChanged = false;
        const nextPool = pool.map((recipe) => {
            const seeded = seedOutputs(recipe?.outputs);
            if (seeded === recipe?.outputs) return recipe;
            poolChanged = true;
            return { ...recipe, outputs: seeded };
        });
        if (poolChanged) changed = true;
        next[skillId] = poolChanged ? nextPool : pool;
    }
    return changed ? next : recipePools;
}

/**
 * Seed a whole workspace — the shape both load paths hand over.
 *
 * Tolerant of anything: a `null`, a partial workspace with no tokens, a stale
 * blob from before any of these fields existed. It only ever adds two keys to
 * output entries and never removes or rewrites anything, so a shape it does not
 * recognise passes through untouched rather than being discarded.
 */
export function seedSimIntent(state) {
    if (!state || typeof state !== 'object') return state;
    const tokens = seedTokens(state.tokens);
    const recipePools = seedRecipePools(state.recipePools);
    if (tokens === state.tokens && recipePools === state.recipePools) return state;
    return { ...state, tokens, recipePools };
}
