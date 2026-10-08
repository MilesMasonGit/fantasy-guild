import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, getKeyword, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import {
    REACH, REACHES, DEFAULT_REACH, reachOf, reachCovers, RELATION, getReach
} from '../config/registries/reachRegistry.js';

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * spots 15 and 16 are 160 u apart and spot 33 is near neither.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** Which spot a Token stands on, by instance id. */
const spotOf = (id) => {
    const instance = BoardState.getTokenById(id);
    if (!instance) return null;
    return Math.round((instance.y - 200) / 160) * 6 + Math.round((instance.x - 400) / 160);
};

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **How far a rule reaches** (Effects Robustness P2).
 */

// 15 and 16 are neighbours. 33 is near neither.
const A = 15, NEIGHBOUR = 16, FAR = 33;

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, C(tile));
    TileModifiers.rebuildAround([instance]);
    if (heroId) Placement.plantFlagAt(heroId, C(tile));
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

/** A producer that also buffs its own yield, at whatever reach the caller says. */
function selfBuffingProducer(id, reach) {
    registerTokenTypes({
        [id]: {
            id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture',
            uses: null, sprite: 'skill_nature',
            config: {
                skill: 'forestry', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
                inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 2, chance: 100 }]
            },
            statements: [{
                id: `stm_${id}`, keyword: 'provides', reach,
                to: { mode: 'all', value: '' },
                payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 1.0 }  // +100%
            }]
        }
    });
    return id;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TriggerSystem.resetCascadeGuard();
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    TriggerSystem.teardown();
});

describe('⭐ a Token can finally affect itself', () => {
    it('doubles its OWN yield at self reach — the thing that was impossible', () => {
        selfBuffingProducer('fixture_self_buff', REACH.SELF);
        place(A, 'fixture_self_buff', 'hero_1');

        run(13000);

        // Base yield is 2; the Token's own +100% makes it 4.
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(4);
    });

    it('leaves its neighbours alone at self reach', () => {
        selfBuffingProducer('fixture_self_only', REACH.SELF);
        place(A, 'fixture_self_only');            // unstaffed: contributes only its rule
        place(NEIGHBOUR, 'fixture_producer', 'hero_1');

        run(13000);

        // `fixture_producer` yields 2 and must not be touched by a self-reach rule.
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);
    });

    it('reaches both at self_and_nearby', () => {
        selfBuffingProducer('fixture_both', REACH.SELF_AND_NEARBY);
        place(A, 'fixture_both', 'hero_1');
        place(NEIGHBOUR, 'fixture_producer', 'hero_2');

        run(13000);

        // 4 from the buffed self (2 × 2), 4 from the buffed neighbour (2 × 2).
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(8);
    });
});

describe('⚠️ nothing authored before P2 moved (ER-5)', () => {
    it('a rule with NO reach field still reaches its neighbours', () => {
        // ⚠️ Deliberately a LARGE buff written in the pre-P2 shape — no `reach`
        // key at all. A small one would round to the same number as no buff and
        // the test would pass while proving nothing.
        registerTokenTypes({
            fixture_legacy_shape_buff: {
                id: 'fixture_legacy_shape_buff', name: 'Legacy Shape Buff', tokenType: 'buff',
                rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_occult',
                statements: [{
                    id: 'stm_legacy_shape', keyword: 'provides',
                    to: { mode: 'all', value: '' },
                    payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 1.0 }
                }]
            }
        });

        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_legacy_shape_buff');

        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(4);   // 2 × (1 + 1)
    });

    it('and does not reach itself, which is what "nearby" has always meant', () => {
        selfBuffingProducer('fixture_no_reach_field', undefined);
        place(A, 'fixture_no_reach_field', 'hero_1');

        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);   // unbuffed
    });

    it('resolves an absent reach to nearby rather than to nothing', () => {
        expect(reachOf({})).toBe(REACH.NEARBY);
        expect(reachOf(null)).toBe(REACH.NEARBY);
        expect(DEFAULT_REACH).toBe(REACH.NEARBY);
    });

    it('resolves a REACH THAT DOES NOT EXIST to nearby, not to silence', () => {
        // A typo must leave the rule doing something explicable, not switch it
        // off — `ContentAudit` is what tells the author, not the runtime.
        expect(reachOf({ reach: 'the_whole_kingdom' })).toBe(REACH.NEARBY);
    });
});

