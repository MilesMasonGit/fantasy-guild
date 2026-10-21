// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { announce } from '../systems/board/EffectFeedback.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { setSpriteFxManifest } from '../ui/utils/spriteFx.js';
import { TINT_COLOURS, DITHER_STEPS, ditherKeeps, isDissolved } from '../config/spriteFx.js';
import { heldPoses, FX_FRAME_MS } from '../ui/components/board/fx/pixelSteps.js';
import { fxNoise, fxInt, seedOf } from '../ui/components/board/fx/fxRandom.js';
import { spriteOf, makeCopy } from '../ui/components/board/fx/spriteCopy.js';
import { flashTint, afterimages, ringBlink, echoRing } from '../ui/components/board/fx/tokenFx.js';
import * as MatFx from '../ui/components/board/fx/matFx.js';
import { startStrikeChips, CHIP_COUNT } from '../ui/components/board/fx/strikeChips.js';
import { setDrawingPaused } from '../ui/components/board/frameClock.js';
import { lootHopPoses, HOP_POSES, playLootArc, playAbsorptionSlide } from '../ui/utils/lootArc.js';
import * as RareDrops from '../systems/board/RareDrops.js';
import { createPickupFlight, playPickupFlight, PICKUP_MS } from '../ui/dnd/pickupFlight.js';
import { settlePlan, beginSettle, takeSettle, playSettle, HALL_SETTLE_MS, SETTLE_SPREAD_MS, LAND_MS } from '../ui/components/board/fx/regionSettle.js';
import { recordRareDrop, takeRareDrop, playRareTwinkle } from '../ui/components/board/fx/rareTwinkle.js';

/**
 * The animation batch (T-137): the shared pieces every effect stands on, and each effect's own
 * promise: whole art pixels, stepped, nothing left on the page at rest, nothing drawn from the
 * game's random numbers.
 */

const SPRITE = 'assets/tokens/test/t_tree.png';
const SHEET = 'assets/enemies/e_test_sheet.png';
const ITEM = 'assets/items/i_test.png';

/** Every `animate` call, recorded; each returns a stand-in that can be finished. */
function recordAnimate() {
    const calls = [];
    const proto = window.Element.prototype;
    const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
    const original = proto.animate;
    proto.animate = function animate(keyframes, options) {
        const a = {
            el: this, keyframes, options, onfinish: null, oncancel: null, cancel: vi.fn(),
            finish() { this.onfinish?.(); }
        };
        calls.push(a);
        return a;
    };
    return { calls, restore() { if (had) proto.animate = original; else delete proto.animate; } };
}

/** A Token's hit wrapper holding a still sprite, as `TokenHitArt` draws it. */
function stillWrapper(size = 128, src = SPRITE) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<span><span><img src="/${src}" style="width: ${size}px; height: ${size}px"></span></span>`;
    document.body.appendChild(wrapper);
    return wrapper;
}

/** An enemy's hit wrapper: one sheet element, framed and flipped. */
function sheetWrapper(size = 128) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div style="width: ${size}px; height: ${size}px"><div></div>` +
        `<div role="img" style="background-image: url(/${SHEET}); background-size: ${size * 4}px ${size * 4}px; background-position: -${size}px 0px; transform: scaleX(-1)"></div></div>`;
    document.body.appendChild(wrapper);
    return wrapper;
}

beforeEach(() => {
    setSpriteFxManifest({
        sprites: {
            [SPRITE]: { w: 64, h: 64, outlined: true, hash: 'a' },
            [SHEET]: { w: 256, h: 256, cols: 4, rows: 4, outlined: true, hash: 'b' },
            [ITEM]: { w: 32, h: 32, outlined: true, hash: 'c' }
        }
    });
});

