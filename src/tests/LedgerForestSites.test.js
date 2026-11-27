import { describe, it, expect } from 'vitest';

import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace, PROFILE, PACE_TEXT } from '../../cms/src/engine/ledger/pace.js';
import { settingsOf } from '../../cms/src/engine/ledger/settings.js';
import { paceContent } from './fixtures/paceWorld.js';

/**
 * ⭐ A site worked from a spawner (owner, 2026-11-26): a camp at a Forest works the Forest's whole
 * allowance of trees, since a Forest never stands with only two of its trees; one Forest in the sparse
 * layout and two in the dense. The Forest and its trees stand in the twelve places round the site
 * with the camp, so a Forest site has fewer places for buildings than a vein site, which keeps its
 * eight.
 */

const paceOf = (content, settings = null) => buildPace(content, buildLedger(content), settings);

const HOUR_MS = 3_600_000;
const out = (itemId) => ({ itemId, chance: 100, minQty: 1, maxQty: 1 });
const provides = (id, type, bucket, value, to, extra = {}) => ({ id: `stm_${id}`, keyword: 'provides', to, reach: 'nearby', payload: { type, bucket, value, ...extra } });
const building = (id, name, statements) => ({ id, name, tokenType: 'buff', uses: null, requiresHero: false, config: null, statements });
const buildRecipe = (id, tokenId, wood = 5) => ({
    id, name: `Build ${tokenId}`, skill: 'construction', levelRequirement: 1, xp: 5, durationMs: 30000, foundationKinds: ['wood'],
    inputs: [{ itemId: 'item_oak_wood', quantity: wood }], outputs: [{ tokenId, chance: 100, minQty: 1, maxQty: 1 }]
});
const ELM = { token: 'token_elm' };
const VEIN = { token: 'token_vein' };

/** The pace world with an Elm Forest (four trees, each five 3 s chops then five minutes to regrow from its Stump) and a Logging Camp to build. */
function forestContent() {
    const c = paceContent();
    c.items.item_elm_wood = { id: 'item_elm_wood', name: 'Elm Wood', type: 'material', plan: { tier: 0 } };
    c.tokens.token_elm = {
        id: 'token_elm', name: 'Elm Tree', uses: 5, needsTool: { kind: 'woodaxe', minTier: 1 }, respawn: { mode: 'regrow', into: 'token_elm_stump' },
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [out('item_elm_wood')] }
    };
    c.tokens.token_elm_stump = { id: 'token_elm_stump', name: 'Elm Stump', uses: null, config: null, staysPut: true, grows: { into: 'token_elm', afterMs: 300000, needsNearby: ['token_elm_forest'] } };
    c.tokens.token_elm_forest = {
        id: 'token_elm_forest', name: 'Elm Forest', uses: null, config: null,
        spawner: { spawns: [{ typeId: 'token_elm', weight: 1 }], allowance: 4, intervalMs: 20000, withinReach: true }
    };
    c.tokens.token_logging_camp = { id: 'token_logging_camp', name: 'Logging Camp', uses: null, config: null, camp: { skill: 'forestry', reach: 280 } };
    c.recipes.push(buildRecipe('recipe_build_logging_camp', 'token_logging_camp', 20));
    c.starterCamp.tokens.push({ typeId: 'token_elm_forest', x: 6, y: 0 }, { typeId: 'token_elm', x: 7, y: 0 });
    return c;
}

/** The Forest with buildings for the elms: Lore Huts (+5 % XP) and Wood Yards (a 25 % double). */
function builtForestContent() {
    const c = forestContent();
    const elm = { mode: 'id', value: 'token_elm' };
    c.tokens.token_lore = building('token_lore', 'Lore Hut', [provides('lore', 'XP_BONUS', 'percentage', 0.05, elm)]);
    c.tokens.token_yard = building('token_yard', 'Wood Yard', [provides('yard', 'DOUBLE_DROP', 'flat', 25, elm, { category: 'item_elm_wood' })]);
    c.recipes.push(buildRecipe('recipe_build_lore', 'token_lore'), buildRecipe('recipe_build_yard', 'token_yard'));
    return c;
}

/** One tree's cycles an hour: five chops of 3 s, then its five minutes' regrowth. */
const ONE_TREE = HOUR_MS * 5 / (5 * 3000 + 300000);

