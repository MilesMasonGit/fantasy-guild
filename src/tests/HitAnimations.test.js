import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as Foundations from '../systems/board/Foundations.js';
import * as TokenGlows from '../systems/board/TokenGlows.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { TimeBankManager } from '../systems/core/TimeBankManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { TokenHitArt, COMBAT_ATTACK_EVENT } from '../ui/components/board/TokenHitArt.jsx';
import {
    HIT_ANIMATIONS, SKILL_HIT, HIT_PERIOD_MS, STRIKE_FRAME, HERO_FRAMES,
    hitSkillOf, hitAnimationNameFor, hitAnimationFor, hitsOnAttack, knockbackDir,
    buildHitKeyframes, heroFrameAt, strikeStartTime, heroPhaseMs, redFlash,
    strikesLive, heroAnimationState, heroSpriteFrame, isRealAttack, STRIKE_DELAY_MS, ATTACK_ONCE_MS, HERO_FRAME_MS
} from '../ui/components/board/hitAnimations.js';
import { MatHero } from '../ui/components/board/MatHero.jsx';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token Lifecycle feedback, slice **Q4 — animations**.
 *
 * * FB-10: a hit animation on the Token each time its hero strikes it, one
 *   per skill (owner-approved list), knocked back away from the hero in combat.
 * * FB-11: a glow on the Token a transform has just made — under its NEW id.
 */

registerTokenTypes({
    fixture_q4_sapling: {
        id: 'fixture_q4_sapling', name: 'Fixture Q4 Sapling', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        grows: { into: 'fixture_q4_tree', afterMs: 1000 }
    },
    fixture_q4_tree: {
        id: 'fixture_q4_tree', name: 'Fixture Q4 Tree', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 10, sprite: 'skill_nature',
        config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1, inputs: [], outputs: [] }
    },
    fixture_q4_coast: {
        id: 'fixture_q4_coast', name: 'Fixture Q4 Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        turns: { into: [{ typeId: 'fixture_q4_shrimp', weight: 1 }], everyMs: 1000, lastsMs: 500 }
    },
    fixture_q4_shrimp: {
        id: 'fixture_q4_shrimp', name: 'Fixture Q4 Shrimp Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 12000, xp: 1, inputs: [], outputs: [] }
    },
    fixture_q4_foundation: {
        id: 'fixture_q4_foundation', name: 'Fixture Q4 Foundation',
        rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'wood', skill: 'construction' }
    },
    /** A station whose skill is named only by its Station statement. */
    fixture_q4_anvil: {
        id: 'fixture_q4_anvil', name: 'Fixture Q4 Anvil', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: null,
        statements: [{ id: 'stm_fixture_q4_anvil', keyword: KEYWORD.STATION, payload: { skill: 'smithing' } }]
    },
    fixture_q4_goblin: {
        id: 'fixture_q4_goblin', name: 'Fixture Q4 Goblin', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 3, sprite: 'skill_nature',
        enemy: { level: 1, style: 'melee' }
    }
});

const h = React.createElement;
const mount = (el) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TokenGlows.resetGlows();
    GameState.state.heroes = [];
    clearMat();
    TimeBankManager.isSpending = false;
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    TimeBankManager.isSpending = false;
});

// ---------------------------------------------------------------------------
// FB-10: which skill plays which animation
// ---------------------------------------------------------------------------

