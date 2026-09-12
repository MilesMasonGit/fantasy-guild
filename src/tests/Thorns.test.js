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
import { EventBus } from '../systems/core/EventBus.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { KEYWORD, getKeyword, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { effectRefsOf, statementsFromEntry } from '../systems/effects/effectLibrary.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Thorns** — the example the whole project is judged by
 * (Effects Grammar v2, V2).
 *
 * The owner's words:
 *
 * > *"With Thorns: I should be able to author a 'Does 1 damage to opponent when
 * > a cycle completes targeting this entity' effect… I would also want to apply
 * > the same thorns effect to a raspberry bush."*
 *
 * ## What makes one entry work on both
 * Nothing in the rule knows which it is on. `BoardRunner` (a hero finishes
 * harvesting) and `BoardCombat` (a hero wins a fight) publish **the same event
 * with the same payload**, because one kill is one cycle (D-129). So `actor`
 * resolves to the hero either way, and `DealDamage` cannot tell a berry bush
 * from a monster. That was already true; V1 exposed it and V2 uses it.
 *
 * The pair of tests under "one entry, two bearers" is the acceptance criterion.
 */

const BUSH = 15, MONSTER = 16;

function makeHero(id, armor = 0) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    const hero = {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: 100, max: 100 }, statuses: [],
        aggregator: new ModifierAggregator(id)
    };
    if (armor) {
        hero.aggregator.addModifier({
            type: EFFECT_TYPES.ARMOR, value: armor, bucket: 'flat', source: 'test'
        });
    }
    return hero;
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const hp = (id) => HeroManager.getHero(id).hp.current;

/**
 * A promoted hero who can actually fight.
 *
 * ⚠️ `hero.skills.melee` must be **added**, not merely levelled. `canHeroFight`
 * tests *possession* of a combat skill and never its level — an unpromoted
 * Recruit holds none and starts no fight at all, so a hero built without this
 * line stands on an enemy doing nothing, and every assertion downstream passes
 * for the wrong reason.
 */
