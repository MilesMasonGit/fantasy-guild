import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Growth from '../systems/board/Growth.js';
import * as Fields from '../systems/board/Fields.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as OutputRules from '../systems/board/OutputRules.js';
import * as SupportLinks from '../systems/board/supportLinks.js';
import { LINK } from '../systems/board/supportLinks.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { supportTag, FLOOR_NOTE } from '../ui/components/board/supportTags.js';
import { tokenCardModel, liveCardSources, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { tokenOutline } from '../ui/components/board/spriteOutline.js';
import { setLit, isLit, subscribeLit } from '../ui/components/board/supportLit.js';
import { clearMat, placeAt } from './fixtures/mat.js';

/**
 * Seeing support effects (brief 230 S7): while a Token is in the hand, the Tokens it would help or
 * be helped by where it would land, each with its effect; on a Token's card, what boosts it and
 * what it boosts (and the floor when its speed-ups are held there); a quiet pop when a bonus lands,
 * never during a catch-up. Everything is read, never changed: no new random draws.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
const SEED = 'fixture_sl_seed';
const WHEAT_ITEM = 'fixture_sl_wheat';
const ORE = 'fixture_sl_ore';
registerItems({
    [SEED]: item(SEED, 'Fixture Seed'),
    [WHEAT_ITEM]: item(WHEAT_ITEM, 'Fixture Wheat'),
    [ORE]: item(ORE, 'Fixture Ore')
});
const WHEAT = 'sl_recipe_wheat';
registerRecipePools({
    farming: [{
        id: WHEAT, name: WHEAT, levelRequirement: 1, durationMs: 3000, xp: 1, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT_ITEM, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 60000, load: 3 }
    }]
}, { takeOver: false });

const provides = (id, to, payload, extra = {}) => ({ id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to, reach: 'nearby', payload, ...extra });
const support = (id, name, statements) => ({
    id, name, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_well_wishing', requiresHero: false, statements
});
registerTokenTypes({
    sl_field: {
        id: 'sl_field', name: 'Fixture Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_farmland', requiresHero: true,
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_sl_field_works', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }],
        field: {}
    },
    sl_vein: {
        id: 'sl_vein', name: 'Fixture Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 5,
        sprite: 't_ore_vein_copper', requiresHero: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 2500, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
    },
    sl_well: support('sl_well', 'Fixture Well', [provides('sl_well', { mode: 'id', value: 'sl_field' }, { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.5 })]),
    sl_composter: support('sl_composter', 'Fixture Composter', [provides('sl_composter', { mode: 'id', value: 'sl_field' }, { type: EFFECT_TYPES.CROP_LOAD, bucket: 'flat', value: 2 })]),
    sl_mine: support('sl_mine', 'Fixture Mine', [provides('sl_mine', { mode: 'id', value: 'sl_vein' }, { type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 100, category: ORE })]),
    // Narrowed to Mining and aimed at everything: it must never light a Field.
    sl_cart: support('sl_cart', 'Fixture Cart', [provides('sl_cart', { mode: 'all' }, { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.2, category: 'mining' })]),
    // The whole mat: where it stands changes nothing, so it never lights up.
    sl_banner: support('sl_banner', 'Fixture Banner', [provides('sl_banner', { mode: 'id', value: 'sl_field' }, { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 }, { reach: 'board' })])
});

const AT = { x: 800, y: 500 };
const NEAR = { x: 950, y: 500 };   // 150 away: within reach (164)
const FAR = { x: 1100, y: 500 };   // 300 away

function arrive(typeId, point = AT) {
    const t = placeAt(typeId, point.x, point.y);
    TileModifiers.rebuildAround([point]);
    return t;
}
const tick = (ms, step = 100) => { for (let t = 0; t < ms; t += step) TimedChanges.tick(step); };

beforeAll(() => TimedChanges.init());

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    getGlobalAggregator().clearAll();
    Growth.resetGrowthAlerts();
    clearMat();
});

afterEach(() => {
    EventBus.setQuiet(false);
    clearMat();
    setLit([]);
    vi.restoreAllMocks();
});

describe('a support\'s effect in a few words', () => {
    it('says each kind the skill loops use, with the item a chance names', () => {
        expect(supportTag({ type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.25 })).toBe('−25 % grow');
        expect(supportTag({ type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.2 })).toBe('−20 % work');
        expect(supportTag({ type: EFFECT_TYPES.CROP_LOAD, bucket: 'flat', value: 2 })).toBe('+2 harvests');
        expect(supportTag({ type: EFFECT_TYPES.CROP_LOAD, bucket: 'flat', value: 1 })).toBe('+1 harvest');
        expect(supportTag({ type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 25, category: ORE })).toBe('×2 Fixture Ore 25 %');
        expect(supportTag({ type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 25 })).toBe('×2 items 25 %');
        expect(supportTag({ type: EFFECT_TYPES.BONUS_DROP, itemId: SEED, chance: 5 })).toBe('+Fixture Seed 5 %');
        expect(supportTag({ type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 })).toBe('+10 % yield');
    });
});

describe('⭐ while placing: who would be helped, and by whom', () => {
    it('a Well in the hand lights the Fields within reach of where it would land, with the effect', () => {
        const near = arrive('sl_field', AT);
        arrive('sl_field', { x: 1300, y: 500 });
        const candidates = SupportLinks.placementCandidates('sl_well');
        const lit = SupportLinks.linksAt(candidates, NEAR);
        expect(lit.map(c => c.id)).toEqual([near.id]);
        expect(lit[0].links).toEqual([{ role: LINK.HELPS, payload: expect.objectContaining({ type: EFFECT_TYPES.GROW_TIME, value: -0.5 }) }]);
        expect(SupportLinks.linksAt(candidates, { x: 1050, y: 900 })).toEqual([]);
    });

    it('a Field in the hand lights the supports that would help it', () => {
        const well = arrive('sl_well', AT);
        const lit = SupportLinks.linksAt(SupportLinks.placementCandidates('sl_field'), NEAR);
        expect(lit.map(c => c.id)).toEqual([well.id]);
        expect(lit[0].links[0].role).toBe(LINK.HELPED_BY);
    });

    it('a narrowed rule lights only the skill it names; a mat-wide rule never lights', () => {
        const field = arrive('sl_field', AT);
        const vein = arrive('sl_vein', { x: 800, y: 650 });
        arrive('sl_banner', { x: 1600, y: 500 });
        expect(SupportLinks.linksAt(SupportLinks.placementCandidates('sl_cart'), { x: 800, y: 575 }).map(c => c.id)).toEqual([vein.id]);
        expect(SupportLinks.placementCandidates('sl_field').map(c => c.id)).not.toContain(field.id);
        expect(SupportLinks.placementCandidates('sl_field')).toEqual([]);
    });

    it('a Token being moved is not its own candidate', () => {
        const well = arrive('sl_well', AT);
        arrive('sl_field', NEAR);
        const ids = SupportLinks.placementCandidates('sl_well', well.id).map(c => c.id);
        expect(ids).not.toContain(well.id);
        expect(ids).toHaveLength(1);
    });

    it('the lit set tells its Tokens only when it changes, and a lit Token wears the white outline', () => {
        const heard = vi.fn();
        const off = subscribeLit(heard);
        setLit(['a', 'b']);
        setLit(['b', 'a']);
        expect(heard).toHaveBeenCalledTimes(1);
        expect(isLit('a')).toBe(true);
        setLit([]);
        expect(isLit('a')).toBe(false);
        expect(heard).toHaveBeenCalledTimes(2);
        off();
        expect(tokenOutline({ lit: true })).toBe('hover');
        expect(tokenOutline({ lit: true, alert: true })).toBe('hover');
    });
});

describe('⭐ on inspect: Boosted by and Boosts', () => {
    it('a Field lists the Well and Composter in reach; the Well lists the Field', () => {
        const field = arrive('sl_field', AT);
        const well = arrive('sl_well', NEAR);
        const composter = arrive('sl_composter', { x: 800, y: 650 });
        arrive('sl_well', FAR);   // out of reach
        expect(SupportLinks.boostedBy(field.id).map(r => [r.id, r.payloads.map(p => p.type)])).toEqual([
            [well.id, [EFFECT_TYPES.GROW_TIME]], [composter.id, [EFFECT_TYPES.CROP_LOAD]]
        ]);
        expect(SupportLinks.boosts(well.id).map(r => r.id)).toEqual([field.id]);
        expect(SupportLinks.boosts(field.id)).toEqual([]);

        const model = tokenCardModel('sl_field', field.id, liveCardSources());
        const block = model.blocks.find(b => b.id === CARD_BLOCK.SUPPORT);
        expect(block.boostedBy.map(r => [r.name, r.tags])).toEqual([
            ['Fixture Well', ['−50 % grow']], ['Fixture Composter', ['+2 harvests']]
        ]);
        expect(block.floor).toEqual([]);
        const wellCard = tokenCardModel('sl_well', well.id, liveCardSources());
        expect(wellCard.blocks.find(b => b.id === CARD_BLOCK.SUPPORT).boosts.map(r => r.name)).toEqual(['Fixture Field']);
    });

    it('notes the floor when speed-ups are held there', () => {
        const field = arrive('sl_field', AT);
        arrive('sl_well', NEAR);
        expect(SupportLinks.floorHits(field.id)).toEqual({ work: false, grow: false });
        arrive('sl_well', { x: 650, y: 500 });   // −100 %: held at −80 %
        expect(SupportLinks.floorHits(field.id).grow).toBe(true);
        const block = tokenCardModel('sl_field', field.id, liveCardSources()).blocks.find(b => b.id === CARD_BLOCK.SUPPORT);
        expect(block.floor).toEqual([FLOOR_NOTE.grow]);
    });

    it('a Token trading no support shows no block, and a card off the mat none', () => {
        const field = arrive('sl_field', AT);
        expect(tokenCardModel('sl_field', field.id, liveCardSources()).blocks.some(b => b.id === CARD_BLOCK.SUPPORT)).toBe(false);
        expect(tokenCardModel('sl_well', null, liveCardSources()).blocks.some(b => b.id === CARD_BLOCK.SUPPORT)).toBe(false);
    });
});

describe('⭐ quiet pops when a bonus lands', () => {
    const fired = () => {
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => heard.push(p));
        return { heard, off };
    };

    it('a doubled item pops its extra over the vein, sparked from the Mine; no name, one draw as before', () => {
        const vein = arrive('sl_vein', AT);
        const mine = arrive('sl_mine', NEAR);
        const { heard, off } = fired();
        const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
        expect(OutputRules.doubleItemDrop(vein.id, ORE, 1)).toBe(2);
        expect(random).toHaveBeenCalledTimes(1);
        off();
        expect(heard).toEqual([{ instanceId: vein.id, amount: 1, bonus: true, fromTokenId: mine.id }]);
    });

    it('silent during a catch-up, with the same single draw', () => {
        const vein = arrive('sl_vein', AT);
        arrive('sl_mine', NEAR);
        const { heard, off } = fired();
        const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const lookups = vi.spyOn(TileModifiers, 'inboundSupports');
        EventBus.setQuiet(true);
        expect(OutputRules.doubleItemDrop(vein.id, ORE, 1)).toBe(2);
        off();
        expect(heard).toEqual([]);
        expect(random).toHaveBeenCalledTimes(1);
        expect(lookups).not.toHaveBeenCalled();
    });

    it('a Field ripening with a Composter pops the extra harvests; without one, nothing', () => {
        InventoryManager.addItem(SEED, 2);
        const plain = arrive('sl_field', { x: 300, y: 300 });
        const field = arrive('sl_field', AT);
        const composter = arrive('sl_composter', NEAR);
        expect(StationRecipe.setSelectedRecipe(plain, WHEAT)).toBe(true);
        expect(StationRecipe.setSelectedRecipe(field, WHEAT)).toBe(true);
        const { heard, off } = fired();
        tick(61000, 1000);
        off();
        expect(Fields.stageOf(field, getTokenType('sl_field'))).toBe(Fields.STAGE.RIPE);
        expect(Fields.stageOf(plain, getTokenType('sl_field'))).toBe(Fields.STAGE.RIPE);
        expect(heard).toEqual([{ instanceId: field.id, amount: 2, bonus: true, fromTokenId: composter.id }]);
    });

    it('a Field ripening during a catch-up pops nothing', () => {
        InventoryManager.addItem(SEED, 1);
        const field = arrive('sl_field', AT);
        arrive('sl_composter', NEAR);
        StationRecipe.setSelectedRecipe(field, WHEAT);
        const { heard, off } = fired();
        EventBus.setQuiet(true);
        tick(61000, 1000);
        off();
        expect(field.field.load).toBe(5);
        expect(heard).toEqual([]);
    });
});

describe('nothing on the mat changes', () => {
    it('reading the links leaves every Token\'s buffs as they were', () => {
        const field = arrive('sl_field', AT);
        const well = arrive('sl_well', NEAR);
        const before = TileModifiers.getTokenAggregator(field.id).version;
        SupportLinks.placementCandidates('sl_well', well.id);
        SupportLinks.boostedBy(field.id);
        SupportLinks.boosts(well.id);
        SupportLinks.floorHits(field.id);
        expect(TileModifiers.getTokenAggregator(field.id).version).toBe(before);
        expect(BoardState.tokens()).toHaveLength(2);
    });
});