describe('skill → hit animation (FB-10, the owner-approved list)', () => {
    it('maps every approved skill to its own animation', () => {
        expect(hitAnimationNameFor('logging')).toBe('shake');
        expect(hitAnimationNameFor('mining')).toBe('jitter');
        expect(hitAnimationNameFor('fishing')).toBe('bob');
        expect(hitAnimationNameFor('farming')).toBe('sway');
        expect(hitAnimationNameFor('smithing')).toBe('squash');
        expect(hitAnimationNameFor('crafting')).toBe('hop');
        expect(hitAnimationNameFor('cooking')).toBe('pulse');
        expect(hitAnimationNameFor('construction')).toBe('thump');
        expect(hitAnimationNameFor('explore')).toBe('rustle');
        // Ten skills, ten different animations.
        expect(new Set(Object.values(SKILL_HIT)).size).toBe(Object.keys(SKILL_HIT).length);
    });

    it('every combat style is knocked back', () => {
        for (const s of ['combat', 'melee', 'ranged', 'magic', 'Melee']) {
            expect(hitAnimationNameFor(s)).toBe('knockback');
            expect(hitsOnAttack(s)).toBe(true);
        }
        expect(hitsOnAttack('logging')).toBe(false);
    });

    it('a skill not on the list plays nothing', () => {
        expect(hitAnimationNameFor('commerce')).toBeNull();
        expect(hitAnimationNameFor(null)).toBeNull();
        expect(hitAnimationFor('commerce')).toBeNull();
    });

    it('every table entry is a playable animation', () => {
        for (const [name, anim] of Object.entries(HIT_ANIMATIONS)) {
            expect(anim.ms, name).toBeGreaterThan(0);
            expect(anim.ms, name).toBeLessThanOrEqual(HIT_PERIOD_MS);
            expect(anim.frames[0].offset, name).toBe(0);
            expect(anim.frames[anim.frames.length - 1].offset, name).toBe(1);
            expect(buildHitKeyframes(anim).length, name).toBeGreaterThan(1);
        }
    });

    it('reads the skill of the work done on the Token', () => {
        expect(hitSkillOf(getTokenType('fixture_q4_tree'))).toBe('logging');          // gathering
        expect(hitSkillOf(getTokenType('fixture_q4_anvil'))).toBe('smithing');        // station statement
        expect(hitSkillOf(getTokenType('fixture_q4_foundation'))).toBe('construction'); // Foundation
        expect(hitSkillOf(getTokenType('fixture_q4_goblin'))).toBe('combat');         // enemy
        expect(hitSkillOf(getTokenType('fixture_q4_sapling'))).toBeNull();            // nothing to work
        expect(hitSkillOf(null)).toBeNull();
    });
});