afterEach(() => {
    setSpriteFxManifest(null);
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('held poses: whole pixels, stepped', () => {
    it('holds each pose for its time and jumps, in whole art pixels of `unit` mat units', () => {
        const { keyframes, duration } = heldPoses([{ ms: 60, x: 2 }, { ms: 120, y: -1.4 }], { unit: 3 });
        expect(duration).toBe(180);
        expect(keyframes.map(k => k.offset)).toEqual([0, 60 / 180, 1]);
        expect(keyframes.slice(0, -1).every(k => k.easing === 'steps(1, end)')).toBe(true);
        // -1.4 art px is drawn as -1: never a fraction of an art pixel.
        expect(keyframes.map(k => k.transform)).toEqual(['translate(6px, 0px)', 'translate(0px, -3px)', 'translate(0px, 0px)']);
    });

    it('carries other properties pose by pose, ending at the rest pose', () => {
        const { keyframes } = heldPoses([{ ms: 60, visibility: 'visible' }, { ms: 60, visibility: 'hidden' }], { rest: { visibility: 'hidden' } });
        expect(keyframes.map(k => k.visibility)).toEqual(['visible', 'hidden', 'hidden']);
    });
});

describe('visual randomness never touches the game’s random numbers', () => {
    it('is a fixed function of what it is about', () => {
        const s = seedOf('tok_1');
        expect(fxNoise(s, 3)).toBe(fxNoise(s, 3));
        expect(fxNoise(s, 3)).not.toBe(fxNoise(s, 4));
        for (let n = 0; n < 200; n++) {
            const v = fxNoise(s, n);
            expect(v >= 0 && v < 1).toBe(true);
            const i = fxInt(s, n, -1, 1);
            expect([-1, 0, 1]).toContain(i);
        }
    });

    it('no effect in the batch draws Math.random', () => {
        const rec = recordAnimate();
        const spy = vi.spyOn(Math, 'random');
        try {
            setDrawingPaused(true);
            const w = stillWrapper();
            flashTint(w, 'white');
            afterimages(w, [{ ms: 60, x: 3 }, { ms: 60, x: 1 }]);
            ringBlink(w, 'hover');
            echoRing(w, 'hover');
            const stop = startStrikeChips(w, { skill: 'mining', firstStrike: 0, periodMs: 1000, dir: () => 1, seed: 'tok_1' });
            stop();
            expect(spy).not.toHaveBeenCalled();
        } finally {
            setDrawingPaused(false);
            rec.restore();
        }
    });
});

describe('tinted copies are generated pictures', () => {
    it('the generator makes three tints for every mat sprite, and dithers only for enemies and items', () => {
        expect(Object.keys(TINT_COLOURS)).toEqual(['white', 'gold', 'green']);
        expect(DITHER_STEPS).toEqual([50, 25]);
        expect(isDissolved('assets/enemies/e_goblin.png')).toBe(true);
        expect(isDissolved('assets/items/i_wood.png')).toBe(true);
        expect(isDissolved('assets/tokens/forest/t_tree_oak.png')).toBe(false);
    });

    it('each dither step keeps a subset of the one before: a dissolve only takes pixels away', () => {
        let kept50 = 0;
        let kept25 = 0;
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                if (ditherKeeps(x, y, 25)) { kept25++; expect(ditherKeeps(x, y, 50)).toBe(true); }
                if (ditherKeeps(x, y, 50)) kept50++;
            }
        }
        expect([kept50, kept25]).toEqual([32, 16]);
    });

    it('a still sprite’s copy is its generated tint, the sprite’s size, hidden until played, taking no pointer', () => {
        const copy = makeCopy(spriteOf(stillWrapper(128)), { tint: 'white' });
        expect(copy.style.width).toBe('128px');
        expect(copy.style.visibility).toBe('hidden');
        expect(copy.style.pointerEvents).toBe('none');
        expect(copy.style.willChange).toBe('contents');
        expect(copy.firstChild.style.backgroundImage).toBe(`url("/_gen/sprite-fx/tint-white/${SPRITE}")`);
        expect(copy.innerHTML).not.toMatch(/mask|filter/);
    });

    it('a sheet’s copy takes the frame and facing showing now', () => {
        const sprite = spriteOf(sheetWrapper(128));
        expect(sprite.sheet).toMatchObject({ size: '512px 512px', position: '-128px 0px', transform: 'scaleX(-1)' });
        const copy = makeCopy(sprite, { tint: 'white' });
        expect(copy.firstChild.style.backgroundPosition).toBe('-128px 0px');
        expect(copy.firstChild.style.transform).toBe('scaleX(-1)');
    });

    it('no copy where the generator made none (new art before it is drawn)', () => {
        setSpriteFxManifest(null);
        expect(makeCopy(spriteOf(stillWrapper()), { tint: 'white' })).toBeNull();
        setSpriteFxManifest({ sprites: { [SPRITE]: { w: 64, h: 64, outlined: true, hash: 'a' } } });
        expect(makeCopy(spriteOf(stillWrapper()), { dither: 50 })).toBeNull();   // not an enemy or item
    });
});

