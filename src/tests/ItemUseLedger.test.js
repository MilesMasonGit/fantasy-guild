import { describe, it, expect } from 'vitest';
import { buildLedger, buildWorld, computeReach, describePath, HOW, itemKey, recipeKey, tokenKey, LEDGER_ENGINE_TEXT } from '../systems/progression/ledger/engine.js';
import { itemUseSourceId } from '../config/registries/itemUse.js';
import { runChecks } from '../../cms/src/engine/ledger/checks.js';
import { economyFindings } from '../../cms/src/engine/ledger/economy.js';
import { buildPace } from '../../cms/src/engine/ledger/pace.js';
import { PROFILE } from '../../cms/src/engine/ledger/profiles.js';
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor.js';
import { sourcesOf as pageSourcesOf } from '../../cms/src/engine/ledgerPage.js';
import { buildEncyclopedia } from '../ui/components/encyclopedia/encyclopediaModel.js';
import { waysIn, waysOut, wayInWord, wayOutWord, wayInRequirement } from '../ui/components/encyclopedia/encyclopediaChart.js';
import { setHallSky } from '../config/guildUpgrades.js';
import { withRequiredThree } from './fixtures/hallSky.js';
import { ledgerContent } from './fixtures/ledgerWorld.js';
import en from '../i18n/en.json';

/**
 * ⭐ The ledger reads an item's Use as a source (brief 400 B4): the Bird Nest's seeds stay reachable
 * when the Use is their only way in, the CMS's checks, economy, pace and audit agree, and the
 * Encyclopedia shows using the Nest as a way to get them.
 *
 * The fixture world's Oak Trees drop a Bird Nest half the time; its Use gives 1 to 2 Potato Seeds
 * every time and a Gem Seed one time in four. A Potato Seed's crop gives seeds back, a loop with no
 * way in but the Nest; nothing else makes a Gem Seed.
 */

setHallSky(withRequiredThree());

const NEST_USE = {
    drops: [
        { itemId: 'item_potato_seed', chance: 100, minQty: 1, maxQty: 2 },
        { itemId: 'item_gem_seed', chance: 25, minQty: 1, maxQty: 1 }
    ]
};

const content = ({ use = true } = {}) => {
    const c = ledgerContent();
    c.tokens.token_oak_tree.config.outputs.push({ itemId: 'item_bird_nest', chance: 50, minQty: 1, maxQty: 1 });
    if (use) c.items.item_bird_nest.use = structuredClone(NEST_USE);
    c.items.item_potato_seed = { id: 'item_potato_seed', name: 'Potato Seed', type: 'material' };
    c.items.item_potato = { id: 'item_potato', name: 'Potato', type: 'food' };
    c.items.item_gem_seed = { id: 'item_gem_seed', name: 'Gem Seed', type: 'material' };
    c.recipePools.farming.push({
        id: 'recipe_potato', name: 'Potato', skill: 'farming', levelRequirement: 1, durationMs: 10000, stationKinds: ['field'],
        crop: { growMs: 60000, load: 10 }, inputs: [{ itemId: 'item_potato_seed', quantity: 1 }],
        outputs: [{ itemId: 'item_potato', chance: 100, minQty: 1, maxQty: 2 }, { itemId: 'item_potato_seed', chance: 40, minQty: 1, maxQty: 1 }]
    });
    return c;
};

const I = itemKey;