describe('knockback direction (FB-10 combat)', () => {
    it('goes away from the hero', () => {
        expect(knockbackDir(500, 400)).toBe(1);   // hero on the left: knocked right
        expect(knockbackDir(500, 620)).toBe(-1);  // hero on the right: knocked left
    });

    it('falls back on the side the hero works from, then right', () => {
        expect(knockbackDir(500, undefined, -1)).toBe(1);
        expect(knockbackDir(500, 500, 1)).toBe(-1);
        expect(knockbackDir(500, null, null)).toBe(1);
    });

    it('points the keyframes the way it is told, and flashes red', () => {
        const anim = hitAnimationFor('melee');
        const right = buildHitKeyframes(anim, { dir: 1 });
        const left = buildHitKeyframes(anim, { dir: -1 });
        expect(right[1].transform).toMatch(/^translate\(10%/);
        expect(left[1].transform).toMatch(/^translate\(-10%/);
        expect(right[1].filter).toBe(redFlash(1));
        expect(right[0].filter).toBe('none');
        expect(right[right.length - 1].filter).toBe('none');
    });

    it('a non-directional animation ignores the direction', () => {
        const anim = hitAnimationFor('logging');
        expect(buildHitKeyframes(anim, { dir: -1 })).toEqual(buildHitKeyframes(anim, { dir: 1 }));
    });
});

describe('keyframes in a strike loop, and reduced motion', () => {
    it('squeezes the move into the start of the loop and rests until the next strike', () => {
        const anim = hitAnimationFor('logging');
        const k = buildHitKeyframes(anim, { periodMs: HIT_PERIOD_MS });
        const lastMove = k[k.length - 2];
        expect(lastMove.offset).toBeCloseTo(anim.ms / HIT_PERIOD_MS, 5);
        expect(k[k.length - 1].offset).toBe(1);
        expect(k[k.length - 1].transform).toBe('translate(0%, 0%) rotate(0deg) scale(1, 1)');
    });

    it('reduced motion: work plays nothing; combat keeps only its flash', () => {
        expect(buildHitKeyframes(hitAnimationFor('mining'), { reducedMotion: true })).toEqual([]);
        const k = buildHitKeyframes(hitAnimationFor('magic'), { reducedMotion: true, dir: 1 });
        expect(k.length).toBeGreaterThan(0);
        expect(k.every(f => f.transform === 'none')).toBe(true);
        expect(k.some(f => f.filter !== 'none')).toBe(true);
    });
});

describe('the strike clock (hero sprite and Token share it)', () => {
    it('a loop started at strikeStartTime begins on the strike frame', () => {
        for (const heroId of ['hero_1', 'hero_abc', 'h']) {
            for (const now of [0, 1234.5, 98765]) {
                const start = strikeStartTime(now, heroId);
                expect(start).toBeLessThanOrEqual(now);
                expect(now - start).toBeLessThan(HIT_PERIOD_MS);
                expect(heroFrameAt(start, heroId)).toBe(STRIKE_FRAME);
                // …and every loop after it.
                expect(heroFrameAt(start + 3 * HIT_PERIOD_MS, heroId)).toBe(STRIKE_FRAME);
            }
        }
    });

    it('frames run 0..7 and heroes have their own phase', () => {
        const seen = new Set();
        for (let t = 0; t < HIT_PERIOD_MS; t += 25) seen.add(heroFrameAt(t, 'hero_1'));
        expect([...seen].sort()).toEqual([...Array(HERO_FRAMES).keys()]);
        expect(heroPhaseMs('hero_1')).not.toBe(heroPhaseMs('hero_2'));
        expect(heroPhaseMs(null)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// FB-10: the wrapper plays it
// ---------------------------------------------------------------------------

describe('TokenHitArt', () => {
    function stubAnimate() {
        const calls = [];
        const proto = window.HTMLElement.prototype;
        const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
        const original = proto.animate;
        proto.animate = function animate(keyframes, options) {
            const a = { keyframes, options, startTime: null, cancel: vi.fn(), el: this };
            calls.push(a);
            return a;
        };
        return {
            calls,
            restore() { if (had) proto.animate = original; else delete proto.animate; }
        };
    }

    it('loops the skill animation on the strike clock while the hero works, and stops when they stop', () => {
        const anim = stubAnimate();
        try {
            const { rerender, container } = mount(h(TokenHitArt, {
                instanceId: 't1', skill: 'logging', heroId: 'hero_1', active: true, tokenX: 500
            }, h('span')));
            expect(anim.calls).toHaveLength(1);
            const loop = anim.calls[0];
            expect(loop.options).toEqual({ duration: HIT_PERIOD_MS, iterations: Infinity });
            expect(heroFrameAt(loop.startTime, 'hero_1')).toBe(STRIKE_FRAME);
            const el = container.querySelector('[data-token-hit="shake"]');
            expect(el).not.toBeNull();
            expect(el.getAttribute('data-token-hit-live')).toBe('true');

            // Stuck (an alert): the hero is not really striking.
            rerender(h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null,
                h(TokenHitArt, { instanceId: 't1', skill: 'logging', heroId: 'hero_1', active: false, tokenX: 500 }, h('span')))));
            expect(loop.cancel).toHaveBeenCalled();
            expect(anim.calls).toHaveLength(1);
        } finally {
            anim.restore();
        }
    });

    it('plays nothing with no hero, and nothing for a skill off the list', () => {
        const anim = stubAnimate();
        try {
            mount(h(TokenHitArt, { instanceId: 't1', skill: 'logging', heroId: null, active: false }, h('span')));
            mount(h(TokenHitArt, { instanceId: 't2', skill: 'commerce', heroId: 'hero_1', active: true }, h('span')));
            expect(anim.calls).toHaveLength(0);
        } finally {
            anim.restore();
        }
    });

    it('an enemy is knocked back on each landed attack, away from the hero, and not on a miss', () => {
        const anim = stubAnimate();
        try {
            vi.spyOn(BoardState, 'heroBodyOf').mockReturnValue({ x: 700, side: 1 });
            const { container } = mount(h(TokenHitArt, {
                instanceId: 'enemy_1', skill: 'combat', heroId: 'hero_1', active: true, tokenX: 600
            }, h('span')));
            // No loop for combat: it waits for real attacks.
            expect(anim.calls).toHaveLength(0);

            act(() => EventBus.publish(COMBAT_ATTACK_EVENT, { instanceId: 'enemy_1', heroId: 'hero_1', hit: false }));
            expect(anim.calls).toHaveLength(0);

            act(() => EventBus.publish(COMBAT_ATTACK_EVENT, { instanceId: 'enemy_1', heroId: 'hero_1', hit: true }));
            expect(anim.calls).toHaveLength(1);
            // It waits for the hero's strike frame (FB-49).
            expect(anim.calls[0].options).toEqual({ duration: HIT_ANIMATIONS.knockback.ms, delay: STRIKE_DELAY_MS });
            // Hero to the right (x 700 > 600): knocked left.
            expect(anim.calls[0].keyframes[1].transform).toMatch(/^translate\(-10%/);
            expect(container.querySelector('[data-token-hit="knockback"]').dataset.hitDir).toBe('-1');

            // Another Token's attack does not reach this one.
            act(() => EventBus.publish(COMBAT_ATTACK_EVENT, { instanceId: 'enemy_2', heroId: 'hero_1', hit: true }));
            expect(anim.calls).toHaveLength(1);
        } finally {
            anim.restore();
        }
    });
});

// ---------------------------------------------------------------------------
// FB-11: the transform glow
// ---------------------------------------------------------------------------

describe('transform glow (FB-11)', () => {
    it('a transform raises the glow on the NEW instance, not the old one', () => {
        const old = placeAt('fixture_q4_sapling', 500, 500);
        const made = EffectActions.transformInstance(old, 'fixture_q4_tree');
        expect(made.id).not.toBe(old.id);
        expect(TokenGlows.glowOf(made.id)).toMatchObject({ fromTypeId: 'fixture_q4_sapling', typeId: 'fixture_q4_tree' });
        expect(TokenGlows.glowOf(old.id)).toBeNull();
    });

    it('a sapling growing glows', () => {
        placeAt('fixture_q4_sapling', 500, 500);
        TimedChanges.tick(1100);
        const tree = BoardState.tokens().find(t => t.typeId === 'fixture_q4_tree');
        expect(tree).toBeTruthy();
        expect(TokenGlows.glowOf(tree.id)).not.toBeNull();
    });

    it('a Coast turning, and turning back, glows each time', () => {
        placeAt('fixture_q4_coast', 500, 500);
        TimedChanges.tick(1000);
        const shrimp = BoardState.tokens().find(t => t.typeId === 'fixture_q4_shrimp');
        expect(shrimp).toBeTruthy();
        expect(TokenGlows.glowOf(shrimp.id)).not.toBeNull();
        TimedChanges.tick(600);
        const coast = BoardState.tokens().find(t => t.typeId === 'fixture_q4_coast');
        expect(coast).toBeTruthy();
        expect(TokenGlows.glowOf(coast.id)).not.toBeNull();
    });

    it('a Foundation built into a station glows', () => {
        const f = placeAt('fixture_q4_foundation', 500, 500);
        const built = Foundations.buildInPlace(f, 'fixture_q4_anvil');
        expect(built?.typeId).toBe('fixture_q4_anvil');
        expect(TokenGlows.glowOf(built.id)).toMatchObject({ fromTypeId: 'fixture_q4_foundation' });
    });

    it('nothing glows while the time bank replays time away', () => {
        const old = placeAt('fixture_q4_sapling', 500, 500);
        TimeBankManager.isSpending = true;
        const made = EffectActions.transformInstance(old, 'fixture_q4_tree');
        expect(TokenGlows.glowOf(made.id)).toBeNull();
    });

    it('lasts about a second, on the wall clock', () => {
        TokenGlows.raiseGlow('x', {}, 1000);
        expect(TokenGlows.glowOf('x', 1500).remainingMs).toBe(TokenGlows.GLOW_MS - 500);
        expect(TokenGlows.glowOf('x', 1000 + TokenGlows.GLOW_MS)).toBeNull();
    });

    it('the new Token is drawn glowing', async () => {
        const old = placeAt('fixture_q4_sapling', 500, 500);
        const { container } = mount(h(MatBoard, {}));
        let made;
        await act(async () => { made = EffectActions.transformInstance(old, 'fixture_q4_tree'); });
        const art = container.querySelector(`[data-token-art][data-token-id="${made.id}"]`);
        expect(art).not.toBeNull();
        expect(art.querySelector('[data-transform-glow]')).not.toBeNull();
        expect(art.querySelector('.gi-transform-flash')).not.toBeNull();
    });

    it('a Token that did not just change does not glow', () => {
        const t = placeAt('fixture_q4_tree', 500, 500);
        const { container } = mount(h(MatBoard, {}));
        const art = container.querySelector(`[data-token-art][data-token-id="${t.id}"]`);
        expect(art.querySelector('[data-transform-glow]')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Feedback Q6 — FB-49 combat attacks once, FB-50 stuck heroes idle
// ---------------------------------------------------------------------------

describe('which row a hero plays (FB-49, FB-50)', () => {
    it('the Token reacts and the hero swings only on the same test (FB-50)', () => {
        expect(strikesLive('hero_1', null)).toBe(true);
        expect(strikesLive('hero_1', 'inputs')).toBe(false);
        expect(strikesLive(null, null)).toBe(false);
    });

    it('walks when moving, idles when stuck or not working, swings at work, fights in combat', () => {
        expect(heroAnimationState({ moving: true, working: true })).toBe('walk');
        expect(heroAnimationState({ working: true })).toBe('attack');
        expect(heroAnimationState({ working: true, stuck: true })).toBe('idle');
        expect(heroAnimationState({ working: true, stuck: true, combat: true })).toBe('idle');
        expect(heroAnimationState({ working: true, combat: true })).toBe('combat');
        expect(heroAnimationState({})).toBe('idle');
    });

    it('in a fight the hero idles until it attacks, then plays the attack row once', () => {
        const heroId = 'hero_1';
        // No attack yet: idle, on the hero's own clock.
        expect(heroSpriteFrame('combat', 5000, { heroId }).row).toBe('idle');
        const at = 10000;
        const seen = [];
        for (let t = at; t < at + ATTACK_ONCE_MS; t += HERO_FRAME_MS) {
            const f = heroSpriteFrame('combat', t, { heroId, attackAt: at });
            expect(f.row).toBe('attack');
            seen.push(f.frame);
        }
        expect(seen).toEqual([...Array(HERO_FRAMES).keys()]);   // 0..7, once
        // ...then back to idle until the next attack.
        expect(heroSpriteFrame('combat', at + ATTACK_ONCE_MS, { heroId, attackAt: at }).row).toBe('idle');
        expect(heroSpriteFrame('combat', at + 2400, { heroId, attackAt: at }).row).toBe('idle');
    });

    it('the strike frame lands exactly when the knockback starts', () => {
        const at = 777;
        expect(STRIKE_DELAY_MS).toBe(STRIKE_FRAME * HERO_FRAME_MS);
        expect(heroSpriteFrame('combat', at + STRIKE_DELAY_MS, { attackAt: at }).frame).toBe(STRIKE_FRAME);
        expect(heroSpriteFrame('combat', at + STRIKE_DELAY_MS - 1, { attackAt: at }).frame).toBe(STRIKE_FRAME - 1);
    });

    it('waits exactly to the next frame boundary', () => {
        const f = heroSpriteFrame('combat', 1030, { attackAt: 1000 });
        expect(f).toEqual({ row: 'attack', frame: 0, nextInMs: HERO_FRAME_MS - 30 });
        const loop = heroSpriteFrame('attack', 0, { heroId: null });
        expect(loop).toEqual({ row: 'attack', frame: 0, nextInMs: HERO_FRAME_MS });
    });

    it('the work swing and the walk still loop', () => {
        expect(heroSpriteFrame('attack', 1234, { heroId: 'hero_1' })).toMatchObject({ row: 'attack', frame: heroFrameAt(1234, 'hero_1') });
        expect(heroSpriteFrame('walk', 1234, { heroId: 'hero_1' }).row).toBe('walk');
        expect(heroSpriteFrame('idle', 1234, { heroId: 'hero_1' }).row).toBe('idle');
    });

    it('a miss is still an attack; a stunned attempt is not', () => {
        expect(isRealAttack({ hit: true })).toBe(true);
        expect(isRealAttack({ hit: false })).toBe(true);
        expect(isRealAttack({ hit: false, stunned: true })).toBe(false);
        expect(isRealAttack(null)).toBe(false);
    });
});

describe('MatHero in a fight (FB-49)', () => {
    const heroEl = (container) => container.querySelector('[data-hero-row]');
    const drawHero = (animationState) => mount(h(MatHero, {
        heroId: 'hero_q6', name: 'Q6', sprite: 'recruit', left: 0, top: 0, z: 1, animationState
    }));

    it('stands idle until a real attack, plays the attack row on one, and ignores others', () => {
        const { container } = drawHero('combat');
        expect(heroEl(container).dataset.heroRow).toBe('idle');

        act(() => EventBus.publish(COMBAT_ATTACK_EVENT, { instanceId: 'e', heroId: 'someone_else', hit: true }));
        expect(heroEl(container).dataset.heroRow).toBe('idle');

        act(() => EventBus.publish(COMBAT_ATTACK_EVENT, { instanceId: 'e', heroId: 'hero_q6', hit: false, stunned: true }));
        expect(heroEl(container).dataset.heroRow).toBe('idle');

        act(() => EventBus.publish(COMBAT_ATTACK_EVENT, { instanceId: 'e', heroId: 'hero_q6', hit: false }));
        expect(heroEl(container).dataset.heroRow).toBe('attack');
        expect(heroEl(container).dataset.heroFrame).toBe('0');
    });

    it('a working hero still swings, and a stuck one stands idle (FB-50)', () => {
        expect(heroEl(drawHero('attack').container).dataset.heroRow).toBe('attack');
        cleanup();
        const stuck = heroAnimationState({ working: true, stuck: !strikesLive('hero_q6', 'inputs') });
        expect(heroEl(drawHero(stuck).container).dataset.heroRow).toBe('idle');
    });
});

// ---------------------------------------------------------------------------
// Feedback Q6 — FB-51 a Token left in another's place glows
// ---------------------------------------------------------------------------

describe('spawn in place glows like a transform (FB-51)', () => {
    const spawnOf = (placement) => ({ payload: { typeId: 'fixture_q4_sapling', placement } });

    it('a Token that replaces its bearer (a Stump left behind) glows under its new id', () => {
        const bearer = placeAt('fixture_q4_tree', 500, 500);
        const result = EffectActions.spawn(spawnOf(PLACEMENT.HERE), { self: bearer.id });
        expect(result.replacedBearer).toBe(true);
        expect(TokenGlows.glowOf(result.instanceId)).toMatchObject({ fromTypeId: 'fixture_q4_tree', typeId: 'fixture_q4_sapling' });
        expect(TokenGlows.glowOf(bearer.id)).toBeNull();
    });

    it('also where a bearer that has already left stood', () => {
        const bearer = placeAt('fixture_q4_tree', 500, 500);
        BoardState.removeToken(bearer.id);
        const result = EffectActions.spawn(spawnOf(PLACEMENT.HERE), { self: bearer.id, selfPoint: { x: 500, y: 500 } });
        expect(result.replacedBearer).toBe(true);
        expect(TokenGlows.glowOf(result.instanceId)).not.toBeNull();
    });

    it('an ordinary spawn beside its bearer does not glow', () => {
        const bearer = placeAt('fixture_q4_tree', 500, 500);
        const result = EffectActions.spawn(spawnOf(PLACEMENT.NEAREST_FREE), { self: bearer.id });
        expect(result.replacedBearer).toBe(false);
        expect(TokenGlows.glowOf(result.instanceId)).toBeNull();
    });

    it('nothing glows while the time bank replays time away', () => {
        const bearer = placeAt('fixture_q4_tree', 500, 500);
        TimeBankManager.isSpending = true;
        const result = EffectActions.spawn(spawnOf(PLACEMENT.HERE), { self: bearer.id });
        expect(result.replacedBearer).toBe(true);
        expect(TokenGlows.glowOf(result.instanceId)).toBeNull();
    });
});
