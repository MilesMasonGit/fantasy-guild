import { describe, it, expect } from 'vitest';
import {
    buildLedger, itemKey, tokenKey, findsPerDay, FIND, STEADY_FINDS_PER_DAY, LEDGER_ENGINE_TEXT,
} from '../systems/progression/ledger/engine.js';
import { runChecks } from '../../cms/src/engine/ledger/checks.js';
import { buildPace, boostTargetAt } from '../../cms/src/engine/ledger/pace.js';
import { settingsOf, DEFAULT_LEDGER_SETTINGS } from '../../cms/src/engine/ledger/settings.js';
import { PROFILE } from '../../cms/src/engine/ledger/profiles.js';
import { proposeBalance } from '../../cms/src/engine/ledger/balance.js';
import { paceContent } from './fixtures/paceWorld.js';

/**
 * Rare finds judged by finds a day (owner, 2026-11-07): a very low rate on repeatable work is a
 * steady source (0.1 % on a 10 s cycle is about 8.6 a day); under the ledger's threshold it is rare
 * but steady; only a source that wears out stays luck. Rare-find boosts have their own strength
 * targets (a potion x2 to x3, a building x1.5), measured on the finds, apart from the consumables' +20 %.
 */

const item = (id, name = id) => ({ id, name, type: 'material' });
const work = (cycleTimeMs, outputs) => ({ skill: 'mining', skillRequired: 1, cycleTimeMs, xp: 1, inputs: [], outputs });
const out = (itemId, chance = 100) => ({ itemId, chance, minQty: 1, maxQty: 1 });

/** A camp of three Tokens that each find a Gem only rarely: steady, rare but steady, and wearing out. */
function rareWorld() {
    return {
        items: {
            rf_stone: item('rf_stone', 'Stone'), rf_gem: item('rf_gem', 'Gem'), rf_pearl: item('rf_pearl', 'Pearl'),
            rf_amber: item('rf_amber', 'Amber'), rf_opal: item('rf_opal', 'Opal'),
        },
        tokens: {
            // 0.1 % on a 10 s cycle, worked all day: 8,640 cycles, about 8.6 Gems.
            rf_quarry: { id: 'rf_quarry', name: 'Quarry', uses: null, config: work(10000, [out('rf_stone'), out('rf_gem', 0.1)]) },
            // 0.001 % on a 10 s cycle: about 1 in 12 days, repeatable all the same.
            rf_bed: { id: 'rf_bed', name: 'Oyster Bed', uses: null, config: work(10000, [out('rf_stone'), out('rf_pearl', 0.001)]) },
            // Three charges and nothing brings it back: a 2 % Amber is luck.
            rf_cache: { id: 'rf_cache', name: 'Old Cache', uses: 3, config: work(10000, [out('rf_stone'), out('rf_amber', 2)]) },
            // A rare drop table: 0.2 % a cycle, all Opal, on a 10 s cycle: about 17 a day.
            rf_geode: {
                id: 'rf_geode', name: 'Geode', uses: null, config: work(10000, [out('rf_stone')]),
                rareTable: { chance: 0.2, entries: [{ itemId: 'rf_opal', weight: 1, minQty: 1, maxQty: 1 }] },
            },
        },
        recipes: [],
        effects: {},
        starterCamp: { tokens: ['rf_quarry', 'rf_bed', 'rf_cache', 'rf_geode'].map((typeId, i) => ({ typeId, x: i * 100, y: 0 })), bank: {} },
    };
}

