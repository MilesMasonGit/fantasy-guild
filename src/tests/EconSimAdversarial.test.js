/**
 * Economic simulator — **the adversarial content set** (phase P9).
 *
 * Every hard case in the design, in **one workspace**, run through the **whole
 * pipeline** — `recalculateEconomy`: the passes, the write-back, the audit, the
 * churn report and the sync payload — and asked three questions:
 *
 * 1. does it **terminate**?
 * 2. does it **refuse each case correctly**?
 * 3. is it **idempotent** — two runs byte-identical?
 *
 * ## ⚠️ Why this file exists, and why it is not nine small tests
 *
 * Several of these paths were **fixture-proven only** for the entire rework, and
 * each was exercised alone:
 *
 * | Path | Why it never met real content |
 * | :--- | :--- |
 * | Token-output refusal | no shipped recipe outputs a Token (S15) |
 * | Downcycle chain | no shipped recipe is a return leg |
 * | Enemy pool entries | the CMS store never loads `data/enemies.json` (S12) |
 * | Gold and raw-item pool entries | unauthorable in the Map editor today |
 * | Sticky re-election | no item carried a `valueSource` before the P5 cutover |
 *
 * A pass that is right about one hard case at a time can still be wrong about
 * two of them together: a cycle beside a downcycle, an orphan feeding a blocked
 * chain, a Map pool with no Token in it at all. This is the workspace where they
 * meet.
 *
 * ⚠️ Nothing here names a shipped id. Every id is `*_adv_*`, so the owner can
 * author freely without breaking this file.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';

// ── The workspace ────────────────────────────────────────────────────────────

/** A Token, in the shape the CMS store holds one. */
function tok(id, name, config, extra = {}) {
    return {
        id, name, rarity: 'common', tokenType: 'resource', uses: 40,
        statements: [], requiresHero: true,
        ...extra,
        config,
    };
}

/**
 * Every adversarial case at once.
 *
 * ```
 *  healthy       ore ──► bar          (anchor, then a crafted step)
 *  downcycle     bar ──► ore          (return leg: exempt from the cycle refusal)
 *  cycle         cyc_a ⇄ cyc_b        (genuine ring: refused, not iterated)
 *  orphan        adv_orphan           (nothing produces it)
 *  deferred      adv_relic            (a passive produces it, and passives never anchor)
 *  untagged      adv_scrap            (its only source has no Tempo/Purpose)
 *  token-output  recipe outputs a Token id
 *  extreme tags  level 99 · heavy · XPH · mythic · 100,000 charges
 *  pools         one with no Token at all; one that is all gold and raw items
 *  enemy         a pool entry that is an enemy, priced off its drop table
 * ```
 */