function makeFighter(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    hero.skills.melee = { level: 50, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    hero.aggregator = new ModifierAggregator(id);
    hero.statuses = [];
    return hero;
}

/** ⭐ Thorns itself — one library entry, authored once. */
function registerThorns(amount = 1, extra = {}) {
    registerEffects({
        fixture_effect_thorns: {
            id: 'fixture_effect_thorns',
            name: 'Thorns',
            statements: [{
                ...makeStatement(KEYWORD.DEALS),
                id: 'stm_thorns',
                payload: { amount, ignoresArmor: false, ...extra }
            }]
        }
    });
}

/** A producer that hurts whoever works it, by referencing Thorns. */
function thornedProducer(id, ref = { effectId: 'fixture_effect_thorns' }) {
    registerTokenTypes({
        [id]: {
            id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture',
            uses: null, sprite: 'skill_nature',
            config: {
                skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
                inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
            },
            effects: [ref]
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
    TriggerSystem.init();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
    registerThorns();
});

afterEach(() => {
    TriggerSystem.teardown();
});

describe('⭐ one entry, two bearers', () => {
    it('hurts the hero who HARVESTS it', () => {
        thornedProducer('fixture_berry_bush');
        place(BUSH, 'fixture_berry_bush', 'hero_1');

        run(13000);

        expect(hp('hero_1')).toBe(99);
    });

    it('⭐ hurts the hero who KILLS it — a real fight, not a second producer', () => {
        /**
         * The actual acceptance criterion, and the reason this test exists
         * separately from the one above: harvesting and killing are different
         * code paths in `BoardRunner` and `BoardCombat`, and the whole claim is
         * that a rule cannot tell them apart. Proving it with a second producer
         * would have proved only that two Tokens can share a library entry.
         */
        /**
         * ⚠️ The thorn is deliberately enormous and armour-piercing, so that
         * the signal is unambiguous. A real fight moves HP for its own reasons —
         * the enemy hits back — so "hp went down" would pass whether or not the
         * thorn ever fired. `cause: 'effect'` is published by nothing else in
         * the game, which makes it the one assertion that can only be true if a
         * thorn landed on a genuine kill.
         */
        registerThorns(500, { ignoresArmor: true });
        registerTokenTypes({
            fixture_thorn_beast: {
                ...getTokenType('fixture_enemy'),
                id: 'fixture_thorn_beast',
                effects: [{ effectId: 'fixture_effect_thorns' }]
            }
        });

        const downed = [];
        const un = EventBus.subscribe('hero_downed', p => downed.push(p));

        GameState.state.heroes = [makeFighter('hero_1')];
        place(MONSTER, 'fixture_thorn_beast', 'hero_1');
        run(60000);
        un();

        expect(downed).toContainEqual({ heroId: 'hero_1', cause: 'effect' });
    });

    it('⭐ is literally the same entry, referenced twice', () => {
        thornedProducer('fixture_bush_a');
        thornedProducer('fixture_beast_b');

        const a = effectRefsOf(getTokenType('fixture_bush_a'));
        const b = effectRefsOf(getTokenType('fixture_beast_b'));

        expect(a[0].effectId).toBe('fixture_effect_thorns');
        expect(b[0].effectId).toBe(a[0].effectId);
        // And both expand to the same rule, so editing the entry reaches both.
        expect(getTokenType('fixture_bush_a').statements[0].payload)
            .toEqual(getTokenType('fixture_beast_b').statements[0].payload);
    });

    it('hurts nobody when the work was unstaffed', () => {
        // A passive generator (D-116) completes cycles with no hero, so the
        // actor role is declared and unfilled — the same honest nothing an
        // unmatched filter returns, not a failure.
        registerTokenTypes({
            fixture_thorned_passive: {
                ...getTokenType('fixture_passive'),
                id: 'fixture_thorned_passive',
                effects: [{ effectId: 'fixture_effect_thorns' }]
            }
        });
        place(BUSH, 'fixture_thorned_passive');

        expect(() => run(13000)).not.toThrow();
        expect(hp('hero_1')).toBe(100);
    });
});

describe('damage respects armour (G-23)', () => {
    it('is reduced by the hero’s armour', () => {
        registerThorns(5);
        GameState.state.heroes = [makeHero('hero_1', 2)];
        thornedProducer('fixture_bush_armour');
        place(BUSH, 'fixture_bush_armour', 'hero_1');

        run(13000);

        expect(hp('hero_1')).toBe(97);   // 5 - 2
    });

    it('⚠️ can be stopped ENTIRELY by armour, unlike a combat hit', () => {
        // A combat hit floors at 1 so a fight always progresses. A thorn is not
        // a fight: a floor of 1 here would make heavy armour worth exactly as
        // much as none against every thorn in the game.
        registerThorns(2);
        GameState.state.heroes = [makeHero('hero_1', 10)];
        thornedProducer('fixture_bush_plated');
        place(BUSH, 'fixture_bush_plated', 'hero_1');

        run(13000);

        expect(hp('hero_1')).toBe(100);
    });

    it('pierces when the author says so', () => {
        registerThorns(2, { ignoresArmor: true });
        GameState.state.heroes = [makeHero('hero_1', 10)];
        thornedProducer('fixture_bush_piercing');
        place(BUSH, 'fixture_bush_piercing', 'hero_1');

        run(13000);

        expect(hp('hero_1')).toBe(98);
    });
});

describe('a lethal thorn announces, and never resolves the death itself', () => {
    it('publishes hero_downed rather than killing in place', () => {
        // ⚠️ The whole of what dying costs is implemented once, in
        // `BoardCombat.resolveDefeat`. CR2-070: this branch was a log line and
        // nothing else for months, and a poisoned hero worked on at 0 HP.
        const downed = [];
        const un = EventBus.subscribe('hero_downed', p => downed.push(p));

        registerThorns(200);
        thornedProducer('fixture_bush_lethal');
        place(BUSH, 'fixture_bush_lethal', 'hero_1');

        run(13000);

        expect(downed).toEqual([{ heroId: 'hero_1', cause: 'effect' }]);
        un();
    });
});

describe('the tier is the magnitude, and the bearer sets the price (G-5)', () => {
    it('scales the damage by the reference’s tier', () => {
        thornedProducer('fixture_bush_iii', { effectId: 'fixture_effect_thorns', scale: 3 });
        place(BUSH, 'fixture_bush_iii', 'hero_1');

        run(13000);

        expect(hp('hero_1')).toBe(97);   // Thorns III is 3 damage
    });

    it('lets one entry be free on one bearer and cost a charge on another', () => {
        const entry = { id: 'e', name: 'Thorns', statements: [{ ...makeStatement(KEYWORD.DEALS), id: 's' }] };

        const free = statementsFromEntry(entry, { effectId: 'e', chargeCost: 0 });
        const costly = statementsFromEntry(entry, { effectId: 'e', chargeCost: 1 });

        expect(free[0].chargeDelta).toBe(0);
        expect(costly[0].chargeDelta).toBe(-1);
    });

    it('leaves the statement’s own cost alone when the bearer says nothing', () => {
        // ⚠️ Absent means "whatever the statement says", so no reference
        // authored before G-5 changes what it costs.
        const entry = {
            id: 'e', name: 'Thorns',
            statements: [{ ...makeStatement(KEYWORD.DEALS), id: 's', chargeDelta: -2 }]
        };
        expect(statementsFromEntry(entry, { effectId: 'e' })[0].chargeDelta).toBe(-2);
    });
});

describe('the grammar and the sentence', () => {
    it('declares Deals as a role-targeting verb that needs a moment', () => {
        const kw = getKeyword(KEYWORD.DEALS);
        expect(kw.targetsRole).toBe(true);
        expect(kw.when).toBe('required');
        // It aims at a participant, not at tiles — so no filter and no reach.
        expect(kw.filter).toBe(false);
        expect(kw.reach).toBeFalsy();
    });

    it('⭐ is born as the Thorns case, not as a Bank watcher', () => {
        const s = makeStatement(KEYWORD.DEALS);
        expect(s.when.event).toBe('SELF_CYCLE_COMPLETE');
        expect(s.target).toEqual({ role: ROLE.ACTOR });
        expect(s.payload).toEqual({ amount: 1, ignoresArmor: false });
    });

    it('reads literally, and keeps Token capitalised', () => {
        expect(renderStatement(makeStatement(KEYWORD.DEALS)))
            .toBe("When this Token's cycle completes, deals 1 damage to the hero.");
    });

    it('mentions armour only when it is being ignored', () => {
        const s = makeStatement(KEYWORD.DEALS);
        expect(renderStatement(s)).not.toContain('armour');
        expect(renderStatement({ ...s, payload: { amount: 2, ignoresArmor: true } }))
            .toBe("When this Token's cycle completes, deals 2 damage to the hero, ignoring armour.");
    });

    it('⚠️ no longer flattens the proper nouns the vocabulary owns', () => {
        // `.toLowerCase()` on the whole trigger label turned "This Token's" into
        // "this token's" and "The Bank" into "the bank". A sentence that strips
        // the game's own capitals is not literal, which is the one thing the
        // rules text has to be (G-10).
        const line = renderStatement(makeStatement(KEYWORD.DEALS));
        expect(line).toContain("this Token's");
        expect(line).not.toContain('this token');
    });
});