describe('effects on a Token’s art leave nothing behind', () => {
    let rec;
    beforeEach(() => { rec = recordAnimate(); });
    afterEach(() => rec.restore());

    it('colour flash (effect 13): a white copy over the sprite for two frames, then gone', () => {
        const w = stillWrapper();
        flashTint(w, 'white', { frames: 2 });
        const copy = w.lastChild;
        expect(copy.getAttribute('data-fx-copy')).toBe('white');
        expect(rec.calls[0].options.duration).toBe(2 * FX_FRAME_MS);
        expect(rec.calls[0].keyframes.every(k => k.visibility === 'visible')).toBe(true);
        rec.calls[0].finish();
        expect(w.querySelector('[data-fx-copy]')).toBeNull();
    });

    it('afterimage trail: white speckled copies under the sprite, where it was one and two poses before', () => {
        const w = stillWrapper(64, ITEM);
        const poses = [{ ms: 60, x: 3 }, { ms: 60, x: 5 }, { ms: 60, x: 4 }, { ms: 60, x: 2 }, { ms: 60, x: 1 }];
        afterimages(w, poses, { unit: 2 });
        // Under the art: the older (a quarter of the pixels) first, then the nearer (half).
        expect([...w.children].slice(0, 2).map(c => c.getAttribute('data-fx-copy'))).toEqual(['white-dither-50', 'white-dither-25']);
        expect(w.querySelector('[data-fx-copy="white-dither-50"]').firstChild.style.backgroundImage).toBe(`url("/_gen/sprite-fx/dither-white-50/${ITEM}")`);
        expect(rec.calls).toHaveLength(2);
        const [older, newer] = rec.calls;   // the older copy is made first
        // The newer copy, at pose 2 (art at 4), stands where pose 1 was (5): +1 art px = 2 mat units.
        expect(newer.keyframes[2].transform).toBe('translate(2px, 0px)');
        expect(newer.keyframes[2].visibility).toBe('visible');
        // The older copy leaves first: hidden on the last pose while the newer is still there.
        expect(older.keyframes[4].visibility).toBe('hidden');
        expect(newer.keyframes[4].visibility).toBe('visible');
        for (const a of rec.calls) a.finish();
        expect(w.querySelector('[data-fx-copy]')).toBeNull();
    });

    it('a Token with no trail copies (not an enemy, not loot) plays no trail', () => {
        afterimages(stillWrapper(), [{ ms: 60, x: 3 }, { ms: 60, x: 1 }]);
        expect(rec.calls).toHaveLength(0);
    });

    it('cycle blink (effect 3): the white outline, one frame, over the green one', () => {
        const w = stillWrapper(128);
        ringBlink(w, 'hover', { frames: 1 });
        const ring = w.lastChild;
        expect(ring.getAttribute('data-fx-ring')).toBe('hover');
        // One art pixel (2 mat units at 128 across a 64 px sprite) out on every side.
        expect(ring.style.width).toBe('132px');
        expect(ring.style.backgroundImage).toBe(`url("/_gen/sprite-fx/ol-hover/${SPRITE}")`);
        expect(rec.calls[0].options.duration).toBe(FX_FRAME_MS);
    });

    it('echo ring: four outline copies under the art, 1, 2 and 3 art pixels out, no scaling', () => {
        const w = stillWrapper();
        echoRing(w, 'hover', { unit: 2 });
        expect(rec.calls).toHaveLength(4);
        expect(w.firstChild.getAttribute('data-fx-ring')).toBe('hover');
        const up = rec.calls.find(a => a.keyframes[0].transform === 'translate(0px, -2px)');
        expect(up.keyframes.map(k => k.transform)).toEqual(['translate(0px, -2px)', 'translate(0px, -4px)', 'translate(0px, -6px)', 'translate(0px, 0px)']);
        expect(rec.calls.every(a => a.keyframes.every(k => !/scale/.test(k.transform)))).toBe(true);
    });

    it('a sheet (an enemy) has no outline copy: its blink and echo play nothing', () => {
        const w = sheetWrapper();
        expect(ringBlink(w, 'hover')).toBeNull();
        expect(echoRing(w, 'hover')).toEqual([]);
    });
});