describe('rare finds by finds a day', () => {
    it('0.1 % on a 10 s cycle is a steady source: about 8.6 a day', () => {
        const l = buildLedger(rareWorld());
        const gem = l.reachOf(itemKey('rf_gem'));
        expect(gem).toMatchObject({ tier: 0, sureTier: 0, luckOnly: false, rareOnly: false, via: tokenKey('rf_quarry') });
        expect(gem.findsPerDay).toBeCloseTo(8.64, 6);
        expect(l.findClass(gem.rule, gem.rule.gives.find((g) => g.key === itemKey('rf_gem')))).toBe(FIND.STEADY);
        expect(LEDGER_ENGINE_TEXT.perDay(gem.findsPerDay)).toBe('about 8.6 a day');
    });

    it('under the threshold, repeatable work is rare but steady, never luck', () => {
        const pearl = buildLedger(rareWorld()).reachOf(itemKey('rf_pearl'));
        expect(pearl).toMatchObject({ tier: 0, sureTier: null, luckOnly: false, rareOnly: true });
        expect(pearl.findsPerDay).toBeCloseTo(0.0864, 6);
        // The threshold is the ledger's setting: at 0.05 a day the Pearl is steady.
        expect(buildLedger(rareWorld(), { steadyPerDay: 0.05 }).reachOf(itemKey('rf_pearl'))).toMatchObject({ rareOnly: false, sureTier: 0 });
    });

    it('a source that wears out stays luck under 5 %', () => {
        const amber = buildLedger(rareWorld()).reachOf(itemKey('rf_amber'));
        // 2 % on 10 s would be 172 a day on repeatable work, but three charges are all there is.
        expect(amber).toMatchObject({ tier: 0, sureTier: null, luckOnly: true, rareOnly: false, via: tokenKey('rf_cache') });
        expect(buildLedger(rareWorld()).world.rules.find((r) => r.id === 'work:rf_cache').repeatable).toBe(false);
    });

    it('a rare drop table is a source like a chance line, judged the same way', () => {
        const l = buildLedger(rareWorld());
        const geode = l.world.rules.find((r) => r.id === 'work:rf_geode');
        expect(geode.gives.map((g) => g.key)).toContain(itemKey('rf_opal'));
        const opal = l.reachOf(itemKey('rf_opal'));
        expect(opal).toMatchObject({ tier: 0, sureTier: 0, luckOnly: false, rareOnly: false, via: tokenKey('rf_geode') });
        expect(opal.findsPerDay).toBeCloseTo(17.28, 6);
        // Slowed a hundredfold it is rare but steady, not luck.
        const slow = rareWorld();
        slow.tokens.rf_geode.rareTable.chance = 0.002;
        expect(buildLedger(slow).reachOf(itemKey('rf_opal'))).toMatchObject({ luckOnly: false, rareOnly: true });
    });

    it('an enemy rolls its finds once a fight: its fight time is its roll', () => {
        const w = rareWorld();
        w.tokens.rf_rat = { id: 'rf_rat', name: 'Rat', enemy: { level: 1, style: 'melee' }, config: { ...work(12000, [out('rf_stone')]), skill: '' }, rareTable: { chance: 0.014, entries: [{ itemId: 'rf_gem', weight: 1, minQty: 1, maxQty: 1 }] } };
        const drop = buildLedger(w).world.rules.find((r) => r.id === 'drop:rf_rat');
        // The owner's rare gear drop: 0.014 % on 12 s fights is about 1 a day.
        expect(drop.cycleMs).toBeNull();
        expect(findsPerDay(drop, drop.gives.find((g) => g.key === itemKey('rf_gem')))).toBeCloseTo(1.008, 6);
    });

    it('the checks: rare but steady is a note with its finds a day; luck from a source that wears out is a Warn', () => {
        const findings = runChecks(buildLedger(rareWorld()), rareWorld());
        const of = (id, check) => findings.filter((f) => f.key === itemKey(id) && f.check === check);
        expect(of('rf_gem', 'luck-only')).toHaveLength(0);
        expect(of('rf_gem', 'rare-steady')).toHaveLength(0);
        expect(of('rf_opal', 'luck-only')).toHaveLength(0);
        expect(of('rf_pearl', 'luck-only')).toHaveLength(0);
        expect(of('rf_pearl', 'rare-steady')[0]).toMatchObject({ severity: 'info' });
        expect(of('rf_pearl', 'rare-steady')[0].message).toBe('Rare but steady at Starter Camp: 0.001%, about 1 in 12 days from Oyster Bed, for one hero working all day; no steady way.');
        expect(of('rf_amber', 'luck-only')[0]).toMatchObject({ severity: 'warn' });
        expect(of('rf_amber', 'luck-only')[0].message).toBe('Only ever by luck: 2% from Old Cache, and no sure way.');
    });

    it('the threshold is a Ledger setting, 1 a day by default, as the engine', () => {
        expect(STEADY_FINDS_PER_DAY).toBe(1);
        expect(DEFAULT_LEDGER_SETTINGS.steadyFindsPerDay).toBe(STEADY_FINDS_PER_DAY);
        expect(settingsOf({}).steadyFindsPerDay).toBe(1);
        expect(settingsOf({ steadyFindsPerDay: 3 }).steadyFindsPerDay).toBe(3);
        expect(settingsOf({ steadyFindsPerDay: -1 }).steadyFindsPerDay).toBe(1);
    });
});

