import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Charges from '../systems/board/Charges.js';
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
import { getTriggerEvent, TRIGGER_EVENTS } from '../config/registries/triggerRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * * **"Leave a Stump behind when this depletes"** (Effects Grammar v2, V7b).
 *
 * The motivating case for `Spawns` and `Transforms`, and the one item the code
 * review left open. It was unauthorable in its natural form for two separate
 * reasons, and both had to go:
 *
 * 1. `TOKEN_DEPLETED` existed with an **ADJACENT scope only**, so a Token could
 *    hear a neighbour run out of charges and never itself.
 * 2. `destroyToken` empties the tile *before* publishing, so even with the
 *    scope, a self-scoped handler asking the board what is standing there gets
 *    `null` and does nothing.
 *
 * WARNING: emptying first is CORRECT and is not what was fixed. It is what makes
 * the square free for a `Spawns here` to take. What was missing is that the
 * departing instance had no way to be found, so it now rides on the event.
 *
 * WARNING: the charge ledger is already closed at this moment. A rule here
 * neither pays a charge nor is gated on having one - without that, every rule on
 * the moment would be refused for being unable to afford itself.
 */

const TILE = 15;

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: 100, max: 100 }, statuses: [], effects: [],
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

/** Author a library effect that reacts to its bearer running out. */
function onDepletion(id, statement) {
    registerEffects({
        [id]: {
            id, name: id,
            statements: [{
                id: `stm_${id}`,
                ...statement,
                // ⚠️ AFTER the spread: `makeStatement` stamps a default moment,
                // so a `when` written above it is silently overwritten and the
                // rule quietly ends up on `SELF_CYCLE_COMPLETE` instead.
                when: { event: 'SELF_TOKEN_DEPLETED', scope: 'self', cooldownMs: 0 }
            }]
        }
    });
    return id;
}

/**
 * A one-charge Token that leaves something behind.
 *
 * `uses: 1` is the whole point: it is the shape the review found broken, and a
 * Token with charges to spare would not exercise the ordering at all.
 */
