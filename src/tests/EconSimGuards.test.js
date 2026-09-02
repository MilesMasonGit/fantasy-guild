/**
 * Economic simulator — the check pass (phase P9).
 *
 * Three things this covers:
 *
 * 1. **The progression guard** (plan §13.5, correction F1) — the one refusal
 *    aimed at the developer's dials. Ten levels of progress must be worth more
 *    than the spread inside one level, or a player can level up and earn less.
 * 2. **Hours-first charge scale** (CMS-135) — the lifetime translation and its
 *    two soft outlier heuristics.
 * 3. **Sticky-anchor re-election** (plan §3.2) — the one click that accepts a
 *    new anchor, and the churn it is required to report.
 *
 * ⚠️ Every case here is a fixture. Nothing names a shipped Token, item, recipe
 * or Map id: the owner authors continuously, and a test that names content
 * breaks when they do.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
    progressionGuardFindings, progressionGuardRows, runCheckPass, lifetimeOf, formatHours,
    CURVE_FLATTENS_AT, GUARD_STRIDE, LONG_LIFETIME_HOURS, SHORT_LIFETIME_HOURS,
} from '../../cms/src/engine/sim/checkPass';
import { DEFAULT_DIALS, normaliseDials, gphAt, toleranceFor } from '../../cms/src/engine/sim/dials';
import { adaptCorpus } from '../../cms/src/engine/sim/fieldAdapter';
import { runSim } from '../../cms/src/engine/sim/simRunner';
import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';

// ── The progression guard ────────────────────────────────────────────────────

describe('The progression guard (§13.5, F1)', () => {
    it('verifies the plan\'s two worked numbers against the shipped curve', () => {
        // §13.5: "anchors at level 10 top out at ~2,875 while anchors at 20
        // bottom at ~4,040 — clean."
        const ceiling10 = gphAt(10, DEFAULT_DIALS) * (1 + toleranceFor(10, DEFAULT_DIALS));
        const floor20 = gphAt(20, DEFAULT_DIALS) * (1 - toleranceFor(20, DEFAULT_DIALS));
        expect(Math.round(ceiling10)).toBe(2875);
        expect(Math.round(floor20)).toBe(4038);
        expect(ceiling10).toBeLessThan(floor20);

        // And F1's correction: the DOUBLED non-anchor band does overlap there.
        // The guard checks anchor bands only precisely because of this.
        const nonAnchorCeiling10 = gphAt(10, DEFAULT_DIALS) * (1 + toleranceFor(10, DEFAULT_DIALS, { isAnchor: false }));
        const nonAnchorFloor20 = gphAt(20, DEFAULT_DIALS) * (1 - toleranceFor(20, DEFAULT_DIALS, { isAnchor: false }));
        expect(Math.round(nonAnchorCeiling10)).toBe(3450);
        expect(Math.round(nonAnchorFloor20)).toBe(3325);
        expect(nonAnchorCeiling10).toBeGreaterThan(nonAnchorFloor20);
    });

    it('⚠️ finds the plan\'s claim untrue in the flattened tail, and does not refuse it', () => {
        // Found in P9 and NOT in the plan: above level 70 the earn curve
        // deliberately flattens to ~2%/level, and ten levels of that (×1.219)
        // does not clear a ±10% band (which needs ×1.223). So the shipped
        // defaults DO break the stated ordering at the top — by a fraction of a
        // percent, with no dial turned wrongly.
        const { refusable, tail } = progressionGuardFindings(DEFAULT_DIALS);
        expect(tail.length).toBeGreaterThan(0);
        for (const v of tail) expect(v.upper).toBeGreaterThan(CURVE_FLATTENS_AT);
        // The part of the curve that is still compounding is clean, which is
        // what makes naming the tail defensible rather than a shrug.
        expect(refusable).toEqual([]);
    });

    it('does not refuse the shipped dial set', () => {
        const rows = progressionGuardRows(DEFAULT_DIALS);
        expect(rows.filter((r) => r.code === 'progression-guard')).toEqual([]);
        // It says so out loud rather than staying quiet about it.
        expect(rows.filter((r) => r.code === 'progression-guard-tail')).toHaveLength(1);
        expect(rows[0].severity).toBe('info');
    });

    it('refuses a band width wide enough to swallow ten levels of progress', () => {
        const dials = normaliseDials({
            toleranceBrackets: [{ maxLevel: Infinity, band: 0.5 }],
        });
        const rows = progressionGuardRows(dials);
        const refusal = rows.find((r) => r.code === 'progression-guard');
        expect(refusal).toBeTruthy();
        expect(refusal.severity).toBe('critical');
        // Every remedy names a dial: no Token caused this and re-tagging one
        // cannot clear it.
        expect(refusal.remedies.length).toBeGreaterThan(0);
        expect(refusal.detail.pairs).toBeGreaterThan(0);
    });

    it('refuses an earn curve flattened everywhere, even at the default bands', () => {
        const flat = Object.fromEntries(Object.keys(DEFAULT_DIALS.gphPins).map((l) => [l, 1000]));
        const rows = progressionGuardRows(normaliseDials({ gphPins: flat }));
        expect(rows.some((r) => r.code === 'progression-guard')).toBe(true);
    });

    it('is stated over ten levels, and compares a ceiling with a floor', () => {
        expect(GUARD_STRIDE).toBe(10);
        const { violations } = progressionGuardFindings(normaliseDials({
            toleranceBrackets: [{ maxLevel: Infinity, band: 0.5 }],
        }));
        for (const v of violations) {
            expect(v.upper - v.level).toBe(GUARD_STRIDE);
            expect(v.ceiling).toBeGreaterThanOrEqual(v.floor);
        }
    });

    it('reaches the audit rows of a real run', () => {
        const result = runSim({
            tokens: {}, recipes: {}, items: {}, maps: {},
        }, { toleranceBrackets: [{ maxLevel: Infinity, band: 0.5 }] });
        expect(result.rows.some((r) => r.code === 'progression-guard')).toBe(true);
    });
});

// ── Hours-first charge display (CMS-135) ─────────────────────────────────────

/** One Token, with the fields the adapter reads. */
function token({ id, uses, cycleTimeMs = 10000, rarity = 'common', tempo = 'fast' }) {
    return {
        id, name: id, rarity, tokenType: 'resource', uses,
        sim: { tempo, purpose: 'gph' },
        config: {
            skill: 'woodcutting', skillRequired: 1, cycleTimeMs,
            inputs: [],
            outputs: [{ itemId: `${id}_out`, chance: 100, minQty: 1, maxQty: 1 }],
        },
    };
}

