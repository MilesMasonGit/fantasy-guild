// Bunk Beds, Bank Tabs and the Wishing Well as authored stars: the data may carry them and the game
// keeps only what each does by id (a hero a rank, a Bank tab a rank; the Well's Water is a line).
// The game has no stand-in for them: a sky without one is a boot audit error. An old save keeps their
// ranks, the Well's old id included. Fixtures only: nothing here reads the three from `data/`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as PassiveProduction from '../systems/board/PassiveProduction.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { migrateState, withRenamedUpgrades } from '../systems/core/SaveMigration.js';
import { hallStarFindings, hallRequiredFindings } from '../systems/core/hallStarRule.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { starSentence, starAmount } from '../systems/progression/hallStarText.js';
import { outlineSpriteName } from '../ui/components/board/hallStarOutline.js';
import { PASSIVE_LAP_BASE_MS } from '../config/registries/tokenConstants.js';
import { ITEMS } from '../config/registries/itemRegistry.js';
import { TOKENS } from '../config/registries/tokenRegistry.js';
import { registerHallSky, authoredHallSky } from '../config/registries/hallStarRegistry.js';
import {
    GUILD_UPGRADES, CONSTELLATIONS, REQUIRED_STAR_IDS, getUpgradeDef
} from '../config/guildUpgrades.js';
import { buildLedger, itemKey, tokenKey } from '../systems/progression/ledger/engine.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';
import { hallTracksOf, freeRanks } from '../../cms/src/engine/ledger/hall.js';
import { validatePack } from '../../cms/src/engine/changePacks.js';
import { ledgerContent } from './fixtures/ledgerWorld.js';
import { paceContent } from './fixtures/paceWorld.js';
import { authoredThree, installAuthoredThree, skyWithAuthoredThree, FIXTURE_WATER_PER_RANK } from './fixtures/authoredThreeStars.js';
import { withRequiredThree, REQUIRED_WATER_PER_RANK } from './fixtures/hallSky.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const THREE = ['roster_size', 'bank_tabs', 'wishing_well'];
const water = () => SpriteLayer.countOnBoard('item_water');
const ranks = () => GameState.state.progress.guildUpgrades;

/** The shipped sky without the three, whatever `data/` holds. */
function skyWithoutThree() {
    const shipped = authoredHallSky();
    const drop = (collection, ids) => Object.fromEntries(Object.entries(collection || {}).filter(([id]) => !ids.includes(id)));
    return { constellations: drop(shipped.constellations, ['hearth', 'vault', 'well']), stars: drop(shipped.stars, THREE) };
}

/** The Guild Hall on the mat. */
function placeHall() {
    const hall = BoardState.createTokenInstance('token_guild_hall');
    Placement.placeTokenAt(hall, { x: 800, y: 500 });
    return hall;
}

/** Put the next rank's price in the Bank and buy it. */
function buyNext(id) {
    for (const { itemId, quantity } of GuildUpgradeManager.getNextCost(id) || []) InventoryManager.addItem(itemId, quantity);
    return GuildUpgradeManager.purchase(id);
}

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.progress.guildUpgrades = {};
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
});

afterEach(() => {
    registerHallSky(null);
    GuildUpgradeManager.recompute();
});

describe('an old save keeps its Bunk Beds, Bank Tabs and Wishing Well ranks under the authored stars', () => {
    it('loads the ranks by id, the Well\'s old id included, and gives what each rank does', () => {
        GameState.state.progress.guildUpgrades = { roster_size: 3, bank_tabs: 2, guildmasters_banner: 2, star_forestry_speed: 1 };
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(saved.state, saved.version);
        InventoryManager.init();
        installAuthoredThree();

        expect(ranks()).toEqual({ roster_size: 3, bank_tabs: 2, wishing_well: 2, star_forestry_speed: 1 });
        expect(GameState.state.progress.rosterLimit).toBe(3);
        expect(GameState.state.inventory.maxTabs).toBe(3);
        expect(GameState.state.inventory.groupOrder).toHaveLength(3);
        for (const id of THREE) expect(getUpgradeDef(id), id).toMatchObject({ authored: true });
        const hall = placeHall();
        expect(PassiveProduction.linesOf(hall).find(l => l.itemId === 'item_water')).toEqual({
            itemId: 'item_water', quantity: 2 * FIXTURE_WATER_PER_RANK, source: 'hall_star'
        });
    });

    it('keeps a rank under the new id when the save holds both', () => {
        const state = { progress: { guildUpgrades: { wishing_well: 4, guildmasters_banner: 1 } } };
        expect(withRenamedUpgrades(state).progress.guildUpgrades).toEqual({ wishing_well: 4 });
        expect(withRenamedUpgrades({ progress: { guildUpgrades: { bank_tabs: 1 } } }).progress.guildUpgrades).toEqual({ bank_tabs: 1 });
    });
});