describe('a site worked from a spawner', () => {
    it('⭐ holds the layouts\' spawners and the twelve places round a node in the settings', () => {
        const s = settingsOf(null);
        expect(s.layoutSpawners).toEqual({ sparse: 1, dense: 1 });
        expect(s.sitePlaces).toEqual({ places: 12, buildings: 8, perKind: 4 });
        expect(settingsOf({ layoutSpawners: { sparse: 3, dense: 1 }, sitePlaces: { places: 0 } })).toMatchObject({
            layoutSpawners: { sparse: 3, dense: 3 }, sitePlaces: { places: 12, buildings: 8, perKind: 4 }
        });
    });

    it('⭐ a camp at a Forest works its whole allowance: one Forest\'s four trees in both layouts, two Forests\' eight when set', () => {
        const sparse = paceOf(forestContent());
        const dense = paceOf(forestContent(), { layout: 'dense' });
        // Bare has no camp: one tree.
        expect(sparse.rateAt(ELM, PROFILE.BARE).rate.cyclesPerHour).toBeCloseTo(ONE_TREE, 6);
        const elm = sparse.rateAt(ELM, PROFILE.MAXED);
        expect(elm.setup.camp).toEqual({ id: 'token_logging_camp', members: 4 });
        expect(elm.rate.cyclesPerHour).toBeCloseTo(4 * ONE_TREE, 6);
        expect(dense.rateAt(ELM, PROFILE.MAXED).setup.camp).toEqual({ id: 'token_logging_camp', members: 4 });
        const twoForests = paceOf(forestContent(), { layout: 'dense', layoutSpawners: { sparse: 1, dense: 2 } });
        expect(twoForests.rateAt(ELM, PROFILE.MAXED).setup.camp).toEqual({ id: 'token_logging_camp', members: 8 });
        expect(twoForests.rateAt(ELM, PROFILE.MAXED).rate.cyclesPerHour).toBeCloseTo(8 * ONE_TREE, 6);
        // A vein's camp keeps the layout's nodes.
        expect(sparse.rateAt(VEIN, PROFILE.MAXED).setup.camp.members).toBe(2);
        expect(dense.rateAt(VEIN, PROFILE.MAXED).setup.camp.members).toBe(5);
        // The spawners a layout stands are a setting.
        expect(paceOf(forestContent(), { layoutSpawners: { sparse: 2, dense: 3 } }).rateAt(ELM, PROFILE.MAXED).setup.camp.members).toBe(8);
    });

    it('⭐ a gathering site\'s camp, spawner and nodes stand in its twelve places: six left for buildings at a Forest and at five veins', () => {
        const sparse = paceOf(forestContent());
        const dense = paceOf(forestContent(), { layout: 'dense' });
        // BALANCE_RULES section 5: the camp, the Forest and its four trees, the one worked among them.
        expect(sparse.siteOf(ELM, PROFILE.MAXED)).toMatchObject({ room: 6, taken: 6 });
        expect(dense.siteOf(ELM, PROFILE.MAXED)).toMatchObject({ room: 6, taken: 6 });
        expect(sparse.siteOf(ELM, PROFILE.MAXED).camp).toEqual({ id: 'token_logging_camp', nodes: 4, spawners: 1 });
        // Two Forests when set: the camp, both and their eight trees.
        expect(paceOf(forestContent(), { layout: 'dense', layoutSpawners: { sparse: 1, dense: 2 } }).siteOf(ELM, PROFILE.MAXED)).toMatchObject({ room: 1, taken: 11 });
        // A vein site: its camp and two veins sparse, eight places left (the most a site holds); five veins dense, six left.
        expect(sparse.siteOf(VEIN, PROFILE.MAXED)).toMatchObject({ room: 8, taken: 3 });
        expect(dense.siteOf(VEIN, PROFILE.MAXED)).toMatchObject({ room: 6, taken: 6 });
    });

    it('⭐ Maxed stands no more buildings round the Forest than its places hold', () => {
        const sparse = paceOf(builtForestContent()).siteOf(ELM, PROFILE.MAXED);
        expect(sparse.places).toBe(6);
        expect(Math.max(...Object.values(sparse.byKind))).toBeLessThanOrEqual(4);
        const dense = paceOf(builtForestContent(), { layout: 'dense', layoutSpawners: { sparse: 1, dense: 2 } }).siteOf(ELM, PROFILE.MAXED);
        expect(dense.places).toBe(1);
        // With a site of more places, the eight a site may hold.
        expect(paceOf(builtForestContent(), { sitePlaces: { places: 20 } }).siteOf(ELM, PROFILE.MAXED).places).toBe(8);
    });

    it('⭐ the layout check counts a Forest site\'s trees by its Forests', () => {
        // One Forest in both layouts by default: the layout moves nothing.
        expect(paceOf(forestContent()).layoutRows().find(r => r.work.key === 'token_elm||')).toBeUndefined();
        const pace = paceOf(forestContent(), { layoutSpawners: { sparse: 1, dense: 2 } });
        const row = pace.layoutRows().find(r => r.work.key === 'token_elm||');
        expect(row.nodes).toEqual({ sparse: 4, dense: 8 });
        expect(row.dense / row.sparse).toBeCloseTo(2, 6);
        const found = pace.findings().find(f => f.check === 'layout' && f.key === 'token:token_elm');
        expect(found.message).toMatch(/Elm Tree at Maxed, worked from Logging Camp: 4 in reach \(1 Elm Forest\) make .* an hour and 8 \(2 Elm Forests\) make /);
        expect([PACE_TEXT.count(2, 'Quarry'), PACE_TEXT.count(2, 'Apple Orchard'), PACE_TEXT.count(1, 'Elm Forest')]).toEqual(['2 Quarries', '2 Apple Orchards', '1 Elm Forest']);
        // Two Forests in both layouts: the layout moves nothing.
        expect(paceOf(forestContent(), { layoutSpawners: { sparse: 2, dense: 2 } }).layoutRows().find(r => r.work.key === 'token_elm||')).toBeUndefined();
    });
});