describe('Hours-first charge display (CMS-135)', () => {
    const check = (tokens, cycleTimes) => runCheckPass(
        adaptCorpus({ tokens, recipes: {} }),
        { cycleTimes: new Map(Object.entries(cycleTimes)), tokens, dials: DEFAULT_DIALS },
    );

    it('turns charges into hours through the settled cycle, not the authored one', () => {
        const entity = adaptCorpus({ tokens: { t: token({ id: 't', uses: 100 }) } })[0];
        // 100 charges at a 36s cycle, before the level-1 speed ramp, is ~1h.
        const life = lifetimeOf(entity, { cycleTimeMs: 36000, dials: DEFAULT_DIALS });
        expect(life.hours).toBeCloseTo(100 / ((3600 / 36) * 1.005), 5);
        expect(life.charges).toBe(100);
        expect(life.unlimited).toBe(false);
    });

    it('⚠️ reads `uses` and never `charges` (S6)', () => {
        const def = { ...token({ id: 't', uses: 25 }), charges: 500 };
        const entity = adaptCorpus({ tokens: { t: def } })[0];
        const life = lifetimeOf(entity, { cycleTimeMs: 10000, dials: DEFAULT_DIALS });
        const withUses = lifetimeOf(
            adaptCorpus({ tokens: { t: token({ id: 't', uses: 25 }) } })[0],
            { cycleTimeMs: 10000, dials: DEFAULT_DIALS },
        );
        expect(life.hours).toBe(withUses.hours);
    });

    it('reports the assumed-lifetime dial for a Token that never runs out', () => {
        const entity = adaptCorpus({ tokens: { t: token({ id: 't', uses: null }) } })[0];
        const life = lifetimeOf(entity, { cycleTimeMs: 10000, dials: DEFAULT_DIALS });
        expect(life.unlimited).toBe(true);
        expect(life.assumed).toBe(true);
        expect(life.hours).toBe(DEFAULT_DIALS.unlimitedLifetimeHours);
    });

    it('flags a Common living over about a day', () => {
        const long = token({ id: 't_long', uses: 100000, rarity: 'common' });
        const { rows, lifetimes } = check({ t_long: long }, { t_long: 10000 });
        expect(lifetimes.get('t_long').hours).toBeGreaterThan(LONG_LIFETIME_HOURS);
        expect(rows.some((r) => r.code === 'charge-lifetime-long' && r.entityId === 't_long')).toBe(true);
    });

    it('does not flag the same lifetime on a rarer Token', () => {
        const rare = token({ id: 't_rare', uses: 100000, rarity: 'rare' });
        const { rows } = check({ t_rare: rare }, { t_rare: 10000 });
        expect(rows.some((r) => r.code === 'charge-lifetime-long')).toBe(false);
    });

    it('flags any Token spent in under about ten minutes', () => {
        const short = token({ id: 't_short', uses: 1, rarity: 'mythic' });
        const { rows, lifetimes } = check({ t_short: short }, { t_short: 10000 });
        expect(lifetimes.get('t_short').hours).toBeLessThan(SHORT_LIFETIME_HOURS);
        expect(rows.some((r) => r.code === 'charge-lifetime-short' && r.entityId === 't_short')).toBe(true);
    });

    it('says nothing about a Token in the ordinary middle', () => {
        const ok = token({ id: 't_ok', uses: 500 });
        const { rows } = check({ t_ok: ok }, { t_ok: 10000 });
        expect(rows.some((r) => r.code.startsWith('charge-lifetime'))).toBe(false);
    });

    it('every outlier row is Info, and every remedy names a tag or a dial', () => {
        const { rows } = check(
            { t_long: token({ id: 't_long', uses: 100000 }), t_short: token({ id: 't_short', uses: 1 }) },
            { t_long: 10000, t_short: 10000 },
        );
        const outliers = rows.filter((r) => r.code.startsWith('charge-lifetime'));
        expect(outliers.length).toBe(2);
        for (const row of outliers) {
            expect(row.severity).toBe('info');
            expect(row.remedies.length).toBeGreaterThan(0);
            // Never "set it to 42": a remedy is an instruction in the
            // designer's vocabulary.
            for (const remedy of row.remedies) expect(/\d/.test(remedy)).toBe(false);
        }
    });

    it('prints hours the way a person would say them', () => {
        expect(formatHours(3.14)).toBe('3.1h');
        expect(formatHours(0.1)).toBe('6 min');
        expect(formatHours(41.6)).toBe('42h');
        expect(formatHours(NaN)).toBe('unknown');
    });
});

