/**
 * Seed the simulator's authoring intent onto outputs that predate it: every output on a Token or a pooled recipe gains `baseQty := { min: minQty, max: maxQty }` and `variable := chance < 100`.
 * ⚠️ This is preservation, not calibration: nothing here rounds, clamps or improves a number, or it would be a balance pass hiding inside a migration. `anchor` is deliberately not seeded, because no authored number implies it and guessing would put a wrong price on an item.
 * Idempotent: an output that already has a `baseQty` is left alone, including its `variable`, so a designer's later edit is never overwritten by a reload.
 * ⚠️ It must run on BOTH load paths: localStorage rehydration (hooked on the persist config's `merge`, not `migrate`, because zustand only calls `migrate` when the stored version is a number and older workspaces have no version key) and `hydrate()` (workspace imports and backup restores, which bypass the persist middleware entirely). `useEntityStore.js` calls this from both.
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

/** Seed a whole workspace, the shape both load paths hand over. Tolerant of anything (a `null`, a partial workspace, a stale blob): it only ever adds keys to output entries, so a shape it does not recognise passes through untouched rather than being discarded. */
export function seedSimIntent(state) {
    if (!state || typeof state !== 'object') return state;
    const tokens = seedTokens(state.tokens);
    const recipePools = seedRecipePools(state.recipePools);
    if (tokens === state.tokens && recipePools === state.recipePools) return state;
    return { ...state, tokens, recipePools };
}