function adversarialWorkspace() {
    return {
        items: {
            item_adv_ore: { id: 'item_adv_ore', name: 'Adv Ore', type: 'material', value: null },
            item_adv_bar: { id: 'item_adv_bar', name: 'Adv Bar', type: 'material', value: null },
            item_adv_orphan: { id: 'item_adv_orphan', name: 'Adv Orphan', type: 'material', value: null },
            item_adv_relic: { id: 'item_adv_relic', name: 'Adv Relic', type: 'material', value: null },
            item_adv_scrap: { id: 'item_adv_scrap', name: 'Adv Scrap', type: 'material', value: null },
            item_adv_cyc_a: { id: 'item_adv_cyc_a', name: 'Adv Cyc A', type: 'material', value: null },
            item_adv_cyc_b: { id: 'item_adv_cyc_b', name: 'Adv Cyc B', type: 'material', value: null },
            item_adv_hoard: { id: 'item_adv_hoard', name: 'Adv Hoard', type: 'material', value: null },
            item_adv_relic_dust: { id: 'item_adv_relic_dust', name: 'Adv Relic Dust', type: 'material', value: null },
            item_adv_fang: { id: 'item_adv_fang', name: 'Adv Fang', type: 'material', value: null },
        },
        tokens: {
            // The healthy anchor everything else is measured against. If this
            // stops pricing when a hard case is added beside it, that is the
            // finding this whole file is for.
            token_adv_surface: tok('token_adv_surface', 'Adv Surface Seam', {
                skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, inputs: [],
                outputs: [{ itemId: 'item_adv_ore', chance: 100, minQty: 1, maxQty: 2 }],
            }, { sim: { tempo: 'fast', purpose: 'gph' } }),

            // A source for the raw item the item-heavy pool hands over.
            token_adv_hoarder: tok('token_adv_hoarder', 'Adv Hoarder', {
                skill: 'mining', skillRequired: 8, cycleTimeMs: 30000, inputs: [],
                outputs: [{ itemId: 'item_adv_hoard', chance: 100, minQty: 1, maxQty: 1 }],
            }, { sim: { tempo: 'slow', purpose: 'gph' }, rarity: 'rare', uses: 20 }),

            // A source for what the enemy drops, so the enemy arm has a price
            // to band-check against.
            token_adv_fangsmith: tok('token_adv_fangsmith', 'Adv Fangsmith', {
                skill: 'mining', skillRequired: 3, cycleTimeMs: 20000, inputs: [],
                outputs: [{ itemId: 'item_adv_fang', chance: 100, minQty: 1, maxQty: 1 }],
            }, { sim: { tempo: 'medium', purpose: 'gph' } }),

            // Deferred kind: it produces, but a passive can never anchor.
            //
            // ⚠️ `requiresHero: false` is what MAKES it a passive. `tokenType`
            // is derived from the Token's own rules, not authored, so a record
            // that merely *says* `passive` is re-filed on the way out — see the
            // dedicated case at the bottom of this file, which is a real
            // non-idempotence and is pinned rather than papered over.
            token_adv_shrine: tok('token_adv_shrine', 'Adv Shrine', {
                skill: 'mining', skillRequired: 4, cycleTimeMs: 30000, inputs: [],
                outputs: [{ itemId: 'item_adv_relic', chance: 100, minQty: 1, maxQty: 1 }],
            }, { tokenType: 'passive', requiresHero: false, sim: { tempo: 'slow', purpose: 'iph' } }),

            // Untagged: a real producer with no Tempo/Purpose. "You forgot."
            token_adv_heap: tok('token_adv_heap', 'Adv Heap', {
                skill: 'mining', skillRequired: 1, cycleTimeMs: 9000, inputs: [],
                outputs: [{ itemId: 'item_adv_scrap', chance: 100, minQty: 1, maxQty: 1 }],
            }),

            // Every tag at its extreme, all at once.
            token_adv_extreme: tok('token_adv_extreme', 'Adv Extreme', {
                skill: 'mining', skillRequired: 99, cycleTimeMs: 600000, inputs: [],
                outputs: [{ itemId: 'item_adv_relic_dust', chance: 5, minQty: 1, maxQty: 999 }],
            }, { rarity: 'mythic', uses: 100000, sim: { tempo: 'heavy', purpose: 'xph' } }),

            // No config at all — the silent structural skip, in the same
            // workspace as everything noisy.
            token_adv_inert: { id: 'token_adv_inert', name: 'Adv Inert', rarity: 'common', tokenType: 'map', uses: null, config: null },
        },
        maps: {
            // A pool with no Token entry at all: slot one has nothing to draw
            // from and falls back to a free draw (CMS-129's renormalisation).
            map_adv_tokenless: {
                id: 'map_adv_tokenless', name: 'Adv Tokenless', price: 400, materials: [],
                pool: [
                    { kind: 'item', refId: 'item_adv_ore', quantity: 3 },
                    { kind: 'gold', amount: 250 },
                ],
            },
            // Gold and raw items worth far more than the scrap budget.
            map_adv_heavy: {
                id: 'map_adv_heavy', name: 'Adv Item Heavy', price: 300, materials: [],
                pool: [
                    { kind: 'item', refId: 'item_adv_hoard', quantity: 20 },
                    { kind: 'gold', amount: 9000 },
                    { kind: 'token', refId: 'token_adv_surface' },
                ],
            },
            // A pool with a Token, an enemy and a support-shaped entry.
            map_adv_mixed: {
                id: 'map_adv_mixed', name: 'Adv Mixed', price: 1200,
                materials: [{ itemId: 'item_adv_ore', quantity: 2 }],
                pool: [
                    { kind: 'token', refId: 'token_adv_surface' },
                    { kind: 'token', refId: 'token_adv_extreme' },
                    { kind: 'enemy', refId: 'enemy_adv_wolf' },
                ],
            },
            // Empty pool, and a guild-hall map: the two skips.
            map_adv_empty: { id: 'map_adv_empty', name: 'Adv Empty', price: 100, materials: [], pool: [] },
            map_guild_hall_adv: { id: 'map_guild_hall_adv', name: 'Adv Hall', price: 0, materials: [], pool: [{ kind: 'token', refId: 'token_adv_surface' }] },
        },
        recipePools: {
            smithing: [
                // The healthy crafted step.
                {
                    id: 'recipe_adv_smelt', name: 'Adv Smelt', skill: 'smithing', levelRequirement: 2,
                    durationMs: 15000, sim: { tempo: 'medium', purpose: 'gph' },
                    inputs: [{ itemId: 'item_adv_ore', quantity: 2 }],
                    outputs: [{ itemId: 'item_adv_bar', chance: 100, minQty: 1, maxQty: 1 }],
                },
                // ⚠️ The return leg, pointing backwards at its own input's item.
                // Flagged `downcycle`, so it must NOT be read as a cycle.
                {
                    id: 'recipe_adv_recycle', name: 'Adv Recycle', skill: 'smithing', levelRequirement: 2,
                    durationMs: 12000, downcycle: true, sim: { tempo: 'medium', purpose: 'iph' },
                    inputs: [{ itemId: 'item_adv_bar', quantity: 1 }],
                    outputs: [{ itemId: 'item_adv_ore', chance: 100, minQty: 2, maxQty: 2 }],
                },
                // A genuine ring, beside the downcycle, to prove the two are
                // told apart.
                {
                    id: 'recipe_adv_cyc_a', name: 'Adv Cycle A', skill: 'smithing', levelRequirement: 1,
                    durationMs: 10000, sim: { tempo: 'fast', purpose: 'gph' },
                    inputs: [{ itemId: 'item_adv_cyc_b', quantity: 1 }],
                    outputs: [{ itemId: 'item_adv_cyc_a', chance: 100, minQty: 1, maxQty: 1 }],
                },
                {
                    id: 'recipe_adv_cyc_b', name: 'Adv Cycle B', skill: 'smithing', levelRequirement: 1,
                    durationMs: 10000, sim: { tempo: 'fast', purpose: 'gph' },
                    inputs: [{ itemId: 'item_adv_cyc_a', quantity: 1 }],
                    outputs: [{ itemId: 'item_adv_cyc_b', chance: 100, minQty: 1, maxQty: 1 }],
                },
                // ⚠️ A recipe whose output is a **Token id**, not an item id.
                {
                    id: 'recipe_adv_tokenout', name: 'Adv Token Forge', skill: 'smithing', levelRequirement: 3,
                    durationMs: 20000, sim: { tempo: 'medium', purpose: 'gph' },
                    inputs: [{ itemId: 'item_adv_bar', quantity: 1 }],
                    outputs: [{ itemId: 'token_adv_surface', chance: 100, minQty: 1, maxQty: 1 }],
                },
                // Deliberately unfinished content, which the tool must tolerate
                // rather than refuse (standing lesson 2): no outputs at all.
                {
                    id: 'recipe_adv_unfinished', name: 'Adv Unfinished', skill: 'smithing', levelRequirement: 1,
                    durationMs: 10000, sim: { tempo: 'fast', purpose: 'gph' },
                    inputs: [], outputs: [],
                },
                // A 0–0 output range: produces this item exactly never.
                {
                    id: 'recipe_adv_never', name: 'Adv Never', skill: 'smithing', levelRequirement: 1,
                    durationMs: 10000, sim: { tempo: 'fast', purpose: 'gph' },
                    inputs: [], outputs: [{ itemId: 'item_adv_orphan', chance: 100, minQty: 0, maxQty: 0 }],
                },
            ],
        },
    };
}

