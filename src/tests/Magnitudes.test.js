import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import {
    MAGNITUDE_KIND, MAGNITUDE_STATS, getMagnitudeStat, statsForRoles,
    resolveMagnitude, usesCountedSelector
} from '../config/registries/magnitudeRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **Computed magnitudes** (Effects Grammar v2, V5 — G-13, G-14).
 *
 * A number may be typed, taken as a percentage of a named stat, or counted from
 * a second selector. A closed list of three, not arithmetic — so it still reads
 * as one honest sentence and still audits.
 */

const BUSH = 15;

function makeHero(id, hp = 100) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: hp, max: hp }, statuses: [],
        aggregator: new ModifierAggregator(id)
    };
}

function place(tile, typeId, heroId = null, uses = undefined) {
    const instance = BoardState.createTokenInstance(
        typeId, uses === undefined ? tokenStartingUses(typeId) : uses
    );
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const hp = (id) => HeroManager.getHero(id).hp.current;

/** A thorned producer whose damage is computed however the caller says. */
function thornedProducer(id, payload, counted = null) {
    registerEffects({
        [`effect_${id}`]: {
            id: `effect_${id}`, name: 'Computed Thorns',
            statements: [{
                ...makeStatement(KEYWORD.DEALS), id: `stm_${id}`,
                payload: { ignoresArmor: true, ...payload },
                ...(counted ? { counted } : {})
            }]
        }
    });
    registerTokenTypes({
        [id]: {
            id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture',
            uses: null, sprite: 'skill_nature',
            config: {
                skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
                inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
            },
            effects: [{ effectId: `effect_${id}` }]
        }
    });
    return id;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
});

describe('⭐ a percentage of a named stat', () => {
    it('scales with the target rather than being a fixed number', () => {
        thornedProducer('fixture_pct_thorns', {
            amount: 10, magnitude: MAGNITUDE_KIND.STAT, stat: 'actor_max_hp'
        });
        place(BUSH, 'fixture_pct_thorns', 'hero_1');

        run(13000);

        expect(hp('hero_1')).toBe(90);   // 10% of 100 max HP
    });

    it('follows the stat, so a tougher hero takes more', () => {
        thornedProducer('fixture_pct_thorns_b', {
            amount: 10, magnitude: MAGNITUDE_KIND.STAT, stat: 'actor_max_hp'
        });
        GameState.state.heroes = [makeHero('hero_1', 200)];
        place(BUSH, 'fixture_pct_thorns_b', 'hero_1');

        run(13000);

        expect(hp('hero_1')).toBe(180);   // 10% of 200
    });

    it('⚠️ an unreadable stat is ZERO, never the base number', () => {
        // "10% of the target's max HP" against nobody must do nothing, not fall
        // back to doing 10 damage. Swapping a percentage for a flat amount is
        // how a rule comes to mean something nobody authored.
        expect(resolveMagnitude(
            { amount: 10, magnitude: MAGNITUDE_KIND.STAT, stat: 'actor_max_hp' },
            { actorHero: null }
        )).toBe(0);
    });

    it('⚠️ reads unlimited charges as nothing, not as a large number', () => {
        // `null` is UNLIMITED (R-4). An unlimited Token has no "amount
        // remaining" to be a percentage of, and treating it as huge would make
        // it the strongest possible version of the effect.
        expect(resolveMagnitude(
            { amount: 50, magnitude: MAGNITUDE_KIND.STAT, stat: 'self_charges' },
            { selfInstance: { usesRemaining: null } }
        )).toBe(0);
        expect(resolveMagnitude(
            { amount: 50, magnitude: MAGNITUDE_KIND.STAT, stat: 'self_charges' },
            { selfInstance: { usesRemaining: 10 } }
        )).toBe(5);
    });
});