describe('the authored sky carries the three', () => {
    it('in their authored places, constellations, prices and words', () => {
        installAuthoredThree();
        expect(GUILD_UPGRADES.filter(u => THREE.includes(u.id))).toHaveLength(3);
        expect(getUpgradeDef('bank_tabs')).toMatchObject({ maxRank: 15, node: { x: -0.55, y: 0 }, constellation: 'vault' });
        expect(getUpgradeDef('roster_size')).toMatchObject({ maxRank: 8, node: { x: 0, y: -0.55 } });
        expect(getUpgradeDef('wishing_well')).toMatchObject({ maxRank: 10, node: { x: 0, y: 0.55 } });
        expect(CONSTELLATIONS.filter(c => ['hearth', 'vault', 'well'].includes(c.id)).map(c => [c.id, c.label])).toEqual([
            ['hearth', { x: 0, y: -0.85 }], ['vault', { x: -0.78, y: 0.3 }], ['well', { x: 0, y: 0.85 }]
        ]);
        expect(GuildUpgradeManager.getNextCost('bank_tabs')).toEqual([{ itemId: 'item_copper_ore', quantity: 20 }]);
        expect(GuildUpgradeManager.getNextCost('wishing_well')).toEqual([{ itemId: 'item_oak_wood', quantity: 5 }]);

        expect(starSentence(getUpgradeDef('roster_size'))).toBe('Every rank makes room for one more hero.');
        expect(starSentence(getUpgradeDef('wishing_well'))).toBe('The Guild Hall draws Water every lap, no hero needed.');
        expect(starAmount(getUpgradeDef('roster_size'), 3)).toBe('3 heroes');
        expect(starAmount(getUpgradeDef('bank_tabs'), 0)).toBe('1 tab');
        expect(starAmount(getUpgradeDef('bank_tabs'), 2)).toBe('3 tabs');
        expect(starAmount(getUpgradeDef('wishing_well'), 2)).toBe(`${2 * FIXTURE_WATER_PER_RANK} Water`);
        expect(getUpgradeDef('wishing_well').statLabel(2)).toBe(`${2 * FIXTURE_WATER_PER_RANK} Water a lap`);
        expect(outlineSpriteName(getUpgradeDef('bank_tabs'))).toBe('i_key_gold');
    });

    it('buys each once: a hero joins, a Bank tab opens, the Well\'s Water comes next lap', () => {
        GameState.state.progress.guildUpgrades = { roster_size: 1 };
        installAuthoredThree();
        const hall = placeHall();

        expect(buyNext('roster_size').success).toBe(true);
        expect(GameState.heroes).toHaveLength(1);
        expect(GameState.state.progress.rosterLimit).toBe(2);

        expect(buyNext('bank_tabs').success).toBe(true);
        expect(GameState.state.inventory.maxTabs).toBe(2);

        expect(buyNext('wishing_well').success).toBe(true);
        BoardRunner.tick(PASSIVE_LAP_BASE_MS);
        expect(water()).toBe(FIXTURE_WATER_PER_RANK);
        expect(BoardState.getTokenById(hall.id)).toBeTruthy();
    });

    it('the boot audit finds nothing wrong with the three, and none missing', () => {
        const sky = skyWithAuthoredThree();
        expect(hallRequiredFindings({ sky })).toEqual([]);
        expect(hallStarFindings({ sky, items: ITEMS, tokens: TOKENS }).filter(f => THREE.includes(f.entityId))).toEqual([]);
    });

    it('the boot audit names a Bunk Beds star whose ranks do not reach the roster cap', () => {
        const three = authoredThree();
        three.stars.roster_size.ranks = three.stars.roster_size.ranks.slice(0, 7);
        const findings = hallStarFindings({ sky: three, items: ITEMS, tokens: TOKENS }).map(f => `${f.entityId}: ${f.message}`);
        expect(findings).toEqual([
            'roster_size: has 7 ranks, but every rank makes room for one more hero and 8 ranks reach the most heroes a guild can have. Give it 8 ranks in the CMS.'
        ]);
    });

    it('a change pack may bring them: their ids are no longer refused', () => {
        const three = authoredThree();
        const entries = [
            ...Object.entries(three.constellations).map(([id, value]) => ({ op: 'create', kind: 'hallConstellation', id, value, note: 'n' })),
            ...Object.entries(three.stars).map(([id, value]) => ({ op: 'create', kind: 'hallStar', id, value, note: 'n' }))
        ];
        expect(validatePack({ format: 'fantasy-guild-change-pack', version: 1, id: 'three', createdAt: '2026-11-21T00:00:00Z', asked: 'the three', entries })).toEqual({ ok: true });
    });
});