describe('board reach carries across the whole playmat', () => {
    it('buffs a Token nowhere near it', () => {
        selfBuffingProducer('fixture_board_buff', REACH.BOARD);
        place(A, 'fixture_board_buff');
        place(FAR, 'fixture_producer', 'hero_1');

        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(4);
    });

    it('includes the Token carrying it — "every Token" is not "every other"', () => {
        selfBuffingProducer('fixture_board_self', REACH.BOARD);
        place(A, 'fixture_board_self', 'hero_1');

        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(4);
    });

    it('⚠️ stacks uncapped from two copies, exactly as ER-16 accepted', () => {
        // Recorded as a test so a later balance surprise reads as a decision
        // rather than as a bug. Two board-wide +100% buffs give +200%.
        selfBuffingProducer('fixture_board_stack', REACH.BOARD);
        place(A, 'fixture_board_stack');
        place(FAR, 'fixture_board_stack');
        place(20, 'fixture_producer', 'hero_1');

        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(6);   // 2 × (1 + 1 + 1)
    });

    it('still respects the filter — reach is how far, not which', () => {
        registerTokenTypes({
            fixture_board_tagged: {
                id: 'fixture_board_tagged', name: 'Board Tagged', tokenType: 'buff',
                rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_industry',
                statements: [{
                    id: 'stm_board_tagged', keyword: 'provides', reach: REACH.BOARD,
                    to: { mode: 'tag', value: 'seafood' },
                    payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 1.0 }
                }]
            }
        });

        place(A, 'fixture_board_tagged');
        place(FAR, 'fixture_producer', 'hero_1');           // untagged — must not benefit

        run(13000);

        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);
    });
});

describe('a firing rule reaches as far as it says (the outbound side)', () => {
    it('grants to itself at self reach', () => {
        registerTokenTypes({
            fixture_self_grant: {
                id: 'fixture_self_grant', name: 'Self Grant', tokenType: 'buff',
                rarity: 'rare', theme: 'fixture', uses: null, sprite: 'skill_industry',
                statements: [{
                    id: 'stm_self_grant', keyword: 'grants', reach: REACH.SELF,
                    to: { mode: 'all', value: '' },
                    when: { event: 'CYCLE_COMPLETE', scope: 'nearby', cooldownMs: 0 },
                    payload: { type: 'BONUS_DROP', itemId: 'fixture_charcoal', chance: 100, quantity: 1 }
                }]
            }
        });
        TriggerSystem.init();

        const addSprite = vi.spyOn(SpriteLayer, 'addSprite');
        place(A, 'fixture_producer', 'hero_1');
        place(NEIGHBOUR, 'fixture_self_grant');

        run(13000);

        const addressed = addSprite.mock.calls
            .filter(([kind, refId]) => kind === 'item' && refId === 'fixture_charcoal')
            // A sprite's source is a Token instance id since Free Playmat 1.6b.
            .map(([, , , source]) => spotOf(source));
        expect(addressed).toEqual([NEIGHBOUR]);   // the granter itself
        addSprite.mockRestore();
    });
});