describe('⭐ a count of a second selector (G-14)', () => {
    it('counts one set while affecting another', () => {
        // "+1 damage per adjacent seafood Token" — the count is taken around the
        // BEARER, and the damage lands on the actor.
        thornedProducer('fixture_count_thorns',
            { amount: 1, magnitude: MAGNITUDE_KIND.COUNT },
            { mode: 'tag', value: 'seafood' });

        place(BUSH, 'fixture_count_thorns', 'hero_1');
        place(16, 'fixture_seafood_producer');
        place(14, 'fixture_seafood_producer');

        run(13000);

        expect(hp('hero_1')).toBe(98);   // two matches, 1 each
    });

    it('does nothing when the counted selector matches nothing', () => {
        thornedProducer('fixture_count_none',
            { amount: 1, magnitude: MAGNITUDE_KIND.COUNT },
            { mode: 'tag', value: 'nothing_has_this' });

        place(BUSH, 'fixture_count_none', 'hero_1');
        place(16, 'fixture_seafood_producer');

        run(13000);

        expect(hp('hero_1')).toBe(100);
    });

    it('multiplies the per-match amount', () => {
        expect(resolveMagnitude({ amount: 3, magnitude: MAGNITUDE_KIND.COUNT }, {}, 4)).toBe(12);
    });

    it('says which payloads need the second selector', () => {
        expect(usesCountedSelector({ magnitude: MAGNITUDE_KIND.COUNT })).toBe(true);
        expect(usesCountedSelector({ magnitude: MAGNITUDE_KIND.STAT })).toBe(false);
        expect(usesCountedSelector({})).toBe(false);
    });
});

describe('a flat magnitude is untouched', () => {
    it('still means the number typed', () => {
        expect(resolveMagnitude({ amount: 7 }, {})).toBe(7);
        expect(resolveMagnitude({ amount: 7, magnitude: MAGNITUDE_KIND.FLAT }, {})).toBe(7);
    });

    it('and a rule with no magnitude field behaves exactly as before', () => {
        thornedProducer('fixture_flat_thorns', { amount: 3 });
        place(BUSH, 'fixture_flat_thorns', 'hero_1');

        run(13000);

        expect(hp('hero_1')).toBe(97);
    });
});

describe('⭐ G-2 reaches the magnitude vocabulary too', () => {
    it('offers only stats whose role the moment supplies', () => {
        const withActor = statsForRoles([ROLE.SELF, ROLE.ACTOR]).map(s => s.id);
        expect(withActor).toContain('actor_max_hp');
        expect(withActor).toContain('self_charges');

        // A moment with no actor cannot offer a stat about one.
        const selfOnly = statsForRoles([ROLE.SELF]).map(s => s.id);
        expect(selfOnly).not.toContain('actor_max_hp');
        expect(selfOnly).toContain('self_charges');
    });

    it('gives every stat a label, a hint, a role and a reader', () => {
        for (const stat of MAGNITUDE_STATS) {
            expect(stat.label, stat.id).toBeTruthy();
            expect(stat.hint, stat.id).toBeTruthy();
            expect(stat.role, stat.id).toBeTruthy();
            expect(typeof stat.read, stat.id).toBe('function');
            expect(getMagnitudeStat(stat.id)).toBe(stat);
        }
    });
});

describe('the sentence says where the number came from (G-10)', () => {
    const deals = (payload, counted) => ({
        ...makeStatement(KEYWORD.DEALS), payload, ...(counted ? { counted } : {})
    });

    it('reads unchanged for a flat amount', () => {
        expect(renderStatement(deals({ amount: 1 })))
            .toBe("When this Token's own cycle completes, deals 1 damage to the actor.");
    });

    it('names the stat it is a percentage of', () => {
        expect(renderStatement(deals({ amount: 10, magnitude: 'stat', stat: 'actor_max_hp' })))
            .toBe("When this Token's own cycle completes, deals damage equal to 10% of the target's max HP to the actor.");
    });

    it('⚠️ keeps the number in front for a count — it is per-match, not "equal to"', () => {
        // The first version rendered a count as "equal to" and dropped the
        // number entirely: "damage equal to per adjacent Coast Token".
        expect(renderStatement(deals({ amount: 1, magnitude: 'count' }, { mode: 'tag', value: 'Coast' })))
            .toBe("When this Token's own cycle completes, deals 1 damage per adjacent Coast Token to the actor.");
    });

    it('says the counted set in the singular, because it follows "per"', () => {
        expect(renderStatement(deals({ amount: 2, magnitude: 'count' }, { mode: 'all', reach: 'board' })))
            .toContain('per Token on the board');
    });
});
