import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Managers from '../systems/board/Managers.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses, getTokenType, getProvidedTagsWithTiers } from '../config/registries/tokenRegistry.js';
import { deriveTokenType } from '../config/registries/tokenTypeDerivation.js';
import { OUTPUT_CURRENCIES, isOutputCurrency } from '../config/registries/tokenConstants.js';
import { renderStatement, rulesLinesOf } from '../systems/effects/statementText.js';
import {
    KEYWORD, KEYWORDS, WHEN, getKeyword, makeStatement, paletteForKeyword,
    statementsOf, hasRetiredEffectData
} from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { tickUpkeep, isStatementPaid } from '../systems/board/BlockUpkeep.js';

/**
 * The statement grammar — the shape that replaced effect blocks.
 *
 * These tests hold the three claims the redesign rests on:
 *
 * 1. **The sentence is the rule.** A statement renders to words, and a wrong
 *    statement renders to wrong words rather than to nothing.
 * 2. **Position no longer means anything.** Reordering a Token's rules must not
 *    move a live save's upkeep or cooldown state onto a different rule.
 * 3. **Illegal combinations cannot be authored.** The palette declares which
 *    effects survive a trigger, so the six that used to be silently dropped
 *    inside a Reaction are simply not offered there.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const names = {
    token: id => ({ token_forge: 'Forge', fixture_producer: 'Fixture Producer' }[id] || id),
    item: id => ({ item_coal: 'Coal', item_copper_ore: 'Copper Ore', item_charcoal: 'Charcoal' }[id] || id)
};

describe('The rules text is the rule, rendered', () => {
    it('writes the owner\'s worked example as a sentence', () => {
        const statement = {
            id: 'stm_1', keyword: KEYWORD.PROVIDES,
            to: { mode: 'tag', value: 'Coast' },
            payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.05 }
        };
        expect(renderStatement(statement, names))
            .toBe('Provides 5% less work time to adjacent Coast Tokens.');
    });

    it('says the opposite when the sign is the wrong way round', () => {
        // The live bug on the Forge Altar: +0.2 on Work Time makes the Forge
        // SLOWER, while the old generator described it as "+20% Speed". The
        // point of generated text is that this mistake now reads as a mistake.
        const statement = {
            id: 'stm_2', keyword: KEYWORD.PROVIDES,
            to: { mode: 'id', value: 'token_forge' },
            payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: 0.2 }
        };
        expect(renderStatement(statement, names))
            .toBe('Provides 20% more work time to any adjacent Forge.');
    });

    it('renders every other keyword too', () => {
        const say = (keyword, extra) => renderStatement({ id: 'x', keyword, ...extra }, names);

        expect(say(KEYWORD.ACTS_AS, { payload: { tag: 'pickaxe', tier: 2 } }))
            .toBe('Acts as a Tier 2 pickaxe for adjacent stations.');

        expect(say(KEYWORD.REQUIRES, { payload: { tag: 'pickaxe', minTier: 1 } }))
            .toBe('Requires an adjacent Tier 1 pickaxe.');

        expect(say(KEYWORD.RESTOCKS, { payload: { tokenIds: ['fixture_producer'] } }))
            .toBe('Restocks adjacent Fixture Producer from the Guild Bank.');

        expect(say(KEYWORD.GRANTS, {
            to: { mode: 'all' },
            payload: { type: EFFECT_TYPES.BONUS_DROP, itemId: 'item_copper_ore', quantity: 2, chance: 25 }
        })).toBe('Grants 2 Copper Ore to every adjacent Token when they finish work, 25% of the time.');
    });

    it('leads with the trigger, and ends with the cost', () => {
        const sigil = {
            id: 'stm_sigil', keyword: KEYWORD.CONVERTS,
            when: { event: 'ITEM_THRESHOLD', scope: 'global', watchItemId: 'item_coal', threshold: 20, cooldownMs: 5000 },
            payload: { consumes: [{ itemId: 'item_coal', quantity: 20 }], produces: [{ itemId: 'item_charcoal', quantity: 2 }] }
        };
        expect(renderStatement(sigil, names)).toBe(
            'When the Bank holds at least 20 Coal, converts 20 Coal into 2 Charcoal, at most once every 5 seconds.'
        );

        const costed = {
            id: 'stm_costed', keyword: KEYWORD.PROVIDES,
            to: { mode: 'all' },
            payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 },
            upkeep: { items: [{ itemId: 'item_coal', quantity: 1 }], cadenceMs: 30000 }
        };
        expect(renderStatement(costed, names)).toBe(
            'Provides 10% more yield to every adjacent Token, costing 1 Coal every 30 seconds.'
        );
    });

    it('shows a blank as a blank rather than hiding it', () => {
        const half = makeStatement(KEYWORD.ACTS_AS);
        expect(renderStatement(half)).toBe('Acts as … for adjacent stations.');
    });

    it('renders acceptedTokens alongside the statements, as one list', () => {
        // Owner decision Q5: the field stays exactly where it is, because it
        // gates whether a station produces at all. Only its presentation moves.
        const def = {
            acceptedTokens: [{ tag: 'pickaxe', minTier: 1 }],
            statements: [{
                id: 'a', keyword: KEYWORD.PROVIDES, to: { mode: 'all' },
                payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 }
            }]
        };
        expect(rulesLinesOf(def, names)).toEqual([
            'Requires an adjacent Tier 1 pickaxe.',
            'Provides 10% more yield to every adjacent Token.'
        ]);
    });
});

describe('Legality — the editor cannot offer what nothing reads', () => {
    it('never lets an ambient number effect take a trigger', () => {
        expect(getKeyword(KEYWORD.PROVIDES).when).toBe(WHEN.NEVER);
        // …which is the other half of bug B3: a Yield modifier on a Reaction
        // block was read by neither TileModifiers nor TriggerSystem.
        expect(paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type))
            .not.toContain(EFFECT_TYPES.CONVERT);
        // …and the item-carrying shapes have their own keywords, so Provides
        // does not offer a second way to author them.
        expect(paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type))
            .not.toContain(EFFECT_TYPES.BONUS_DROP);
    });

    it('insists a conversion has a firing moment', () => {
        expect(getKeyword(KEYWORD.CONVERTS).when).toBe(WHEN.REQUIRED);
        expect(makeStatement(KEYWORD.CONVERTS).when?.event).toBeTruthy();
    });

    it('gives each keyword only the effects it can carry', () => {
        expect(paletteForKeyword(KEYWORD.GRANTS).map(e => e.type)).toEqual([EFFECT_TYPES.BONUS_DROP]);
        expect(paletteForKeyword(KEYWORD.CONVERTS).map(e => e.type)).toEqual([EFFECT_TYPES.CONVERT]);
        expect(paletteForKeyword(KEYWORD.ACTS_AS)).toEqual([]);
    });

    it('gives every keyword a filter answer, so the editor never guesses', () => {
        for (const keyword of KEYWORDS) {
            expect(typeof keyword.filter).toBe('boolean');
            expect([WHEN.NEVER, WHEN.OPTIONAL, WHEN.REQUIRED]).toContain(keyword.when);
        }
    });
});

describe('⚠️ Reordering rules must not move a save\'s state onto a different rule', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
    });

    it('keys upkeep by the statement id, not its position', () => {
        const def = {
            statements: [
                { id: 'stm_first', keyword: KEYWORD.PROVIDES, to: { mode: 'all' },
                  payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 },
                  upkeep: { items: [{ itemId: 'item_coal', quantity: 1 }], cadenceMs: 1000 } },
                { id: 'stm_second', keyword: KEYWORD.PROVIDES, to: { mode: 'all' },
                  payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 } }
            ]
        };
        const instance = { typeId: 'x' };

        // Nothing in the Bank, so the first statement lapses.
        tickUpkeep(instance, def, 1000);
        expect(isStatementPaid(instance, 'stm_first')).toBe(false);
        expect(isStatementPaid(instance, 'stm_second')).toBe(true);

        // Reorder the rules, exactly as the CMS now encourages. Under the old
        // positional keys this is the moment the lapse jumped to the other rule.
        def.statements.reverse();
        expect(isStatementPaid(instance, 'stm_first')).toBe(false);
        expect(isStatementPaid(instance, 'stm_second')).toBe(true);
    });

    it('drops retired positional keys rather than guessing which rule they meant', () => {
        const def = {
            statements: [{
                id: 'stm_only', keyword: KEYWORD.PROVIDES, to: { mode: 'all' },
                payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 },
                upkeep: { items: [{ itemId: 'item_coal', quantity: 1 }], cadenceMs: 1000 }
            }]
        };
        // A save written before this change: `{0: {paid: false}}`.
        const instance = { typeId: 'x', blockUpkeep: { 0: { elapsedMs: 0, paid: false } } };

        tickUpkeep(instance, def, 1);
        expect(instance.blockUpkeep['0']).toBeUndefined();
        expect(isStatementPaid(instance, 'stm_only')).toBe(true);
    });
});

describe('Restocks — the field that never had a box (owner Q6)', () => {
    beforeEach(() => {
        GameState.initNew();
        BoardState.init?.();
        SpriteLayer.init();
        TileModifiers.clearAll();
    });

    it('makes a Manager out of a Restocks statement', () => {
        expect(Managers.isManager('fixture_restocker')).toBe(true);
        expect(Managers.managedTypes('fixture_restocker')).toEqual(['fixture_producer']);
    });

    it('still understands the legacy `manages` list', () => {
        expect(Managers.managedTypes('fixture_manager')).toEqual(['fixture_producer']);
    });

    it('actually restocks a vacancy from the Bank', () => {
        const TILE = 17, MANAGER_TILE = 18;
        Placement.placeToken(MANAGER_TILE, BoardState.createTokenInstance(
            'fixture_restocker', tokenStartingUses('fixture_restocker')
        ));
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5));
        BoardState.setVacancy(TILE, 'fixture_producer');

        expect(Managers.sweep()).toBe(1);
        expect(BoardState.getToken(TILE)?.typeId).toBe('fixture_producer');
    });
});

describe('Acts as — one capability channel', () => {
    it('reads the tool tier off the statement', () => {
        const def = {
            tier: 1,
            statements: [{ id: 's', keyword: KEYWORD.ACTS_AS, payload: { tag: 'pickaxe', tier: 2 } }]
        };
        expect(getProvidedTagsWithTiers(def)).toEqual({ pickaxe: 2 });
    });

    it('falls back to the Token tier when the statement names none', () => {
        const def = {
            tier: 3,
            statements: [{ id: 's', keyword: KEYWORD.ACTS_AS, payload: { tag: 'anvil' } }]
        };
        expect(getProvidedTagsWithTiers(def)).toEqual({ anvil: 3 });
    });

    it('still reads a legacy top-level provides list', () => {
        expect(getProvidedTagsWithTiers(getTokenType('fixture_pickaxe_t2'))).toEqual({ pickaxe: 2 });
    });
});

describe('The Token type is read off the rules, never picked', () => {
    const derive = def => deriveTokenType(def).type;

    it('walks the ladder in order', () => {
        expect(derive({ enemyId: 'enemy_x' })).toBe('enemy');
        expect(derive({ mapId: 'map_x' })).toBe('map');
        expect(derive({ statements: [{ keyword: KEYWORD.STATION, payload: { skill: 'cooking' } }] })).toBe('station');
        expect(derive({ statements: [{ keyword: KEYWORD.RESTOCKS, payload: { tokenIds: ['a'] } }] })).toBe('manager');
        expect(derive({ statements: [{ keyword: KEYWORD.ACTS_AS, payload: { tag: 'axe' } }] })).toBe('context');
        expect(derive({ config: { outputs: [{ itemId: 'o' }] } })).toBe('resource');
        expect(derive({ config: { outputs: [{ itemId: 'o' }] }, requiresHero: false })).toBe('passive');
        expect(derive({
            statements: [{ keyword: KEYWORD.PROVIDES, payload: { type: 'YIELD', bucket: 'percentage', value: 0.1 } }]
        })).toBe('buff');
    });

    it('reads a Market off a currency output (D-141)', () => {
        expect(derive({ config: { inputs: [{ itemId: 'i' }], outputs: [{ currency: 'gold', quantity: 5 }] } }))
            .toBe('market');
    });

    it('a Market outranks the rules-based rungs, so a Market that lends a tool is still a Market', () => {
        // Minting currency is the most distinctive thing a Token can do. Before
        // the currency output was authorable this Token filed itself as a
        // `context` and the Market rung was unreachable.
        expect(derive({
            config: { inputs: [{ itemId: 'i' }], outputs: [{ currency: 'gold', minQty: 1, maxQty: 4 }] },
            statements: [{ keyword: KEYWORD.ACTS_AS, payload: { tag: 'scales' } }]
        })).toBe('market');
    });

    it('says what is missing when a Token is filed as a Market but sells nothing', () => {
        const { type, why, warn } = deriveTokenType({
            tokenType: 'market',
            config: { inputs: [{ itemId: 'item_raw_shrimp', quantity: 1 }], outputs: [] }
        });
        expect(type).toBe('market');
        expect(warn).toBe(true);
        // The fix is nameable now, so the warning names it.
        expect(why).toContain('Gold');
    });

    it('only offers currencies the game actually declares', () => {
        expect(OUTPUT_CURRENCIES.map(c => c.id)).toEqual(['gold']);
        expect(isOutputCurrency('gold')).toBe(true);
        // Anything the game has not declared is rejected, so a stray id in
        // content cannot quietly invent a currency.
        expect(isOutputCurrency('gems')).toBe(false);
    });

    it('says out loud when a Token does nothing at all', () => {
        const { type, why, warn } = deriveTokenType({ name: 'Empty' });
        expect(type).toBe('buff');
        expect(warn).toBe(true);
        expect(why).toContain('does nothing');
    });
});

describe('Old-shape content breaks visibly, never silently', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        TileModifiers.clearAll();
    });

    it('recognises the retired shapes for what they are', () => {
        expect(hasRetiredEffectData(getTokenType('fixture_buff_hero'))).toBe(true);
        expect(hasRetiredEffectData(getTokenType('fixture_buff_yield'))).toBe(false);
        expect(statementsOf(getTokenType('fixture_buff_hero'))).toEqual([]);
    });

    it('contributes nothing from an old-shape Token rather than half-reading it', () => {
        const TILE = 17, NEIGHBOUR = 18;
        Placement.placeToken(NEIGHBOUR, BoardState.createTokenInstance('fixture_buff_hero', null));
        TileModifiers.rebuildAround(NEIGHBOUR);
        expect(TileModifiers.resolveAxis(TILE, EFFECT_TYPES.HP_REGEN, 10)).toBe(10);
    });
});