describe('strike chips (effect 2)', () => {
    let rec;
    beforeEach(() => { rec = recordAnimate(); setDrawingPaused(true); });
    afterEach(() => { setDrawingPaused(false); rec.restore(); });

    it('three chips in the worked skill’s colour while worked, none after, none for a skill without a colour', () => {
        const w = stillWrapper();
        const stop = startStrikeChips(w, { skill: 'mining', firstStrike: 0, periodMs: 1000, dir: () => 1, seed: 't' });
        const chips = w.querySelectorAll('[data-fx-chip]');
        expect(chips).toHaveLength(CHIP_COUNT);
        expect([...chips].every(c => c.style.visibility === 'hidden' && c.style.willChange === 'contents')).toBe(true);
        stop();
        expect(w.querySelectorAll('[data-fx-chip]')).toHaveLength(0);
        const none = startStrikeChips(w, { skill: 'commerce', firstStrike: 0, periodMs: 1000, dir: () => 1 });
        expect(w.querySelectorAll('[data-fx-chip]')).toHaveLength(0);
        none();
    });
});

describe('effects standing on the mat', () => {
    let rec;
    let host;
    let unwatch;
    beforeEach(() => {
        rec = recordAnimate();
        GameState.initNew();
        clearMat();
        host = document.createElement('div');
        document.body.appendChild(host);
        MatFx.attachFxHost(host, 2);
        unwatch = MatFx.watchMatFx();
    });
    afterEach(() => {
        unwatch();
        MatFx.attachFxHost(null);
        rec.restore();
    });

    it('a damage number on every landed hit (effect 14), on the strike frame; none on a miss', () => {
        const goblin = placeAt('fixture_enemy', 500, 500);
        EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATTACK, { instanceId: goblin.id, heroId: 'h', hit: false, damage: 0 });
        expect(host.children).toHaveLength(0);
        EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATTACK, { instanceId: goblin.id, heroId: 'h', hit: true, damage: 7.6 });
        const n = host.querySelector('[data-fx-number="damage"]');
        expect(n.textContent).toBe('8');
        expect(n.className).toContain('gi-fx-number');
        expect(rec.calls[0].options.delay).toBeGreaterThan(0);
        rec.calls[0].finish();
        expect(host.children).toHaveLength(0);
    });

    it('a rule firing from a neighbour (effect 7): a spark hops between them, then its +N rises (effect 6)', () => {
        const giver = placeAt('fixture_producer', 400, 500);
        const taker = placeAt('fixture_producer', 560, 500);
        EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: taker.id, title: 'Bonus', fromTokenId: giver.id, amount: 1 });
        const [hop, rise] = rec.calls;
        expect(hop.keyframes).toHaveLength(MatFx.SPARK_HOPS + 2);
        // It lands on the receiver: the last pose is the whole way across, in art pixels of 2 units.
        expect(hop.keyframes[MatFx.SPARK_HOPS].transform).toBe('translate(160px, 0px)');
        expect(rise.el.textContent).toBe('+1');
        expect(rise.options.delay).toBe(MatFx.SPARK_MS);
    });

    it('a rule on the Token itself, or with nothing landed, draws no spark and no number', () => {
        const t = placeAt('fixture_producer', 400, 500);
        EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: t.id, title: 'Self', fromTokenId: t.id });
        expect(host.children).toHaveLength(0);
    });

    it('a beaten enemy that leaves blinks, drops and dissolves where it stood (effect 15)', () => {
        const goblin = placeAt('fixture_enemy', 500, 500);
        goblin.usesRemaining = 0;
        const art = sheetWrapper(128);
        art.setAttribute('data-hit-art', goblin.id);
        EventBus.publish(BOARD_EVENTS.COMBAT_RESOLVED, { instanceId: goblin.id, outcome: 'victory' });
        const ghost = host.querySelector(`[data-fx-knockout="${goblin.id}"]`);
        expect(ghost).not.toBeNull();
        expect([...ghost.children].map(c => c.getAttribute('data-fx-copy'))).toEqual(['art', 'dither-50', 'dither-25']);
        expect(ghost.children[1].firstChild.style.backgroundImage).toBe(`url("/_gen/sprite-fx/dither-50/${SHEET}")`);
        const fall = rec.calls.find(a => a.el === ghost);
        expect(fall.options.duration).toBe(MatFx.KNOCKOUT_MS);
        // Four grey puff pixels at its feet.
        expect(host.querySelectorAll('span[aria-hidden]').length).toBeGreaterThanOrEqual(4);
    });

    it('a won fight whose enemy stays blinks it in place instead', () => {
        const goblin = placeAt('fixture_enemy', 500, 500);
        goblin.usesRemaining = 3;
        const heard = [];
        const off = EventBus.subscribe('ui:token_fx', (p) => heard.push(p));
        EventBus.publish(BOARD_EVENTS.COMBAT_RESOLVED, { instanceId: goblin.id, outcome: 'victory' });
        off();
        expect(heard).toEqual([{ instanceId: goblin.id, fx: 'blink' }]);
        expect(host.querySelector('[data-fx-knockout]')).toBeNull();
    });
});