/** The pace fixture with a 1 % Gem table on the vein, a Luck Potion (+100 % finds) and a Lucky Charm building (+50 %). */
function luckyPace() {
    const c = paceContent();
    c.items.item_gem = { id: 'item_gem', name: 'Gem', type: 'material', plan: { tier: 0 } };
    c.tokens.token_vein.rareTable = { chance: 1, entries: [{ itemId: 'item_gem', weight: 1, minQty: 1, maxQty: 1 }] };
    const lucky = (id, value) => ({ id: `stm_${id}`, keyword: 'provides', to: { mode: 'all', value: '' }, reach: 'nearby', payload: { type: 'LUCKY', bucket: 'percentage', value } });
    c.effects.pw_fx_lucky = { id: 'pw_fx_lucky', name: 'Lucky', statements: [lucky('pw_lucky', 1)] };
    c.effects.pw_fx_luck_potion = {
        id: 'pw_fx_luck_potion', name: 'Luck Potion drink',
        statements: [{ id: 'stm_pw_luck_potion', keyword: 'applies', to: { mode: 'all', value: '' }, target: { role: 'actor' }, when: { event: 'WORK_START', scope: 'self' }, payload: { effectId: 'pw_fx_lucky', scale: 1, durationMs: 0, forCycle: true, chance: 100 } }],
    };
    c.items.item_luck_potion = { id: 'item_luck_potion', name: 'Luck Potion', type: 'potion', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'pw_fx_luck_potion', scale: 1 }], plan: { tier: 0 } };
    c.recipes.push({ id: 'recipe_luck_potion', name: 'Luck Potion', skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 10000, xp: 1, inputs: [{ itemId: 'item_oak_wood', quantity: 1 }], outputs: [out('item_luck_potion')] });
    c.tokens.token_charm = {
        id: 'token_charm', name: 'Lucky Charm', tokenType: 'buff', uses: null, requiresHero: false, config: null,
        statements: [{ id: 'stm_pw_charm', keyword: 'provides', to: { mode: 'id', value: 'token_vein' }, reach: 'nearby', payload: { type: 'LUCKY', bucket: 'percentage', value: 0.5 } }],
    };
    c.recipes.push({ id: 'recipe_build_charm', name: 'Build Lucky Charm', skill: 'construction', levelRequirement: 1, xp: 5, durationMs: 30000, foundationKinds: ['wood'], inputs: [{ itemId: 'item_oak_wood', quantity: 5 }], outputs: [{ tokenId: 'token_charm', chance: 100, minQty: 1, maxQty: 1 }] });
    return c;
}

describe('rare-find boosts have their own strength targets', () => {
    const rowsOf = (content, settings = null) => buildPace(content, buildLedger(content), settings).boostRows()
        .filter((r) => r.work.target.token === 'token_vein' && !r.work.target.recipe);

    it('a rare-find potion and building are their own kinds, against x2 and x1.5; a plain drink keeps the +20 %', () => {
        const rows = rowsOf(luckyPace());
        const potion = rows.find((r) => r.kind === 'rareConsumable');
        const charm = rows.find((r) => r.kind === 'rareSupport');
        const beer = rows.find((r) => r.kind === 'consumable');
        expect(potion).toMatchObject({ names: ['Luck Potion'], target: 100 });
        expect(charm).toMatchObject({ names: ['Lucky Charm'], target: 50 });
        // Measured on the finds: +100 % and +50 % Gems, not their slice of the vein's whole worth.
        expect(potion.gain).toBeCloseTo(1, 6);
        expect(charm.gain).toBeCloseTo(0.5, 6);
        expect(beer).toMatchObject({ names: ['Beer'], target: 20 });
        // Neither is counted among the plain consumables or buildings.
        expect(rows.filter((r) => r.kind === 'consumable').flatMap((r) => r.names)).not.toContain('Luck Potion');
        expect(rows.filter((r) => r.kind === 'support').flatMap((r) => r.names)).not.toContain('Lucky Charm');
    });

    it('at their targets they are no problem and the balancer leaves them alone', () => {
        const content = luckyPace();
        const findings = buildPace(content, buildLedger(content), null).findings().filter((f) => f.check === 'boost-target');
        expect(findings.map((f) => f.key)).not.toContain('item:item_luck_potion');
        expect(findings.map((f) => f.key)).not.toContain('token:token_charm');
        const proposals = proposeBalance(content, null).proposals.filter((p) => p.lever === 'boost');
        expect(proposals.map((p) => p.id)).not.toContain('pw_fx_lucky');
        expect(proposals.map((p) => p.id)).not.toContain('token_charm');
    });

    it('measured against the consumables\' +20 % instead, the potion would be over', () => {
        const settings = { boostTargets: { rareConsumable: [{ tier: 0, pct: 20 }] } };
        const potion = rowsOf(luckyPace(), settings).find((r) => r.kind === 'rareConsumable');
        expect(potion.target).toBe(20);
        const content = luckyPace();
        const over = buildPace(content, buildLedger(content), settings).findings().filter((f) => f.check === 'boost-target');
        expect(over.map((f) => f.key)).toContain('item:item_luck_potion');
    });

    it('the targets are Ledger settings: x2 rising to x3 late for potions, x1.5 for buildings, filled in for older saved settings', () => {
        const saved = settingsOf({ boostTargets: { consumable: [{ tier: 0, pct: 20 }] } });
        expect(saved.boostTargets.rareConsumable).toEqual([{ tier: 0, pct: 100 }, { tier: 6, pct: 200 }]);
        expect(saved.boostTargets.rareSupport).toEqual([{ tier: 0, pct: 50 }]);
        expect(boostTargetAt(saved, 'rareConsumable', 1)).toBe(100);
        expect(boostTargetAt(saved, 'rareConsumable', 4)).toBe(200);
        expect(boostTargetAt(saved, 'rareSupport', 3)).toBe(50);
        expect(boostTargetAt(saved, 'consumable', 4)).toBe(20);
        // A kind the owner emptied stays empty.
        expect(settingsOf({ boostTargets: { rareSupport: [] } }).boostTargets.rareSupport).toBeUndefined();
        expect(PROFILE.MAXED).toBe('maxed');
    });
});

