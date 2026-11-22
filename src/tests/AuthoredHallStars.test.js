// Bunk Beds, Bank Tabs and the Wishing Well as authored stars: the data may carry them and the game
// keeps only what each does by id (a hero a rank, a Bank tab a rank; the Well's Water is a line).
// Until the data carries them, the game's stand-ins hold the guild exactly as before. An old save
// keeps their ranks, the Well's old id included. Fixtures only: nothing here reads the three from `data/`.
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
import { hallStarFindings, hallFallbackFindings } from '../systems/core/hallStarRule.js';
import { starSentence, starAmount } from '../systems/progression/hallStarText.js';
import { outlineSpriteName } from '../ui/components/board/hallStarOutline.js';
import { PASSIVE_LAP_BASE_MS } from '../config/registries/tokenConstants.js';
import { ITEMS } from '../config/registries/itemRegistry.js';
import { TOKENS } from '../config/registries/tokenRegistry.js';
import { registerHallSky, authoredHallSky } from '../config/registries/hallStarRegistry.js';
import {
    GUILD_UPGRADES, CONSTELLATIONS, FALLBACK_STAR_IDS, PLACEHOLDER_PRICE_ITEM, getUpgradeDef, getUpgradePrice
} from '../config/guildUpgrades.js';
import { buildLedger, itemKey, tokenKey } from '../systems/progression/ledger/engine.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';
import { hallTracksOf, freeRanks } from '../../cms/src/engine/ledger/hall.js';
import { validatePack } from '../../cms/src/engine/changePacks.js';
import { ledgerContent } from './fixtures/ledgerWorld.js';
import { paceContent } from './fixtures/paceWorld.js';
import { authoredThree, installAuthoredThree, skyWithAuthoredThree, FIXTURE_WATER_PER_RANK } from './fixtures/authoredThreeStars.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const THREE = ['roster_size', 'bank_tabs', 'wishing_well'];
const water = () => SpriteLayer.countOnBoard('item_water');
const ranks = () => GameState.state.progress.guildUpgrades;