describe('the effect announcement names its neighbour and what landed', () => {
    beforeEach(() => {
        GameState.initNew();
        clearMat();
        TileModifiers.clearAll();
    });

    it('a neighbour’s bonus drop carries the Token it came from', () => {
        const taker = placeAt('fixture_producer', 500, 500);
        const giver = placeAt('fixture_bonus_drop', 640, 500);
        TileModifiers.rebuildAround([taker, giver]);
        const grants = TileModifiers.collectItemGrants(taker.id, EFFECT_TYPES.BONUS_DROP);
        expect(grants.length).toBeGreaterThan(0);
        expect(grants[0].fromTokenId).toBe(giver.id);
        expect(BoardState.getTokenById(taker.id)).not.toHaveProperty('fromTokenId');
    });

    it('the announcement passes the neighbour and the amount on, and only when there is one', () => {
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => heard.push(p));
        announce('t1', { effectTitle: 'Coal', fromTokenId: 't2' }, { amount: 2 });
        announce('t1', { effectTitle: 'Coal' });
        off();
        expect(heard).toEqual([
            { instanceId: 't1', title: 'Coal', fromTokenId: 't2', amount: 2 },
            { instanceId: 't1', title: 'Coal' }
        ]);
    });
});

describe('loot hop (effect 4), ground shadow and the slide into a pile', () => {
    let rec;
    beforeEach(() => { rec = recordAnimate(); });
    afterEach(() => rec.restore());

    /** A loot sprite's box as `SpriteLayerView` draws it: the art, its shadow, a count. */
    function lootBox(size = 64) {
        const box = document.createElement('button');
        box.innerHTML = `<div><span><span><span data-sprite-shadow="true"></span><img src="/${ITEM}" style="width: ${size}px; height: ${size}px"></span></span></div><span>3</span>`;
        document.body.appendChild(box);
        return box;
    }

    it('arcs up and over from its Token in whole art pixels and lands with a one-pixel bounce', () => {
        const poses = lootHopPoses(-120, 60, 2);
        expect(poses).toHaveLength(HOP_POSES + 2);
        expect(poses[0]).toMatchObject({ x: -60, y: 30, lift: 0 });
        expect(Math.max(...poses.map(p => p.lift))).toBeGreaterThanOrEqual(6);
        expect(poses.slice(-2).map(p => [p.x, p.y])).toEqual([[0, 0], [0, -1]]);
    });

    it('steps the box, keeps the shadow on the ground, trails two copies, and scales nothing', () => {
        const box = lootBox();
        playLootArc(box, -120, 60, { unit: 2 });
        const hop = rec.calls.find(a => a.el === box);
        const ground = rec.calls.find(a => a.el.getAttribute('data-sprite-shadow'));
        expect(hop.keyframes.slice(0, -1).every(k => k.easing === 'steps(1, end)')).toBe(true);
        // Mid-air the box is lifted and the shadow is pushed back down by the same height.
        const i = HOP_POSES / 2;
        const lift = lootHopPoses(-120, 60, 2)[i].lift;
        expect(ground.keyframes[i].transform).toBe(`translate(0px, ${lift * 2}px)`);
        expect(box.querySelectorAll('[data-fx-copy^="white-dither"]')).toHaveLength(2);
        expect(rec.calls.every(a => a.keyframes.every(k => !/scale/.test(k.transform || '') && k.opacity === undefined))).toBe(true);
    });

    it('slides into its pile in three steps, then dissolves: half its pixels, a quarter, gone', () => {
        const box = lootBox();
        playAbsorptionSlide(box, 30, 0, { unit: 2 });
        const slide = rec.calls.find(a => a.el === box);
        expect(slide.keyframes.map(k => k.transform)).toEqual([
            'translate(10px, 0px)', 'translate(20px, 0px)', 'translate(30px, 0px)', 'translate(30px, 0px)', 'translate(30px, 0px)', 'translate(30px, 0px)'
        ]);
        expect(slide.keyframes[5].visibility).toBe('hidden');
        expect([...box.querySelectorAll('[data-fx-copy]')].map(c => c.getAttribute('data-fx-copy'))).toEqual(['dither-50', 'dither-25']);
        expect(rec.calls.every(a => a.keyframes.every(k => !/scale/.test(k.transform || '') && k.opacity === undefined))).toBe(true);
    });
});