// ── Sticky-anchor re-election (§3.2) ─────────────────────────────────────────

/**
 * Two sources for one item: a level-5 Token and a level-1 Token. The rule
 * elects the lower level, so the level-1 source is the natural winner — and a
 * stored election naming the level-5 one is what makes the row appear.
 */
function twoSourceWorkspace(storedAnchor) {
    return {
        items: {
            item_fixture_ore: { id: 'item_fixture_ore', name: 'Ore', value: null, valueSource: storedAnchor ?? null },
            item_fixture_bar: { id: 'item_fixture_bar', name: 'Bar', value: null },
        },
        tokens: {
            token_fixture_deep: {
                id: 'token_fixture_deep', name: 'Deep Seam', rarity: 'common', tokenType: 'resource', uses: 40,
                sim: { tempo: 'medium', purpose: 'gph' },
                config: {
                    skill: 'mining', skillRequired: 5, cycleTimeMs: 20000, inputs: [],
                    outputs: [{ itemId: 'item_fixture_ore', chance: 100, minQty: 1, maxQty: 1 }],
                },
            },
            token_fixture_surface: {
                id: 'token_fixture_surface', name: 'Surface Seam', rarity: 'common', tokenType: 'resource', uses: 40,
                sim: { tempo: 'fast', purpose: 'gph' },
                config: {
                    skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, inputs: [],
                    outputs: [{ itemId: 'item_fixture_ore', chance: 100, minQty: 1, maxQty: 1 }],
                },
            },
        },
        maps: {},
        recipePools: {
            smithing: [{
                id: 'recipe_fixture_bar', name: 'Bar', skill: 'smithing', levelRequirement: 1,
                durationMs: 15000, sim: { tempo: 'medium', purpose: 'gph' },
                inputs: [{ itemId: 'item_fixture_ore', quantity: 2 }],
                outputs: [{ itemId: 'item_fixture_bar', chance: 100, minQty: 1, maxQty: 1 }],
            }],
        },
    };
}