/** The shipped sky without the three, whatever `data/` holds: the sky before the pack is Synced. */
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
    it('in their authored places, constellations, prices and words, with no stand-in left', () => {
        installAuthoredThree();
        expect(GUILD_UPGRADES.filter(u => u.fallback)).toEqual([]);
        expect(GUILD_UPGRADES.filter(u => THREE.includes(u.id))).toHaveLength(3);
        expect(getUpgradeDef('bank_tabs')).toMatchObject({ maxRank: 15, node: { x: -0.55, y: 0 }, constellation: 'vault' });
        expect(getUpgradeDef('roster_size')).toMatchObject({ maxRank: 8, node: { x: 0, y: -0.55 } });
        expect(getUpgradeDef('wishing_well')).toMatchObject({ maxRank: 10, node: { x: 0, y: 0.55 } });
        expect(CONSTELLATIONS.filter(c => ['hearth', 'vault', 'well'].includes(c.id)).map(c => [c.id, c.label, !!c.fallback])).toEqual([
            ['hearth', { x: 0, y: -0.85 }, false], ['vault', { x: -0.78, y: 0.3 }, false], ['well', { x: 0, y: 0.85 }, false]
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

    it('the boot audit finds nothing wrong with the three, and no stand-in to warn of', () => {
        const sky = skyWithAuthoredThree();
        expect(hallFallbackFindings({ sky })).toEqual([]);
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

describe('until the pack is Synced, the stand-ins hold the guild as before', () => {
    beforeEach(() => {
        registerHallSky(skyWithoutThree());
        GuildUpgradeManager.recompute();
    });

    it('holds the three at the placeholder prices, rank counts, places and Water they had', () => {
        expect(GUILD_UPGRADES.slice(0, 3).map(u => [u.id, u.maxRank, !!u.fallback])).toEqual([
            ['bank_tabs', 15, true], ['roster_size', 8, true], ['wishing_well', 10, true]
        ]);
        expect(CONSTELLATIONS.slice(0, 3).map(c => [c.id, c.name, c.label])).toEqual([
            ['hearth', 'The Hearth', { x: 0, y: -0.8 }], ['vault', 'The Vault', { x: -0.72, y: 0.3 }], ['well', 'The Well', { x: 0, y: 0.8 }]
        ]);
        expect(getUpgradeDef('bank_tabs').node).toEqual({ x: -0.5, y: 0 });
        for (const id of THREE) {
            const def = getUpgradeDef(id);
            const freeFirst = id !== 'bank_tabs';
            for (let r = 0; r < def.maxRank; r++) {
                const price = getUpgradePrice(def, r);
                if (freeFirst && r === 0) expect(price, `${id} rank 1`).toEqual([]);
                else expect(price, `${id} rank ${r + 1}`).toEqual([{ itemId: PLACEHOLDER_PRICE_ITEM, quantity: 10 * (r + 1) }]);
            }
        }
        expect(starAmount(getUpgradeDef('wishing_well'), 3)).toBe('30 Water');
        expect(outlineSpriteName(getUpgradeDef('roster_size'))).toBe('t_bunk_bed');

        GameState.state.progress.guildUpgrades = { wishing_well: 3, bank_tabs: 4, roster_size: 2 };
        GuildUpgradeManager.recompute();
        expect(GameState.state.inventory.maxTabs).toBe(5);
        expect(GameState.state.progress.rosterLimit).toBe(2);
        const hall = placeHall();
        BoardRunner.tick(PASSIVE_LAP_BASE_MS);
        expect(water()).toBe(30);
        expect(PassiveProduction.linesOf(hall).find(l => l.itemId === 'item_water').quantity).toBe(30);
    });

    it('warns once for each stand-in in the boot audit, and only as allowed', () => {
        const findings = hallFallbackFindings({ sky: skyWithoutThree() });
        expect(findings.map(f => [f.entityType, f.entityId, f.severity])).toEqual([
            ['Hall star', 'bank_tabs', 'warning'], ['Hall star', 'roster_size', 'warning'], ['Hall star', 'wishing_well', 'warning'],
            ['Hall constellation', 'hearth', 'warning'], ['Hall constellation', 'vault', 'warning'], ['Hall constellation', 'well', 'warning']
        ]);
        expect(FALLBACK_STAR_IDS).toEqual(['bank_tabs', 'roster_size', 'wishing_well']);
    });
});

describe('the progression ledger reads the Wishing Well and the other two from the content', () => {
    it('reach: the Well\'s Water comes at its authored price and amount, or the stand-in\'s', () => {
        const wellRule = (hallSky) => buildLedger({ ...ledgerContent(), hallSky }).world.rules.find(r => r.id === 'upgrade:wishing_well');
        expect(wellRule(authoredThree())).toMatchObject({
            needs: [tokenKey('token_guild_hall'), itemKey('item_oak_wood')],
            gives: [{ key: itemKey('item_water'), chance: 1, perCycle: FIXTURE_WATER_PER_RANK }]
        });
        expect(wellRule({})).toMatchObject({
            needs: [tokenKey('token_guild_hall')],
            gives: [{ key: itemKey('item_water'), chance: 1, perCycle: 10 }]
        });
    });

    it('rates: the authored three are priced like any star; a stand-in stays the game\'s own, Bunk Beds\' first rank held either way', () => {
        const tracks = (hallSky) => new Map(hallTracksOf(buildRateBook({ ...paceContent(), hallSky })).map(t => [t.id, t]));
        const authored = tracks(authoredThree());
        const standIns = tracks({});
        for (const id of THREE) {
            expect(authored.get(id).builtIn, id).toBe(false);
            expect(standIns.get(id).builtIn, id).toBe(true);
        }
        expect(THREE.map(id => freeRanks(authored.get(id)))).toEqual([1, 0, 0]);
        expect(THREE.map(id => freeRanks(standIns.get(id)))).toEqual([1, 0, 1]);
        expect(authored.get('bank_tabs').price(1)).toEqual([{ itemId: 'item_copper_ore', quantity: 20 }]);

        const hallWater = (hallSky) => buildRateBook({ ...paceContent(), hallSky })
            .rateOf({ token: 'token_guild_hall' }, { hallRanks: { wishing_well: 2 } }).perCycle.item_water;
        expect(hallWater(authoredThree())).toBe(2 * FIXTURE_WATER_PER_RANK);
        expect(hallWater({})).toBe(20);
    });
});