/** Enemies, which the store keeps outside its four persisted collections. */
function adversarialEnemies() {
    return {
        enemy_adv_wolf: {
            id: 'enemy_adv_wolf', name: 'Adv Wolf', level: 6,
            drops: [{ itemId: 'item_adv_fang', minQty: 1, maxQty: 3, chance: 50 }],
        },
    };
}

function load() {
    useEntityStore.setState({
        ...adversarialWorkspace(),
        enemies: adversarialEnemies(),
        activeEntityId: null,
        activeEntityType: null,
    });
}

/** Everything one run produced, as one comparable string. */
const snapshot = (result) => JSON.stringify({
    items: result.items,
    tokens: result.tokens,
    maps: result.maps,
    recipePools: result.recipePools,
    rows: result.sim.rows,
    values: [...result.sim.values.entries()].sort(),
    elections: [...result.sim.elections.entries()].map(([k, v]) => [k, v.sourceId, v.reason]).sort(),
    scrapValues: [...result.sim.scrapValues.entries()].sort(),
});

/**
 * The same snapshot, with the election *wording* dropped.
 *
 * ⚠️ Not a weakening. A first run elects an anchor and says why ("lowest level
 * (2) · no rarity · Recipe"); the second run finds that election stored in
 * `valueSource` and says so instead ("kept: stored election (…)"). Same source,
 * same value, different sentence — that is the sticky rule working, and it is
 * the one thing about consecutive runs that is *supposed* to differ. Every
 * number is still compared byte for byte.
 */