describe('rare drop twinkle (effect 10)', () => {
    it('a drop from a line at 10 % or less is announced; anything commoner, or nothing, is not', () => {
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.RARE_DROP, (p) => heard.push(p));
        RareDrops.noteDrop({ id: 's1', refId: 'i' }, 10);
        RareDrops.noteDrop({ id: 's2', refId: 'i' }, 25);
        RareDrops.noteDrop({ id: 's3', refId: 'i' }, 100);
        RareDrops.noteDrop(null, 5);
        off();
        expect(heard).toEqual([{ spriteId: 's1', itemId: 'i', chance: 10 }]);
        expect(RareDrops.RARE_DROP_CHANCE).toBe(10);
    });

    it('the floor’s sprite learns it once, as it appears', () => {
        recordRareDrop({ spriteId: 'sx' }, 1000);
        expect(takeRareDrop('sx', 1500)).toBe(true);
        expect(takeRareDrop('sx', 1500)).toBe(false);
        recordRareDrop({ spriteId: 'sy' }, 1000);
        expect(takeRareDrop('sy', 9000)).toBe(false);
    });

    it('once landed: a gold copy for two frames, then a five-pixel plus star flickering twice', () => {
        const rec = recordAnimate();
        try {
            const box = document.createElement('button');
            box.innerHTML = `<div><span><span><img src="/${ITEM}" style="width: 64px; height: 64px"></span></span></div>`;
            document.body.appendChild(box);
            playRareTwinkle(box, { unit: 2, delay: 560 });
            const gold = box.querySelector('[data-fx-copy="gold"]');
            expect(gold.firstChild.style.backgroundImage).toBe(`url("/_gen/sprite-fx/tint-gold/${ITEM}")`);
            const star = box.querySelector('[data-fx-star]');
            expect([...star.children].map(b => [b.style.width, b.style.height])).toEqual([['10px', '2px'], ['2px', '10px']]);
            const flicker = rec.calls.find(a => a.el === star);
            expect(flicker.options.delay).toBe(560 + 2 * FX_FRAME_MS);
            expect(flicker.keyframes.map(k => k.visibility)).toEqual(['visible', 'visible', 'hidden', 'visible', 'visible', 'hidden', 'hidden']);
        } finally {
            rec.restore();
        }
    });
});