describe('a sky without the three is a boot audit error, with no stand-in', () => {
    it('names each missing star as an error, and no star stands in', () => {
        registerHallSky(skyWithoutThree());
        expect(() => GuildUpgradeManager.recompute()).not.toThrow();
        for (const id of THREE) expect(getUpgradeDef(id), id).toBeNull();

        const findings = hallRequiredFindings({ sky: skyWithoutThree() });
        expect(findings.map(f => [f.entityType, f.entityId, f.severity])).toEqual([
            ['Hall star', 'bank_tabs', 'error'], ['Hall star', 'roster_size', 'error'], ['Hall star', 'wishing_well', 'error']
        ]);
        expect(REQUIRED_STAR_IDS).toEqual(['bank_tabs', 'roster_size', 'wishing_well']);
    });

    it('the boot audit reads the file as loaded and names a missing star there, not as allowed', () => {
        // The audit reads the registry's own record of the file, so the test takes a star out of it and puts it back.
        const file = authoredHallSky();
        const before = { ...file.stars };
        delete file.stars.wishing_well;
        try {
            const boot = auditContent().filter(f => f.what.includes('is missing from the Guild Hall sky'));
            expect(boot.map(f => f.where)).toEqual(['Hall star "wishing_well"']);
            expect(boot[0].what.startsWith('(allowed)')).toBe(false);
        } finally {
            for (const id of Object.keys(file.stars)) delete file.stars[id];
            Object.assign(file.stars, before);
        }
    });

    it('names only the one missing', () => {
        const sky = skyWithAuthoredThree();
        delete sky.stars.wishing_well;
        expect(hallRequiredFindings({ sky }).map(f => f.entityId)).toEqual(['wishing_well']);
    });

    it('the shipped sky holds all three: the boot audit names none missing', () => {
        expect(hallRequiredFindings({ sky: authoredHallSky() })).toEqual([]);
        expect(auditContent().filter(f => f.what.includes('is missing from the Guild Hall sky'))).toEqual([]);
    });
});

describe('the progression ledger reads the Wishing Well and the other two from the content', () => {
    it('reach: the Well\'s Water comes at its authored price and amount, and a sky without it has none', () => {
        const wellRule = (hallSky) => buildLedger({ ...ledgerContent(), hallSky }).world.rules.find(r => r.id === 'upgrade:wishing_well');
        expect(wellRule(authoredThree())).toMatchObject({
            needs: [tokenKey('token_guild_hall'), itemKey('item_oak_wood')],
            gives: [{ key: itemKey('item_water'), chance: 1, perCycle: FIXTURE_WATER_PER_RANK }]
        });
        expect(wellRule(withRequiredThree())).toMatchObject({
            needs: [tokenKey('token_guild_hall')],
            gives: [{ key: itemKey('item_water'), chance: 1, perCycle: REQUIRED_WATER_PER_RANK }]
        });
        expect(wellRule({})).toBeUndefined();
    });

    it('rates: the three are priced like any star, Bunk Beds\' first rank held however it is priced', () => {
        const tracks = (hallSky) => new Map(hallTracksOf(buildRateBook({ ...paceContent(), hallSky })).map(t => [t.id, t]));
        const authored = tracks(authoredThree());
        const freeFirst = tracks(withRequiredThree());
        expect(THREE.map(id => freeRanks(authored.get(id)))).toEqual([1, 0, 0]);
        expect(THREE.map(id => freeRanks(freeFirst.get(id)))).toEqual([1, 0, 0]);
        expect(tracks({}).size).toBe(0);
        expect(authored.get('bank_tabs').price(1)).toEqual([{ itemId: 'item_copper_ore', quantity: 20 }]);

        const hallWater = (hallSky) => buildRateBook({ ...paceContent(), hallSky })
            .rateOf({ token: 'token_guild_hall' }, { hallRanks: { wishing_well: 2 } }).perCycle.item_water;
        expect(hallWater(authoredThree())).toBe(2 * FIXTURE_WATER_PER_RANK);
        expect(hallWater(withRequiredThree())).toBe(2 * REQUIRED_WATER_PER_RANK);
    });
});