function saplingThatBecomes(id, effectId, uses = 1) {
    registerTokenTypes({
        [id]: {
            id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture',
            uses, sprite: 'skill_nature',
            config: {
                skill: 'logging', skillRequired: 1, cycleTimeMs: 1000, xp: 1,
                inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
            },
            effects: [{ effectId }]
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

describe('the moment exists and declares itself', () => {
    it('is a self-scoped moment on the depletion event', () => {
        const trigger = getTriggerEvent('SELF_TOKEN_DEPLETED');
        expect(trigger).toBeTruthy();
        expect(trigger.scopes).toEqual(['self']);
        expect(trigger.roles).toContain(ROLE.SELF);
    });

    it('leaves the adjacent moment alone', () => {
        // A Token hearing a NEIGHBOUR run out is a different rule and still
        // exists. Widening the old entry's scopes instead of adding this one
        // would have silently retargeted every rule already authored on it.
        const adjacent = getTriggerEvent('TOKEN_DEPLETED');
        expect(adjacent.scopes).toEqual(['adjacent']);
    });

    it('says the charge ledger is already closed', () => {
        expect(getTriggerEvent('SELF_TOKEN_DEPLETED').settled).toBe(true);
        // And it is the only moment that claims that, because it is the only one
        // that fires after its bearer has left the board.
        const settled = TRIGGER_EVENTS.filter(t => t.settled).map(t => t.id);
        expect(settled).toEqual(['SELF_TOKEN_DEPLETED']);
    });

    it('reads as a sentence a person would write', () => {
        const sentence = renderStatement({
            ...makeStatement(KEYWORD.SPAWNS),
            payload: { typeId: 'fixture_producer', placement: PLACEMENT.HERE },
            when: { event: 'SELF_TOKEN_DEPLETED', scope: 'self' }
        });
        expect(sentence.toLowerCase()).toContain('last charge');
    });
});

describe('* a one-charge Token leaves something behind', () => {
    it('spawns onto its own square as it goes', () => {
        onDepletion('effect_stump', {
            ...makeStatement(KEYWORD.SPAWNS),
            payload: { typeId: 'fixture_producer', placement: PLACEMENT.HERE }
        });
        const sapling = saplingThatBecomes('fixture_sapling', 'effect_stump');

        place(TILE, sapling, 'hero_1');
        run(3000);

        const left = BoardState.getToken(TILE);
        expect(left, 'the tile is empty - nothing took the Sapling place').toBeTruthy();
        expect(left.typeId).toBe('fixture_producer');
    });

    it('WARNING: and the replacement is not then destroyed by the charge delta', () => {
        // The Sapling has zero charges left at this moment. Charging it again
        // would run a delta against a discarded object standing where its
        // replacement now is - and `applyDelta` destroys at zero by emptying the
        // TILE, taking the new Token with it. That failure looks exactly like
        // the spawn never happening.
        onDepletion('effect_stump_b', {
            ...makeStatement(KEYWORD.SPAWNS),
            payload: { typeId: 'fixture_producer', placement: PLACEMENT.HERE }
        });
        const sapling = saplingThatBecomes('fixture_sapling_b', 'effect_stump_b');

        place(TILE, sapling, 'hero_1');
        run(3000);

        const left = BoardState.getToken(TILE);
        expect(left).toBeTruthy();
        expect(left.usesRemaining).toBe(tokenStartingUses('fixture_producer'));
    });

    it('WARNING: fires even though the Token cannot afford a charge', () => {
        // A statement authoring no `chargeDelta` spends one, and the gate refuses
        // a statement the Token cannot pay for. At depletion it can never pay,
        // so without the settled reading every rule on this moment is refused -
        // silently, and identically to having authored nothing.
        onDepletion('effect_costly', {
            ...makeStatement(KEYWORD.SPAWNS),
            payload: { typeId: 'fixture_producer', placement: PLACEMENT.HERE },
            // ⚠️ On the STATEMENT, not the payload — `statementChargeDelta`
            // reads it here, and buried in the payload it would be ignored and
            // the test would pass without proving anything.
            chargeDelta: -3
        });
        const sapling = saplingThatBecomes('fixture_sapling_c', 'effect_costly');

        place(TILE, sapling, 'hero_1');
        run(3000);

        expect(BoardState.getToken(TILE)?.typeId).toBe('fixture_producer');
    });
});

describe('the departing Token is findable at all', () => {
    it('rides on the event, because the tile is empty by then', () => {
        let seen = null;
        const unsub = EventBus.subscribe('board:token_depleted', (p) => { seen = p; });

        const instance = place(TILE, 'fixture_producer', null, 1);
        Charges.applyDelta(TILE, instance, -1);
        unsub();

        expect(BoardState.getToken(TILE), 'the tile should be empty').toBeNull();
        expect(seen?.instance?.typeId).toBe('fixture_producer');
    });

    it('and the square really is free, which is what a Spawns here needs', () => {
        const instance = place(TILE, 'fixture_producer', null, 1);
        Charges.applyDelta(TILE, instance, -1);
        expect(BoardState.getToken(TILE)).toBeNull();
    });
});

describe('a depletion rule can do more than spawn', () => {
    it('deals damage to whoever spent the last charge', () => {
        onDepletion('effect_last_gasp', {
            ...makeStatement(KEYWORD.DEALS),
            target: { role: ROLE.ACTOR },
            payload: { amount: 7, ignoresArmor: true }
        });
        const thorned = saplingThatBecomes('fixture_last_gasp', 'effect_last_gasp');

        place(TILE, thorned, 'hero_1');
        run(3000);

        expect(HeroManager.getHero('hero_1').hp.current).toBe(93);
    });

    it('and reaches nobody when nobody was working it', () => {
        onDepletion('effect_lonely_gasp', {
            ...makeStatement(KEYWORD.DEALS),
            target: { role: ROLE.ACTOR },
            payload: { amount: 7, ignoresArmor: true }
        });
        const thorned = saplingThatBecomes('fixture_lonely_gasp', 'effect_lonely_gasp');

        const instance = place(TILE, thorned, null, 1);
        Charges.applyDelta(TILE, instance, -1);

        expect(HeroManager.getHero('hero_1').hp.current).toBe(100);
    });
});

describe('ordinary Tokens are unaffected', () => {
    it('a Token with no depletion rule still just leaves', () => {
        const instance = place(TILE, 'fixture_producer', null, 1);
        Charges.applyDelta(TILE, instance, -1);
        expect(BoardState.getToken(TILE)).toBeNull();
    });

    it('a Token with charges to spare does not fire the moment', () => {
        onDepletion('effect_not_yet', {
            ...makeStatement(KEYWORD.SPAWNS),
            payload: { typeId: 'fixture_producer', placement: PLACEMENT.HERE }
        });
        const sapling = saplingThatBecomes('fixture_sapling_d', 'effect_not_yet', 5);

        const instance = place(TILE, sapling, null, 5);
        Charges.applyDelta(TILE, instance, -1);

        expect(BoardState.getToken(TILE)?.typeId).toBe(sapling);
    });
});