describe('the Guild Hall dips a pixel as loot lands on it (effect 5)', () => {
    it('one art pixel down for two frames, a transform on its art; no filter, no redraw', async () => {
        registerTokenTypes({
            fixture_fx_hall: {
                id: 'fixture_fx_hall', name: 'Fixture Hall', tokenType: 'building', isGuildHall: true,
                rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature'
            }
        });
        GameState.initNew();
        clearMat();
        const hall = placeAt('fixture_fx_hall', 600, 500);
        const rec = recordAnimate();
        try {
            const { container } = render(React.createElement(DndContext, null, React.createElement(MatBoard, {})));
            const art = container.querySelector(`[data-token-art][data-token-id="${hall.id}"]`);
            const before = art.innerHTML;
            act(() => { EventBus.publish(UI_EVENTS.PARTICLE_LANDED, { landsOn: 'stub' }); });
            expect(rec.calls).toHaveLength(0);
            act(() => { EventBus.publish(UI_EVENTS.PARTICLE_LANDED, { landsOn: 'hall' }); });
            expect(rec.calls).toHaveLength(1);
            const dip = rec.calls[0];
            expect(art.contains(dip.el)).toBe(true);
            expect(dip.options.duration).toBe(2 * FX_FRAME_MS);
            expect(dip.keyframes[0].transform).toMatch(/^translate\(0px, [\d.]+px\)$/);
            expect(art.innerHTML).toBe(before);
            expect(art.innerHTML).not.toMatch(/brightness|saturate/);
        } finally {
            rec.restore();
            cleanup();
        }
    });
});

describe('colour flash on a hero: green when food heals them in a fight', () => {
    it('copies the hero’s sheet holder, frame and facing kept, with the green picture; gone after two frames', () => {
        const rec = recordAnimate();
        const host = document.createElement('div');
        document.body.appendChild(host);
        MatFx.attachFxHost(host, 2);
        const unwatch = MatFx.watchMatFx();
        try {
            const hero = document.createElement('button');
            hero.setAttribute('data-board-hero', 'h1');
            hero.innerHTML = `<div><span data-sprite-ring="work"></span><div class="absolute inset-0 overflow-hidden"><div style="transform: scaleX(-1)">` +
                `<img src="/${SHEET}" style="transform: translate(-128px, -256px)"></div></div></div>`;
            document.body.appendChild(hero);
            EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATE, { heroId: 'h1', healed: 0 });
            expect(hero.querySelector('[data-fx-copy]')).toBeNull();
            EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATE, { heroId: 'h1', healed: 12 });
            const copy = hero.querySelector('[data-fx-copy="green"]');
            expect(copy.querySelector('img').getAttribute('src')).toBe(`/_gen/sprite-fx/tint-green/${SHEET}`);
            expect(copy.querySelector('img').style.transform).toBe('translate(-128px, -256px)');
            expect(copy.firstChild.style.transform).toBe('scaleX(-1)');
            expect(copy.querySelector('[data-sprite-ring]')).toBeNull();
            rec.calls.find(a => a.el === copy).finish();
            expect(hero.querySelector('[data-fx-copy]')).toBeNull();
        } finally {
            unwatch();
            MatFx.attachFxHost(null);
            rec.restore();
        }
    });
});

