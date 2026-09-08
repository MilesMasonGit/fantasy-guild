import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import {
    TRIGGER_EVENTS, TRIGGER_SCOPES, rolesOf, momentSupplies
} from '../config/registries/triggerRegistry.js';
import { ROLE, ROLES, AMBIENT_ROLES, getRole, resolveRoles } from '../config/registries/roleRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * **Who a moment puts in the room** (Effects Grammar v2, V1 — G-2).
 *
 * ## What this phase is for
 * A rule needs to name things it did not place: *"deal 1 damage to whoever just
 * harvested me"*. That "whoever" is a **participant in the moment**, and it
 * exists only because a particular kind of thing happened.
 *
 * G-2 is the rule that keeps this bounded: **a moment declares the roles it
 * supplies, and a target may only name a role its moment has.** An author
 * picking *"a neighbour runs out of charges"* is never offered *"the actor"*,
 * because nobody acted.
 *
 * ## ⭐ The thing worth proving
 * A raspberry bush and a monster are the same case **already**. `BoardRunner`
 * and `BoardCombat` publish the same event with the same payload, because one
 * kill is one cycle (D-129). The last test here is the one that matters: the
 * actor resolves identically for both, which is what makes one Thorns work on
 * both without knowing which it is on.
 */

const TILE = 15;

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

let seen;
let unsubscribers = [];

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;

    seen = { start: [], complete: [] };
    unsubscribers.forEach(u => u?.());
    unsubscribers = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_START, p => seen.start.push(p)),
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, p => seen.complete.push(p)),
    ];
});

afterEach(() => {
    unsubscribers.forEach(u => u?.());
    unsubscribers = [];
});

describe('the two short payloads now carry an actor', () => {
    it('⭐ CYCLE_START names the hero who started the work', () => {
        // It was in scope at the publish site all along and simply not passed,
        // so a rule reacting to work STARTING could not name the hero doing it
        // while the same rule on work COMPLETING could.
        place(TILE, 'fixture_producer', 'hero_1');
        run(300);

        expect(seen.start.length).toBeGreaterThan(0);
        expect(seen.start[0]).toMatchObject({ tile: TILE, typeId: 'fixture_producer', heroId: 'hero_1' });
    });

    it('reports a null actor rather than omitting the field when nobody is there', () => {
        // `fixture_passive` is a passive generator (D-116): it cycles unstaffed.
        // The role is DECLARED and simply not filled, which is different from
        // the field not existing.
        place(TILE, 'fixture_passive');
        run(300);

        expect(seen.start.length).toBeGreaterThan(0);
        expect(seen.start[0]).toHaveProperty('heroId');
        expect(seen.start[0].heroId).toBeNull();
    });

    it('leaves CYCLE_COMPLETE exactly as it was', () => {
        place(TILE, 'fixture_producer', 'hero_1');
        run(13000);

        expect(seen.complete.length).toBeGreaterThan(0);
        expect(seen.complete[0]).toMatchObject({
            tile: TILE, typeId: 'fixture_producer', heroId: 'hero_1', failed: false
        });
    });
});