const settled = (result) => JSON.stringify(JSON.parse(snapshot(result)), (key, value) => (
    key === 'elections'
        ? value.map(([itemId, sourceId]) => [itemId, sourceId])
        : value
));

const rowsOf = (result, code) => result.sim.rows.filter((r) => r.code === code);

describe('⚠️ The adversarial content set — every hard case in one workspace', () => {
    beforeEach(load);
    afterEach(() => useSimulationStore.getState().clearResults());

    // ── 1. It terminates ─────────────────────────────────────────────────────

    it('runs the whole pipeline over all of it, and terminates', () => {
        const start = Date.now();
        const result = useEntityStore.getState().recalculateEconomy();
        const elapsed = Date.now() - start;

        // No iteration to diverge: a cycle beside a downcycle beside a blocked
        // chain still finishes in one pass of the walk.
        expect(elapsed).toBeLessThan(5000);
        expect(result.sim.rows.length).toBeGreaterThan(0);
    });

    it('does not throw, and still prices the healthy chain beside all of it', () => {
        const result = useEntityStore.getState().recalculateEconomy();

        // ⚠️ The load-bearing case. Every refusal below is only correct if the
        // sane content next to it is unaffected — a pass that gives up on the
        // workspace would satisfy every "it refused" assertion and be useless.
        expect(result.items.item_adv_ore.value).toBeGreaterThan(0);
        expect(result.items.item_adv_bar.value).toBeGreaterThan(0);
        expect(result.items.item_adv_ore.valueSource).toBe('token_adv_surface');
        expect(result.items.item_adv_bar.valueSource).toBe('recipe_adv_smelt');
    });

    it('gives every item either a value or a row saying why not', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const explained = new Set(result.sim.rows.filter((r) => r.itemId).map((r) => r.itemId));
        for (const itemId of Object.keys(result.items)) {
            if (result.sim.values.has(itemId)) continue;
            expect(explained.has(itemId), `${itemId} is neither priced nor explained`).toBe(true);
        }
    });

    // ── 2. It refuses each case correctly ────────────────────────────────────

    it('refuses the genuine cycle, naming both recipes in it', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const cycles = rowsOf(result, 'recipe-cycle');
        expect(cycles).toHaveLength(1);
        expect(cycles[0].severity).toBe('critical');
        expect(cycles[0].detail.cycle.sort()).toEqual(['recipe_adv_cyc_a', 'recipe_adv_cyc_b']);
        expect(result.sim.values.has('item_adv_cyc_a')).toBe(false);
    });

    it('⚠️ tells the downcycle apart from the cycle, in the same workspace', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        // The return leg points backwards at its own input's item, which is the
        // exact shape the cycle refusal hunts for. It must be exempt.
        expect(rowsOf(result, 'recipe-cycle').some((r) => r.detail.cycle?.includes('recipe_adv_recycle'))).toBe(false);
        expect(result.sim.downcycles.has('recipe_adv_recycle')).toBe(true);

        // And it is capped: what comes back is at most the recovery ratio of
        // what went in, so the loop strictly loses value and gold cannot be
        // duplicated by running it.
        const entry = result.sim.downcycles.get('recipe_adv_recycle');
        expect(entry.derivedReturn).toBeLessThanOrEqual(entry.cap + 1e-9);
        expect(entry.derivedReturn).toBeLessThan(entry.inputValue);
    });

    it('refuses the orphan, including the one whose only source can never drop', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const orphans = rowsOf(result, 'orphan-item');
        // `recipe_adv_never` lists the orphan as an output, but at 0–0 quantity
        // it produces it exactly never — so the item is an orphan, not a priced
        // thing with an imaginary supply.
        expect(orphans.map((r) => r.itemId)).toContain('item_adv_orphan');
        expect(result.sim.values.has('item_adv_orphan')).toBe(false);
        expect(result.items.item_adv_orphan.value).toBe(null);
    });

    it('refuses the Token-output recipe, and refuses to let it anchor anything', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const refusal = rowsOf(result, 'token-output-recipe');
        expect(refusal).toHaveLength(1);
        expect(refusal[0].entityId).toBe('recipe_adv_tokenout');
        expect(refusal[0].severity).toBe('critical');
        // ⚠️ The refused recipe must not become the anchor of the Token id it
        // "produces" — a refusal that still priced something would be worse
        // than no refusal.
        expect(result.sim.elections.has('token_adv_surface')).toBe(false);
        expect(result.sim.values.has('token_adv_surface')).toBe(false);
    });

    it('refuses the deferred-only item, and still mentions the passive that makes it', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        expect(rowsOf(result, 'deferred-only-item').map((r) => r.itemId)).toContain('item_adv_relic');
        // The Wind Trap wrinkle: a deferred producer never anchors, but is
        // never silently forgotten either.
        expect(rowsOf(result, 'deferred-scope-source').some((r) => r.entityId === 'token_adv_shrine')).toBe(true);
    });

    it('treats the untagged producer as "you forgot", not as broken', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        expect(rowsOf(result, 'untagged-producer').some((r) => r.entityId === 'token_adv_heap')).toBe(true);
        const only = rowsOf(result, 'untagged-only-item');
        expect(only.map((r) => r.itemId)).toContain('item_adv_scrap');
        // Info, not Critical: an untagged source is a transition state.
        expect(only[0].severity).toBe('info');
        // ⚠️ And its numbers are left exactly as typed — the simulator does not
        // guess a tag, so it does not touch what would follow from one.
        expect(result.tokens.token_adv_heap.config.cycleTimeMs).toBe(9000);
    });

    it('says nothing at all about the inert Token', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        expect(result.sim.rows.some((r) => r.entityId === 'token_adv_inert')).toBe(false);
        expect(result.sim.skipped.get('token_adv_inert')).toBe('inert');
    });

    it('tolerates the deliberately unfinished recipe', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        // No outputs is "not finished yet", which is allowed content — it is
        // inert, and inert is the silent skip.
        expect(result.sim.skipped.get('recipe_adv_unfinished')).toBe('inert');
        expect(result.sim.rows.some((r) => r.entityId === 'recipe_adv_unfinished')).toBe(false);
    });

    it('handles the extreme-tag Token without a NaN or an infinity anywhere', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const written = JSON.stringify({ items: result.items, tokens: result.tokens, maps: result.maps });
        expect(written.includes('null,null')).toBe(false);
        expect(written.toLowerCase().includes('nan')).toBe(false);
        expect(written.includes('Infinity')).toBe(false);

        // ⚠️ P7's lesson: `NaN < bound` is false, so an unguarded NaN reads as
        // PASSING. Every number the Map table prints must be finite.
        for (const report of result.sim.maps.values()) {
            if (report.skipped) continue;
            for (const key of ['level', 'cost', 'scrapSide', 'scrapBound', 'productiveSide', 'productiveBound']) {
                expect(Number.isFinite(report[key]), `${report.id}.${key} is not finite`).toBe(true);
            }
        }
    });

    it('flags the extreme Token\'s absurd lifetime rather than swallowing it', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        // 100,000 charges on a ten-minute cycle is years of work. It is not an
        // error — the check pass says so in hours and lets the author decide.
        const life = result.sim.lifetimes.get('token_adv_extreme');
        expect(life.hours).toBeGreaterThan(24);
        expect(life.unlimited).toBe(false);
    });

    // ── The Map pools ────────────────────────────────────────────────────────

    it('handles a pool with no Token in it at all', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const report = result.sim.maps.get('map_adv_tokenless');
        expect(report.skipped).toBeUndefined();
        // Slot one has no Tokens to renormalise over, so it falls back to a free
        // draw — the same thing `rollBurst` does, and it must not divide by zero.
        const total = report.entries.reduce((s, e) => s + e.expectedCount, 0);
        expect(Number.isFinite(total)).toBe(true);
        expect(total).toBeCloseTo(report.burstSize, 6);
    });

    it('refuses the gold-and-raw-item-heavy pool', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const heavy = rowsOf(result, 'map-item-heavy');
        expect(heavy.some((r) => r.entityId === 'map_adv_heavy')).toBe(true);
        // Gold and raw items count at face value and eat the budget before any
        // Token is priced, so every Token in that pool scraps for nothing.
        const report = result.sim.maps.get('map_adv_heavy');
        expect(report.overflow).toBe(true);
        const tokenEntry = report.entries.find((e) => e.kind === 'token');
        expect(tokenEntry.scrapValue).toBe(0);
    });

    it('prices the enemy entry off its drop table, one kill = one charge', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const report = result.sim.maps.get('map_adv_mixed');
        const enemy = report.entries.find((e) => e.kind === 'enemy');
        expect(enemy).toBeTruthy();
        expect(enemy.basis).toContain('one kill');
        expect(Number.isFinite(enemy.productiveValue)).toBe(true);
    });

    it('skips the guild-hall Map and the empty pool, and says which is which', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        expect(result.sim.maps.get('map_guild_hall_adv').skipped).toBe('guild-hall');
        expect(result.sim.maps.get('map_adv_empty').skipped).toBe('empty-pool');
    });

    it('derives a weight for every entry of every unskipped pool', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        for (const [id, map] of Object.entries(result.maps)) {
            const report = result.sim.maps.get(id);
            if (!report || report.skipped) continue;
            for (const entry of map.pool) expect(Number.isFinite(entry.weight)).toBe(true);
        }
    });

    // ── 3. It is idempotent ──────────────────────────────────────────────────

    it('two runs over identical input are byte-identical (plan §11)', () => {
        load();
        const first = snapshot(useEntityStore.getState().recalculateEconomy());
        load();
        const second = snapshot(useEntityStore.getState().recalculateEconomy());
        expect(second).toBe(first);
    });

    it('a second Recalculate on the settled workspace changes nothing', () => {
        const first = settled(useEntityStore.getState().recalculateEconomy());
        const second = settled(useEntityStore.getState().recalculateEconomy());
        const third = settled(useEntityStore.getState().recalculateEconomy());
        expect(second).toBe(first);
        expect(third).toBe(second);
        // And from the second run on, even the wording is stable.
        expect(snapshot(useEntityStore.getState().recalculateEconomy()))
            .toBe(snapshot(useEntityStore.getState().recalculateEconomy()));
    });

    it('the churn report claims nothing moved on the second run', () => {
        useEntityStore.getState().recalculateEconomy();
        useEntityStore.getState().recalculateEconomy();
        const churn = useSimulationStore.getState().churnReport;
        expect(churn.valuesChanged).toBe(0);
        expect(churn.refusals.new).toEqual([]);
        expect(churn.refusals.cleared).toEqual([]);
    });

    it('the sync payload is stable and carries no retired field', () => {
        const first = JSON.stringify(syncFiles(useEntityStore.getState().recalculateEconomy()));
        const second = JSON.stringify(syncFiles(useEntityStore.getState().recalculateEconomy()));
        expect(second).toBe(first);
        for (const field of ['trueCost', 'sellPrice', 'targetEV', 'calculatedEV', 'isPrimarySource']) {
            expect(first.includes(`"${field}"`), `${field} reached the payload`).toBe(false);
        }
    });

    // ── The explainability surface, over the same workspace ──────────────────

    it('has a chain trail for every priced item, and for the unpriced ones too', () => {
        useEntityStore.getState().recalculateEconomy();
        const chains = useSimulationStore.getState().simChains;

        expect(chains.item_adv_bar.sourceId).toBe('recipe_adv_smelt');
        expect(chains.item_adv_bar.upstream.map((u) => u.itemId)).toEqual(['item_adv_ore']);
        expect(chains.item_adv_bar.sentence).toContain('item_adv_bar');
        // Downstream of the ore is the bar, through the smelter.
        expect(chains.item_adv_ore.downstream.map((d) => d.itemId)).toContain('item_adv_bar');
        // The inspector does not go quiet on exactly the items a designer is
        // puzzling over.
        expect(chains.item_adv_orphan.value).toBe(null);
        expect(chains.item_adv_orphan.unpricedReason).toBeTruthy();
    });

    it('names the items stranded inside the cycle, not just the recipes', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        // Found by this file in P9: the cycle refusal is keyed by entity, so
        // before the fix an item inside a ring had no item-keyed row at all and
        // every item-centric reader came up empty on it.
        const blocked = rowsOf(result, 'blocked-chain').filter((r) => r.detail.inCycle);
        expect(blocked.map((r) => r.itemId).sort()).toEqual(['item_adv_cyc_a', 'item_adv_cyc_b']);
        expect(useSimulationStore.getState().simChains.item_adv_cyc_a.unpricedReason).toBeTruthy();
    });
});