describe('the reach engine reads a Use', () => {
    it('one rule an item with a Use: the copy spent, each drop at its chance and amount, no hero and no time', () => {
        const world = buildWorld(content());
        const rule = world.rules.find(r => r.how === HOW.USE);
        expect(rule).toMatchObject({
            id: 'use:item_bird_nest', via: I('item_bird_nest'), needs: [I('item_bird_nest')],
            inputs: [{ key: I('item_bird_nest'), quantity: 1 }], cycleMs: 0, gates: [], tool: null, repeatable: true
        });
        expect(rule.gives).toEqual([
            { key: I('item_potato_seed'), chance: 1, perCycle: 1.5, min: 1, max: 2 },
            { key: I('item_gem_seed'), chance: 0.25, perCycle: 0.25, min: 1, max: 1 }
        ]);
        expect(LEDGER_ENGINE_TEXT.how[HOW.USE]).toBe('used from the Bank');
        // An item with no Use has none.
        expect(buildWorld(content({ use: false })).rules.some(r => r.how === HOW.USE)).toBe(false);
    });

    it('a seed whose only way in is the Use is reachable through it, and what it grows with it', () => {
        const reach = computeReach(buildWorld(content()));
        expect(reach.get(I('item_potato_seed'))).toMatchObject({ tier: 0, how: HOW.USE, via: I('item_bird_nest'), luckOnly: false });
        expect(reach.get(I('item_gem_seed'))).toMatchObject({ tier: 0, how: HOW.USE, via: I('item_bird_nest'), luckOnly: false });
        expect(reach.get(recipeKey('recipe_potato')).tier).toBe(0);
        expect(reach.get(I('item_potato')).tier).toBe(0);
        expect(describePath(reach, I('item_potato_seed'))).toMatch(/^Potato Seed ← Bird Nest ← Oak Tree/);
    });

    it('without the Use they read as never reached: the guard', () => {
        const reach = computeReach(buildWorld(content({ use: false })));
        expect(reach.get(I('item_potato_seed')).tier).toBeNull();
        expect(reach.get(I('item_gem_seed')).tier).toBeNull();
        expect(reach.get(I('item_potato')).tier).toBeNull();
    });

    it('a tree follows the Use: the seed costs the Nest\'s effort over what one Nest gives, and the Use adds none', () => {
        const ledger = buildLedger(content());
        const seed = ledger.treeOf('item_potato_seed').tree;
        expect(seed.source).toMatchObject({ how: HOW.USE, via: I('item_bird_nest'), cycleMs: 0, perCycle: 1.5 });
        expect(seed.children).toHaveLength(1);
        expect(seed.children[0]).toMatchObject({ key: I('item_bird_nest') });
        expect(seed.children[0].quantity).toBeCloseTo(1 / 1.5, 9);
        const nest = ledger.treeOf('item_bird_nest').tree;
        expect(seed.effortMs).toBeCloseTo(nest.effortMs / 1.5, 6);
        expect(seed.unknown).toBe(false);
    });
});

describe('the CMS ledger agrees', () => {
    it('no check calls the seeds unreachable, nor the Nest unused: its Use spends it', () => {
        const c = content();
        const findings = runChecks(buildLedger(c), c);
        const on = (id) => findings.filter(f => f.key === I(id)).map(f => f.check);
        expect(on('item_potato_seed')).not.toEqual(expect.arrayContaining(['never-reachable']));
        expect(on('item_gem_seed')).not.toContain('never-reachable');
        expect(on('item_bird_nest')).not.toContain('unused');
        // The guard: with no Use, nothing spends the Nest and nothing reaches the seeds.
        const bare = content({ use: false });
        const before = runChecks(buildLedger(bare), bare);
        expect(before.some(f => f.key === I('item_bird_nest') && f.check === 'unused')).toBe(true);
        expect(before.some(f => f.key === I('item_gem_seed') && f.check === 'never-reachable')).toBe(true);
        expect(before.some(f => f.key === I('item_potato_seed') && ['loop', 'never-reachable', 'never-produced'].includes(f.check))).toBe(true);
    });

    it('the economy reads the Use as a sink used over and over, never a stock with no sink', () => {
        const c = content();
        c.items.item_bird_nest.type = 'material';
        const found = economyFindings(buildLedger(c), c);
        expect(found.some(f => f.key === I('item_bird_nest') && f.check === 'no-sink')).toBe(false);
    });

    it('the pace has the Use\'s drops as fast as the Nest, times what one gives', () => {
        const c = content();
        const ledger = buildLedger(c);
        const pace = buildPace(c, ledger, { layout: 'sparse' });
        const nest = pace.supplyOf('item_bird_nest', PROFILE.BARE, 0).perHour;
        expect(nest).toBeGreaterThan(0);
        expect(pace.supplyOf('item_gem_seed', PROFILE.BARE, 0).perHour).toBeCloseTo(nest * 0.25, 6);
        // The guard: without the Use nothing makes a Gem Seed.
        const bare = content({ use: false });
        expect(buildPace(bare, buildLedger(bare), { layout: 'sparse' }).supplyOf('item_gem_seed', PROFILE.BARE, 0).perHour).toBe(0);
    });

    it('the Ledger\'s item page lists using the Nest among a seed\'s sources', () => {
        const ledger = buildLedger(content());
        expect(pageSourcesOf(ledger, I('item_gem_seed'))).toEqual([
            expect.objectContaining({ how: HOW.USE, howText: 'used from the Bank', viaKey: I('item_bird_nest'), viaName: 'Bird Nest', chance: 0.25, tier: 0 })
        ]);
    });

    it('the Economy Audit finds the seeds produced and the Nest spent', () => {
        const c = content();
        const recipes = Object.fromEntries(Object.values(c.recipePools).flat().map(r => [r.id, r]));
        const issues = auditConnectivity({ items: c.items, tokens: c.tokens, recipes });
        const about = (id) => issues.filter(i => i.entityId === id).map(i => i.details);
        expect(about('item_gem_seed').some(d => /Unreachable Item/.test(d))).toBe(false);
        expect(about('item_bird_nest').some(d => /Dead-End Material/.test(d))).toBe(false);
        // A drop naming a missing item is named (a CMS edit is a new record: the reader keeps one per record).
        c.items.item_bird_nest = { ...c.items.item_bird_nest, use: { drops: [...NEST_USE.drops, { itemId: 'item_nowhere', chance: 10 }] } };
        const broken = auditConnectivity({ items: c.items, tokens: c.tokens, recipes });
        expect(broken.some(i => i.entityId === 'item_bird_nest' && /Its Use gives item ID "item_nowhere"/.test(i.details))).toBe(true);
    });
});