describe('Region settle (effect 18)', () => {
    it('the Hall first, then the rest by their distance from it, the whole ripple capped', () => {
        const tokens = [
            { id: 'far', typeId: 'fixture_producer', x: 1500, y: 900 },
            { id: 'hall', typeId: 'token_guild_hall', x: 800, y: 500 },
            { id: 'near', typeId: 'fixture_producer', x: 900, y: 500 },
            { id: 'mid', typeId: 'fixture_producer', x: 500, y: 300 }
        ];
        const waits = settlePlan(tokens);
        expect(waits.get('hall')).toBe(HALL_SETTLE_MS);
        expect(waits.get('near')).toBeGreaterThan(waits.get('hall'));
        expect(waits.get('mid')).toBeGreaterThan(waits.get('near'));
        expect(waits.get('far')).toBeGreaterThan(waits.get('mid'));
        expect(Math.max(...waits.values())).toBeLessThanOrEqual(HALL_SETTLE_MS + 150 + SETTLE_SPREAD_MS);
    });

    it('each Token is told once, drawn before or after the arrival; out of sight until its turn, then the landing hop', () => {
        GameState.initNew();
        clearMat();
        const t = placeAt('fixture_producer', 500, 500);
        const heard = [];
        const off = EventBus.subscribe(UI_EVENTS.UI_TOKEN_FX, (p) => heard.push(p));
        beginSettle(1000);
        off();
        expect(heard).toEqual([{ instanceId: t.id, fx: 'settle' }]);
        const wait = takeSettle(t.id, 1100);
        expect(wait).toBeGreaterThanOrEqual(0);
        expect(takeSettle(t.id, 1100)).toBeNull();

        const rec = recordAnimate();
        try {
            const box = document.createElement('div');
            playSettle([box], 400);
            const k = rec.calls[0].keyframes;
            expect(k[0]).toMatchObject({ visibility: 'hidden', transform: 'translate(0px, 0px)' });
            expect(k[1]).toMatchObject({ visibility: 'visible', transform: 'translate(0px, -20px)' });
            expect(k.at(-1)).toMatchObject({ visibility: 'visible', transform: 'translate(0px, 0px)' });
            expect(rec.calls[0].options.duration).toBe(400 + LAND_MS);
            expect(box.style.willChange).toBe('contents');
            rec.calls[0].onfinish();
            expect(box.style.willChange).toBe('');
        } finally {
            rec.restore();
        }
    });
});

describe('picking up flies the picture to the cursor (T-154)', () => {
    const rect = { left: 100, top: 200, width: 128, height: 128 };
    const press = { clientX: 120, clientY: 300 };

    it('snaps the ghost onto the cursor from its first frame, from the box the drag started on', () => {
        const { modifier, state } = createPickupFlight();
        const t = modifier({ activatorEvent: press, activeNodeRect: rect, draggingNodeRect: null, transform: { x: 8, y: 0, scaleX: 1, scaleY: 1 } });
        // The press was 44 px left of the box's centre and 36 px below it.
        expect([t.x, t.y]).toEqual([8 - 44, 36]);
        expect(state.offset).toEqual({ x: -44, y: 36 });
        // Later moves keep the same snap even once the ghost is measured somewhere else.
        const t2 = modifier({ activatorEvent: press, activeNodeRect: rect, draggingNodeRect: { left: 0, top: 0, width: 128, height: 128 }, transform: { x: 50, y: 10 } });
        expect([t2.x, t2.y]).toEqual([50 - 44, 10 + 36]);
        // A new drag measures afresh.
        modifier({ activatorEvent: { clientX: 164, clientY: 264 }, activeNodeRect: rect, transform: { x: 0, y: 0 } });
        expect(state.offset).toEqual({ x: 0, y: 0 });
    });

    it('the picture starts where its source stood and steps to the cursor in 80 ms, whole pixels; reads no layout', () => {
        const rec = recordAnimate();
        try {
            const el = document.createElement('div');
            el.getBoundingClientRect = vi.fn();
            playPickupFlight(el, { x: -44, y: 36 });
            const { keyframes, options } = rec.calls[0];
            expect(options.duration).toBe(PICKUP_MS);
            expect(keyframes.map(k => k.transform)).toEqual([
                'translate(44px, -36px)', 'translate(22px, -18px)', 'translate(9px, -7px)', 'translate(2px, -2px)', 'translate(0px, 0px)'
            ]);
            expect(keyframes.slice(0, -1).every(k => k.easing === 'steps(1, end)')).toBe(true);
            expect(el.getBoundingClientRect).not.toHaveBeenCalled();
            // Pressed on its middle: nothing to fly.
            expect(playPickupFlight(el, { x: 1, y: 0 })).toBeNull();
        } finally {
            rec.restore();
        }
    });
});