const load = (workspace) => useEntityStore.setState({ ...workspace, activeEntityId: null, activeEntityType: null });

describe('Sticky-anchor re-election (§3.2)', () => {
    beforeEach(() => useSimulationStore.getState().clearResults());
    afterEach(() => useSimulationStore.getState().clearResults());

    it('keeps a stored election that a newer source now out-ranks, and says so', () => {
        load(twoSourceWorkspace('token_fixture_deep'));
        const { items, sim } = useEntityStore.getState().recalculateEconomy();

        expect(items.item_fixture_ore.valueSource).toBe('token_fixture_deep');
        const row = sim.rows.find((r) => r.code === 'anchor-candidate-changed');
        expect(row).toBeTruthy();
        expect(row.detail.kept).toBe('token_fixture_deep');
        expect(row.detail.wouldElect).toBe('token_fixture_surface');
    });

    it('re-elects through the normal write path, and the row clears', () => {
        load(twoSourceWorkspace('token_fixture_deep'));
        useEntityStore.getState().recalculateEconomy();

        const churn = useEntityStore.getState().reElectAnchor(
            'item_fixture_ore', 'token_fixture_surface', {},
        );

        const state = useEntityStore.getState();
        expect(state.items.item_fixture_ore.valueSource).toBe('token_fixture_surface');
        // ⚠️ The new election landed in `valueSource` like any other, which is
        // what makes the NEXT run sticky on it rather than asking again.
        const after = state.recalculateEconomy();
        expect(after.sim.rows.some((r) => r.code === 'anchor-candidate-changed')).toBe(false);
        expect(after.items.item_fixture_ore.valueSource).toBe('token_fixture_surface');
        expect(churn).toBeTruthy();
    });

    it('reports the churn the acceptance caused', () => {
        load(twoSourceWorkspace('token_fixture_deep'));
        useEntityStore.getState().recalculateEconomy();
        const before = useEntityStore.getState().items.item_fixture_ore.value;

        const churn = useEntityStore.getState().reElectAnchor(
            'item_fixture_ore', 'token_fixture_surface', {},
        );
        const after = useEntityStore.getState().items.item_fixture_ore.value;

        // The whole reason the election is sticky is that accepting it re-prices
        // a chain, so the click has to say what it moved.
        expect(after).not.toBe(before);
        expect(churn.valuesChanged).toBeGreaterThan(0);
        expect(churn.largestMovers.some((m) => m.itemId === 'item_fixture_ore')).toBe(true);
    });

    it('re-prices downstream of the item, not only the item', () => {
        load(twoSourceWorkspace('token_fixture_deep'));
        const first = useEntityStore.getState().recalculateEconomy();
        const barBefore = first.items.item_fixture_bar.value;

        useEntityStore.getState().reElectAnchor('item_fixture_ore', 'token_fixture_surface', {});
        const barAfter = useEntityStore.getState().items.item_fixture_bar.value;
        expect(barAfter).not.toBe(barBefore);
    });

    it('does nothing for an item the workspace does not hold', () => {
        load(twoSourceWorkspace('token_fixture_deep'));
        useEntityStore.getState().recalculateEconomy();
        expect(useEntityStore.getState().reElectAnchor('item_not_here', 'token_fixture_surface', {})).toBe(null);
    });

    it('no stored election means no prompt — a first run just elects', () => {
        load(twoSourceWorkspace(null));
        const { items, sim } = useEntityStore.getState().recalculateEconomy();
        expect(sim.rows.some((r) => r.code === 'anchor-candidate-changed')).toBe(false);
        expect(items.item_fixture_ore.valueSource).toBe('token_fixture_surface');
    });
});