/**
 * ⚠️ **A real non-idempotence, found by the adversarial set and pinned here.**
 *
 * `tokenType` is **derived** from a Token's own rules on the way out of every
 * Recalculate (`deriveTokenType`), and the ANCHOR pass reads `tokenType` to
 * decide which kinds can never anchor. So a record whose *authored* type
 * disagrees with what its rules say — the shape any workspace saved before the
 * derivation landed is in — is a **deferred kind on run one and an ordinary
 * producer on run two**, and the same content prices two different ways on two
 * consecutive runs.
 *
 * It converges: run two and run three agree, because by then the stored type is
 * the derived one. That is what keeps it a wrinkle rather than a hole, and it is
 * the same self-healing shape as the retired-field stripping. But "two runs are
 * byte-identical" (plan §11) is only true from the second run on, and that is
 * worth knowing rather than discovering.
 *
 * Reported to the director, not fixed here: the fix is a decision about which
 * field wins, and that is the owner's call, not a build agent's.
 */
describe('authored tokenType is corrected before the passes read it', () => {
    beforeEach(() => {
        useEntityStore.setState({
            items: { item_adv_shrine_relic: { id: 'item_adv_shrine_relic', name: 'Relic', value: null } },
            tokens: {
                // Says passive; behaves like a resource, because `passive` is
                // read off `requiresHero: false` and this one wants a hero.
                token_adv_liar: tok('token_adv_liar', 'Adv Liar', {
                    skill: 'mining', skillRequired: 4, cycleTimeMs: 30000, inputs: [],
                    outputs: [{ itemId: 'item_adv_shrine_relic', chance: 100, minQty: 1, maxQty: 1 }],
                }, { tokenType: 'passive', requiresHero: true, sim: { tempo: 'slow', purpose: 'iph' } }),
            },
            maps: {}, recipePools: {}, activeEntityId: null, activeEntityType: null,
        });
    });
    afterEach(() => useSimulationStore.getState().clearResults());

    it('prices the same on run one as on run two', () => {
        // ⚠️ This test was written the other way up. P9's adversarial set found
        // that a Token whose authored `tokenType` disagreed with its own rules
        // priced DIFFERENTLY on the first two runs: the ANCHOR pass read the
        // authored type on the way in (a passive can never anchor, so the item
        // went unpriced), while `recalculateEconomy` re-derived the type on the
        // way out — so run two saw a resource and priced it. It converged, but
        // plan §11's "two runs are byte-identical" was only true from run two
        // on, and every workspace saved before the derivation landed is in
        // exactly that shape.
        //
        // `tokenType` is derived with no override (owner decision Q3), so there
        // was never a question of which field wins. The fix was to derive it in
        // `migrateLegacyIntent`, BEFORE the passes read it — the same place and
        // for the same reason as the `isPrimarySource` → `anchor` migration.
        const first = useEntityStore.getState().recalculateEconomy();
        expect(first.tokens.token_adv_liar.tokenType).toBe('resource');
        // The lie is corrected before the anchor election, so the item is
        // priced on the very first run.
        expect(first.items.item_adv_shrine_relic.value).toBeGreaterThan(0);

        const second = useEntityStore.getState().recalculateEconomy();
        expect(JSON.stringify(second.items)).toBe(JSON.stringify(first.items));
        expect(JSON.stringify(second.tokens)).toBe(JSON.stringify(first.tokens));
    });
});
