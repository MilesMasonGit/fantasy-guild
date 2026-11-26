import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../systems/effects/constants.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';

/**
 * The engine's per-tick lookups that are kept between ticks rather than worked out again: each must
 * drop what it kept the moment what it was worked out from changes.
 */

describe('who has claimed a Token follows every claim written', () => {
    beforeEach(() => {
        GameState.state = { board: { tokens: {}, nextTokenOrder: 0, flags: {}, nextFlagOrder: 0 }, heroes: [] };
    });

    const claim = (instanceId) => ({ instanceId, typeId: 'fixture_memo', x: 0, y: 0 });

    it('a claim made, moved and dropped', () => {
        expect(BoardState.heroOfInstance('tok_a')).toBeNull();
        BoardState.setClaim('hero_1', claim('tok_a'));
        expect(BoardState.heroOfInstance('tok_a')).toBe('hero_1');
        BoardState.setClaim('hero_1', claim('tok_b'));
        expect(BoardState.heroOfInstance('tok_a')).toBeNull();
        expect(BoardState.heroOfInstance('tok_b')).toBe('hero_1');
        BoardState.setClaim('hero_1', null);
        expect(BoardState.heroOfInstance('tok_b')).toBeNull();
    });

    it('two heroes on one Token: the first to claim it answers, then the other once the first lets go', () => {
        BoardState.setClaim('hero_1', claim('tok_a'));
        BoardState.setClaim('hero_2', claim('tok_a'));
        expect(BoardState.heroOfInstance('tok_a')).toBe('hero_1');
        BoardState.setClaim('hero_1', null);
        expect(BoardState.heroOfInstance('tok_a')).toBe('hero_2');
    });

    it('every claim cleared at once (Flags.reset)', () => {
        BoardState.setClaim('hero_1', claim('tok_a'));
        expect(BoardState.heroOfInstance('tok_a')).toBe('hero_1');
        Flags.reset();
        expect(BoardState.heroOfInstance('tok_a')).toBeNull();
    });

    it('a new board has its own claims', () => {
        BoardState.setClaim('hero_1', claim('tok_a'));
        expect(BoardState.heroOfInstance('tok_a')).toBe('hero_1');
        GameState.state = { board: { tokens: {}, nextTokenOrder: 0, flags: {}, nextFlagOrder: 0 }, heroes: [] };
        expect(BoardState.heroOfInstance('tok_a')).toBeNull();
    });
});