describe('the vocabulary is declared, and legality with it', () => {
    it('offers exactly the four rows ER-1 named, each with a hint', () => {
        expect(REACHES.map(r => r.id)).toEqual([
            REACH.NEARBY, REACH.SELF, REACH.SELF_AND_NEARBY, REACH.BOARD
        ]);
        for (const row of REACHES) {
            expect(row.label).toBeTruthy();
            expect(row.hint).toBeTruthy();
            expect(getReach(row.id)).toBe(row);
        }
    });

    it('declares reach only on the keywords that can honour one (ER-6)', () => {
        for (const id of [KEYWORD.PROVIDES, KEYWORD.GRANTS, KEYWORD.APPLIES]) {
            expect(getKeyword(id).reach).toBe(true);
        }
        // `Requires`/`Works as` are about this Token; `Acts as`/`Restocks` have
        // no filter to go with a reach; `Converts` names one destination; and
        // `Cannot` is a placement rule with its own reader.
        for (const id of [KEYWORD.REQUIRES, KEYWORD.STATION, KEYWORD.ACTS_AS,
            KEYWORD.RESTOCKS, KEYWORD.CONVERTS, KEYWORD.CANNOT]) {
            expect(getKeyword(id).reach).toBeFalsy();
        }
    });

    it('starts a new statement at nearby, and only where reach is legal', () => {
        expect(makeStatement(KEYWORD.PROVIDES).reach).toBe(REACH.NEARBY);
        expect(makeStatement(KEYWORD.APPLIES).reach).toBe(REACH.NEARBY);
        expect(makeStatement(KEYWORD.CONVERTS).reach).toBeNull();
        expect(makeStatement(KEYWORD.REQUIRES).reach).toBeNull();
    });

    it('turns a reach and a relation into one yes-or-no, in one place', () => {
        expect(reachCovers(REACH.SELF, RELATION.SELF)).toBe(true);
        expect(reachCovers(REACH.SELF, RELATION.NEARBY)).toBe(false);
        expect(reachCovers(REACH.NEARBY, RELATION.SELF)).toBe(false);
        expect(reachCovers(REACH.NEARBY, RELATION.NEARBY)).toBe(true);
        expect(reachCovers(REACH.NEARBY, RELATION.DISTANT)).toBe(false);
        expect(reachCovers(REACH.SELF_AND_NEARBY, RELATION.SELF)).toBe(true);
        expect(reachCovers(REACH.SELF_AND_NEARBY, RELATION.NEARBY)).toBe(true);
        expect(reachCovers(REACH.SELF_AND_NEARBY, RELATION.DISTANT)).toBe(false);
        for (const relation of Object.values(RELATION)) {
            expect(reachCovers(REACH.BOARD, relation)).toBe(true);
        }
    });
});

describe('the sentence says how far', () => {
    const provides = (reach, to) => ({
        ...makeStatement(KEYWORD.PROVIDES), reach, to,
        payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 }
    });
    const all = { mode: 'all', value: '' };
    const coast = { mode: 'tag', value: 'Coast' };

    it('reads unchanged for nearby, so no shipped rules text moved', () => {
        expect(renderStatement(provides(REACH.NEARBY, all)))
            .toBe('Provides 10% more yield to every nearby Token.');
        expect(renderStatement(provides(undefined, all)))
            .toBe('Provides 10% more yield to every nearby Token.');
        expect(renderStatement(provides(REACH.NEARBY, coast)))
            .toBe('Provides 10% more yield to nearby Coast Tokens.');
    });

    it('names this Token, and drops the filter that would mean nothing', () => {
        expect(renderStatement(provides(REACH.SELF, all)))
            .toBe('Provides 10% more yield to this Token.');
        // A filter cannot narrow a set of one, so the words do not pretend it can.
        expect(renderStatement(provides(REACH.SELF, coast)))
            .toBe('Provides 10% more yield to this Token.');
    });

    it('fuses reach and filter into one clause rather than two', () => {
        expect(renderStatement(provides(REACH.BOARD, all)))
            .toBe('Provides 10% more yield to every Token on the board.');
        expect(renderStatement(provides(REACH.BOARD, coast)))
            .toBe('Provides 10% more yield to every Coast Token on the board.');
        expect(renderStatement(provides(REACH.SELF_AND_NEARBY, all)))
            .toBe('Provides 10% more yield to this Token and every nearby Token.');
        expect(renderStatement(provides(REACH.SELF_AND_NEARBY, coast)))
            .toBe('Provides 10% more yield to this Token and nearby Coast Tokens.');
    });

    it('says who a status lands on, in the person the reach implies', () => {
        const applies = (reach) => ({
            ...makeStatement(KEYWORD.APPLIES), reach, to: { mode: 'tag', value: 'Coast' },
            payload: { statusId: 'well_fed', stacks: 1, chance: 100 }
        });

        expect(renderStatement(applies(REACH.NEARBY)))
            .toBe('Applies Well Fed to heroes on nearby Coast Tokens when they finish work.');
        // Singular: one Token holds at most one hero.
        expect(renderStatement(applies(REACH.SELF)))
            .toBe('Applies Well Fed to the hero working this Token when they finish work.');
        expect(renderStatement(applies(REACH.BOARD)))
            .toBe('Applies Well Fed to heroes on every Coast Token on the board when they finish work.');
    });
});