describe('the Encyclopedia shows the Use as a way to get the seeds', () => {
    const book = () => buildEncyclopedia(content());

    it('a seed\'s sources and the Nest\'s gives', () => {
        const b = book();
        expect(b.sourcesOf(I('item_gem_seed'))).toEqual([
            expect.objectContaining({ how: HOW.USE, via: I('item_bird_nest'), chance: 0.25, min: 1, max: 1 })
        ]);
        expect(b.givesOf(I('item_bird_nest')).map(g => [g.how, g.key])).toEqual([
            [HOW.USE, I('item_potato_seed')], [HOW.USE, I('item_gem_seed')]
        ]);
    });

    it('on the chart: the Nest is the box on the way in, its line says use, no hero is asked, the amount shows', () => {
        const b = book();
        const way = waysIn(b, I('item_potato_seed')).find(w => w.how === HOW.USE);
        expect(way).toMatchObject({ from: I('item_bird_nest'), inputs: [], yields: { min: 1, max: 2 } });
        expect(wayInWord(b, way)).toEqual({ word: 'use', tip: 'use', args: null });
        expect(wayInRequirement(b, way)).toBeNull();
        const out = waysOut(b, I('item_bird_nest')).find(w => w.to === I('item_gem_seed'));
        expect(out).toMatchObject({ how: HOW.USE, gives: true, chance: 0.25 });
        expect(wayOutWord(b, I('item_bird_nest'), out)).toEqual({ word: 'use', tip: 'use', args: null });
        expect(en.encyclopedia.line.use).toBe('use');
        expect(en.encyclopedia.lineTip.use).toBe('Using {from} from the Bank gives {to}');
    });
});

describe('a price that comes from the Use: the tree and the chart follow it', () => {
    // The Oak Tree drops a Potato Seed now and then too, so a seed has two ways in and its price names one.
    const both = (valueSource) => {
        const c = content();
        c.tokens.token_oak_tree.config.outputs.push({ itemId: 'item_potato_seed', chance: 5, minQty: 1, maxQty: 1 });
        c.items.item_potato_seed.valueSource = valueSource;
        return c;
    };
    const USE = itemUseSourceId('item_bird_nest');

    it('the tree follows the source the price names, the Use included', () => {
        expect(buildLedger(both('token_oak_tree')).treeOf('item_potato_seed').tree.source).toMatchObject({ how: HOW.WORK, via: tokenKey('token_oak_tree') });
        expect(buildLedger(both(USE)).treeOf('item_potato_seed').tree.source).toMatchObject({ how: HOW.USE, via: I('item_bird_nest') });
    });

    it('the chart puts the way the price comes from first, the Use included', () => {
        expect(waysIn(buildEncyclopedia(both('token_oak_tree')), I('item_potato_seed'))[0]).toMatchObject({ how: HOW.WORK, from: tokenKey('token_oak_tree') });
        expect(waysIn(buildEncyclopedia(both(USE)), I('item_potato_seed'))[0]).toMatchObject({ how: HOW.USE, from: I('item_bird_nest') });
    });
});