describe('a station\'s recipe pool follows the recipes and the Token types', () => {
    const station = (skill) => ({
        id: 'fixture_memo_station', name: 'Memo Station', tokenType: 'station', rarity: 'common', theme: 'fixture',
        uses: 100, config: { skill, skillRequired: 1, cycleTimeMs: 1000, xp: 1 },
        statements: [{ id: 'stm_fixture_memo_station', keyword: KEYWORD.STATION, payload: { skill } }]
    });
    const recipe = (id) => ({ id, name: id, inputs: [], outputs: [{ itemId: 'item_fixture_memo', chance: 100, minQty: 1, maxQty: 1 }], durationMs: 1000, xp: 1 });
    const ids = () => StationRecipe.poolFor(getTokenType('fixture_memo_station')).map(r => r.id);

    it('a recipe registered for its skill joins the pool, and a takeover with none empties it', () => {
        registerTokenTypes({ fixture_memo_station: station('memo_skill_a') });
        registerRecipePools({ memo_skill_a: [recipe('memo_r1')] });
        expect(ids()).toEqual(['memo_r1']);
        registerRecipePools({ memo_skill_a: [recipe('memo_r2')] }, { takeOver: false });
        expect(ids()).toEqual(['memo_r1', 'memo_r2']);
        // Beside the skill's own (it has none), then a takeover with no recipes: the pool empties
        // though the recipe list and the Token types are as they were.
        registerRecipePools({ memo_skill_b: [recipe('memo_r3')] }, { takeOver: false });
        registerTokenTypes({ fixture_memo_station: station('memo_skill_b') });
        expect(ids()).toEqual(['memo_r3']);
        registerRecipePools({ memo_skill_b: [] });
        expect(ids()).toEqual([]);
    });

    it('a Token type registered again with another skill draws the new skill\'s pool', () => {
        registerRecipePools({ memo_skill_c: [recipe('memo_r4')], memo_skill_d: [recipe('memo_r5')] });
        registerTokenTypes({ fixture_memo_station: station('memo_skill_c') });
        expect(ids()).toEqual(['memo_r4']);
        registerTokenTypes({ fixture_memo_station: station('memo_skill_d') });
        expect(ids()).toEqual(['memo_r5']);
    });

    it('the same definition edited in place and registered again', () => {
        registerRecipePools({ memo_skill_e: [recipe('memo_r6')], memo_skill_f: [recipe('memo_r7')] });
        const def = station('memo_skill_e');
        registerTokenTypes({ fixture_memo_station: def });
        expect(ids()).toEqual(['memo_r6']);
        const registered = getTokenType('fixture_memo_station');
        registered.statements = [{ id: 'stm_fixture_memo_station', keyword: KEYWORD.STATION, payload: { skill: 'memo_skill_f' } }];
        registerTokenTypes({ fixture_memo_station: registered });
        expect(ids()).toEqual(['memo_r7']);
    });

    it('the pool handed out is shared and cannot be changed', () => {
        registerRecipePools({ memo_skill_g: [recipe('memo_r8')] });
        registerTokenTypes({ fixture_memo_station: station('memo_skill_g') });
        const pool = StationRecipe.poolFor(getTokenType('fixture_memo_station'));
        expect(StationRecipe.poolFor(getTokenType('fixture_memo_station'))).toBe(pool);
        expect(Object.isFrozen(pool)).toBe(true);
    });
});

describe('which axes an aggregator holds follows every modifier added and removed', () => {
    const mod = (source, type, value = 0.1) => ({ source, type, value, bucket: 'percentage', target: { category: TARGET_CATEGORIES.ALL } });

    it('added, removed by source and cleared', () => {
        const agg = new ModifierAggregator('memo');
        expect(agg.hasType(EFFECT_TYPES.WORK_TIME)).toBe(false);
        agg.addModifier(mod('a', EFFECT_TYPES.WORK_TIME));
        expect(agg.hasType(EFFECT_TYPES.WORK_TIME)).toBe(true);
        expect(agg.hasType(EFFECT_TYPES.YIELD)).toBe(false);
        agg.addModifier(mod('b', EFFECT_TYPES.YIELD));
        expect(agg.hasType(EFFECT_TYPES.YIELD)).toBe(true);
        agg.removeModifiersBySource('a');
        expect(agg.hasType(EFFECT_TYPES.WORK_TIME)).toBe(false);
        expect(agg.hasType(EFFECT_TYPES.YIELD)).toBe(true);
        agg.clearAll();
        expect(agg.hasType(EFFECT_TYPES.YIELD)).toBe(false);
    });

    it('a Token axis reads a modifier the moment it arrives, and its authored value once it goes', () => {
        GameState.state = { board: { tokens: {}, nextTokenOrder: 0, flags: {}, nextFlagOrder: 0 }, heroes: [] };
        TileModifiers.clearAll();
        const agg = TileModifiers.getTokenAggregator('tok_memo');
        agg.addModifier(mod('a', EFFECT_TYPES.YIELD));
        expect(TileModifiers.resolveAxis('tok_memo', EFFECT_TYPES.WORK_TIME, 1000)).toBe(1000);
        agg.addModifier(mod('b', EFFECT_TYPES.WORK_TIME, -0.25));
        expect(TileModifiers.resolveAxis('tok_memo', EFFECT_TYPES.WORK_TIME, 1000)).toBe(750);
        agg.removeModifiersBySource('b');
        expect(TileModifiers.resolveAxis('tok_memo', EFFECT_TYPES.WORK_TIME, 1000)).toBe(1000);
    });
});