describe('every moment declares who it supplies', () => {
    it('gives every trigger a roles list', () => {
        for (const trigger of TRIGGER_EVENTS) {
            expect(Array.isArray(trigger.roles), `${trigger.id} has no roles`).toBe(true);
            expect(trigger.roles.length, `${trigger.id} supplies nothing`).toBeGreaterThan(0);
            for (const role of trigger.roles) {
                expect(getRole(role), `${trigger.id} names unknown role ${role}`).toBeTruthy();
            }
        }
    });

    it('supplies `self` on every single moment', () => {
        // The entity carrying the rule is always in the room, whatever happened.
        for (const trigger of TRIGGER_EVENTS) {
            expect(trigger.roles).toContain(ROLE.SELF);
        }
    });

    it('⚠️ never gives a self-scoped moment a `source`', () => {
        // Its source IS the bearer, which is `self`. Two names for one thing is
        // how a vocabulary starts lying.
        for (const trigger of TRIGGER_EVENTS) {
            if (!trigger.scopes.includes(TRIGGER_SCOPES.SELF)) continue;
            expect(trigger.roles, `${trigger.id}`).not.toContain(ROLE.SOURCE);
        }
    });

    it('⚠️ gives no actor to a moment where nobody acted', () => {
        // A Token spending its last charge was not done TO it by anyone, and the
        // Bank holding enough of an item is not an act at all.
        expect(rolesOf('TOKEN_DEPLETED')).not.toContain(ROLE.ACTOR);
        expect(rolesOf('ITEM_THRESHOLD')).not.toContain(ROLE.ACTOR);
        expect(rolesOf('ITEM_THRESHOLD')).toEqual([ROLE.SELF]);
    });

    it('gives an actor to every moment whose payload really carries a hero', () => {
        for (const id of ['CYCLE_COMPLETE', 'SELF_CYCLE_COMPLETE', 'CYCLE_START',
            'SELF_CYCLE_START', 'COMBAT_ENGAGED', 'SELF_COMBAT_ENGAGED', 'COMBAT_RESOLVED']) {
            expect(rolesOf(id), id).toContain(ROLE.ACTOR);
        }
    });

    it('offers only `self` to a rule with no moment at all', () => {
        // A continuous aura has no event, so it has no participants — only the
        // thing carrying it.
        expect(rolesOf(null)).toEqual(AMBIENT_ROLES);
        expect(rolesOf(undefined)).toEqual([ROLE.SELF]);
        expect(rolesOf('NOT_A_TRIGGER')).toEqual([ROLE.SELF]);
    });

    it('answers the authoring question directly', () => {
        expect(momentSupplies('SELF_CYCLE_COMPLETE', ROLE.ACTOR)).toBe(true);
        expect(momentSupplies('TOKEN_DEPLETED', ROLE.ACTOR)).toBe(false);
        expect(momentSupplies(null, ROLE.SELF)).toBe(true);
        expect(momentSupplies(null, ROLE.ACTOR)).toBe(false);
    });

    it('declares exactly the three roles, each with a label and a hint', () => {
        expect(ROLES.map(r => r.id)).toEqual([ROLE.SELF, ROLE.ACTOR, ROLE.SOURCE]);
        for (const role of ROLES) {
            expect(role.label).toBeTruthy();
            expect(role.hint).toBeTruthy();
        }
    });
});

describe('resolving who is actually here', () => {
    it('reads the actor straight off the payload', () => {
        const roles = resolveRoles({ tile: 9, heroId: 'hero_1' }, 9);
        expect(roles).toEqual({ self: 9, actor: 'hero_1', source: null });
    });

    it('⚠️ reports a null actor rather than failing, when nobody was there', () => {
        // Declared and present are different questions. An unstaffed passive
        // generator completes cycles with no hero, and a rule aimed at the actor
        // reaches nobody — the same honest nothing an unmatched filter returns.
        expect(resolveRoles({ tile: 9, heroId: null }, 9).actor).toBeNull();
        expect(resolveRoles({ tile: 9 }, 9).actor).toBeNull();
    });

    it('names a source only when the event happened somewhere else', () => {
        expect(resolveRoles({ tile: 10, heroId: 'h' }, 9).source).toBe(10);
        // Self-scoped: the source is the bearer, so it is not reported twice.
        expect(resolveRoles({ tile: 9, heroId: 'h' }, 9).source).toBeNull();
    });
});

describe('⭐ a bush and a monster are the same case', () => {
    it('resolves the actor identically for work and for combat', () => {
        // The whole generalisation the owner asked for, in one assertion.
        // `BoardRunner` and `BoardCombat` publish the same event with the same
        // payload (D-129: one kill is one cycle), so a rule that reads `actor`
        // cannot tell — and must not be able to tell — which it is standing on.
        const harvest = { tile: 15, typeId: 'token_raspberry_bush', heroId: 'hero_1', failed: false };
        const kill = { tile: 15, typeId: 'token_thorn_elemental', heroId: 'hero_1', failed: false };

        expect(resolveRoles(harvest, 15)).toEqual(resolveRoles(kill, 15));
        expect(resolveRoles(harvest, 15).actor).toBe('hero_1');
    });

    it('and both moments declare the same roles', () => {
        // One library entry, assigned to either, offered the same targets.
        expect(rolesOf('SELF_CYCLE_COMPLETE')).toEqual([ROLE.SELF, ROLE.ACTOR]);
    });
});
