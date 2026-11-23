// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { GameState } from '../state/GameState.js';
import * as Camps from '../systems/board/Camps.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as Demolition from '../systems/board/Demolition.js';
import { tokensWithin } from '../systems/board/nearby.js';
import * as ReachDisplay from '../systems/board/reachDisplay.js';
import { showsNearRing, reachTargets, reachDotsAt } from '../systems/board/reachDisplay.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { STANDARD_REACH_U } from '../config/registries/reachRegistry.js';
import { CampReachRing } from '../ui/components/board/CampReachRing.jsx';
import { MatRings } from '../ui/components/board/MatRings.jsx';
import { DeckDndContext, DragPointerContext } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { REACH_DOT, REACH_DOT_PATHS } from '../ui/components/board/reachDot.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { manualFrames } from './fixtures/manualFrames.js';
import { RING_GROW_MS, ringTween, ringPxAt } from '../ui/components/board/growRing.js';
import { setDrawingPaused } from '../ui/components/board/frameClock.js';

/**
 * ⭐ The reach ring and its in-reach dots (brief 560 R2, playmat declutter §2): a Foundation, a camp
 * and a Token whose rules involve its neighbours show the one standard ring; a Token inside it wears
 * a dot only when the ringed Token acts on or depends on it, by the engine's own tests (a Logging
 * Camp dots trees, not ore veins), and within reach by the engine's own distance test, so a dot
 * never disagrees with what is worked. What it touches is worked out once for a hover or a drag,
 * the dots when the ring moves to a new spot, never every frame, and not at all while nothing is
 * hovered or carried.
 */

const rule = (id, keyword, extra) => ({ id, keyword, chargeDelta: 0, upkeep: null, ...extra });

registerTokenTypes({
    rdot_foundation: {
        id: 'rdot_foundation', name: 'Dot Foundation', tokenType: 'foundation', sprite: 's_nature',
        requiresHero: false, foundation: { kind: 'rdot_wood', skill: 'rdot_building' }
    },
    rdot_camp: {
        id: 'rdot_camp', name: 'Dot Camp', tokenType: 'camp', sprite: 's_nature',
        requiresHero: false, config: null, camp: { skill: 'woodcutting' }
    },
    rdot_tree: {
        id: 'rdot_tree', name: 'Dot Tree', tokenType: 'resource', sprite: 's_nature', uses: null,
        tags: ['Oak'],
        config: { skill: 'woodcutting', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] }
    },
    rdot_vein: {
        id: 'rdot_vein', name: 'Dot Vein', tokenType: 'resource', sprite: 's_nature', uses: null,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] }
    },
    /** A support for one tag: speeds the growth of Oak-tagged Tokens beside it. */
    rdot_grove: {
        id: 'rdot_grove', name: 'Dot Grove', tokenType: 'resource', sprite: 's_nature', uses: null,
        statements: [rule('stm_rdot_grove', KEYWORD.PROVIDES, {
            payload: { type: 'GROW_TIME', bucket: 'percentage', value: -0.25 },
            to: { mode: 'tag', value: 'Oak' }, reach: 'nearby'
        })]
    },
    /** A support for every Token, narrowed to Mining work. */
    rdot_mine_buff: {
        id: 'rdot_mine_buff', name: 'Dot Mine Buff', tokenType: 'resource', sprite: 's_nature', uses: null,
        statements: [rule('stm_rdot_mine_buff', KEYWORD.PROVIDES, {
            payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.1, category: 'mining' },
            to: { mode: 'all', value: '' }, reach: 'nearby',
            upkeep: { items: [{ itemId: 'item_coal', quantity: 1 }], cadenceMs: 60000 }
        })]
    },
    /** No more than two Coast Tokens beside it. */
    rdot_coast: {
        id: 'rdot_coast', name: 'Dot Coast', tokenType: 'resource', sprite: 's_nature', uses: null,
        tags: ['Coast'],
        statements: [rule('stm_rdot_coast', KEYWORD.CANNOT, {
            payload: { kind: 'adjacency_limit', max: 2 }, to: { mode: 'tag', value: 'Coast' }
        })]
    },
    /** Set off when a tree beside it finishes a cycle. */
    rdot_listener: {
        id: 'rdot_listener', name: 'Dot Listener', tokenType: 'resource', sprite: 's_nature', uses: null,
        statements: [rule('stm_rdot_listener', KEYWORD.RESTORES, {
            payload: { amount: 1 }, target: { role: 'self' },
            when: { event: 'NEARBY_CYCLE_COMPLETE', scope: 'nearby', cooldownMs: 0, source: { mode: 'id', value: 'rdot_tree' } }
        })]
    },
    /** Hurts the hero once for each Coast Token beside it. */
    rdot_counter: {
        id: 'rdot_counter', name: 'Dot Counter', tokenType: 'resource', sprite: 's_nature', uses: null,
        statements: [rule('stm_rdot_counter', KEYWORD.DEALS, {
            payload: { amount: 1 }, target: { role: 'actor' },
            when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 },
            counted: { mode: 'tag', value: 'Coast', reach: 'nearby' }
        })]
    },
    /** Hands the anvil capability to the stations beside it. */
    rdot_anvil: {
        id: 'rdot_anvil', name: 'Dot Anvil', tokenType: 'context', sprite: 's_industry', uses: null,
        statements: [rule('stm_rdot_anvil', KEYWORD.ACTS_AS, { payload: { tag: 'rdot_anvil_tag', tier: 1 } })]
    },
    /** A station whose one recipe wants the anvil beside it. */
    rdot_forge: {
        id: 'rdot_forge', name: 'Dot Forge', tokenType: 'station', sprite: 's_industry', uses: null,
        config: { skill: 'rdot_smithing', skillRequired: 1, cycleTimeMs: 1000, xp: 1 },
        statements: [rule('stm_rdot_forge', KEYWORD.STATION, { payload: { skill: 'rdot_smithing' } })]
    }
});

registerRecipePools({
    rdot_building: [{
        id: 'rdot_build_camp', name: 'Build Dot Camp', levelRequirement: 1, foundationKinds: ['rdot_wood'],
        inputs: [], outputs: [{ tokenId: 'rdot_camp', chance: 100, minQty: 1, maxQty: 1 }], durationMs: 1000, xp: 1
    }],
    rdot_smithing: [{
        id: 'rdot_forge_blade', name: 'Forge a Blade', levelRequirement: 1,
        requiresContext: [{ tag: 'rdot_anvil_tag', minTier: 1, chargeCost: 0 }],
        inputs: [], outputs: [{ itemId: 'item_coal', quantity: 1, chance: 100 }], durationMs: 1000, xp: 1
    }]
});

const h = React.createElement;
const R = STANDARD_REACH_U;

let frames;
beforeEach(() => { GameState.initNew(); clearMat(); frames = manualFrames(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/** Runs frames until a ring just shown has grown to its full radius. */
const grow = () => frames.run(RING_GROW_MS + 32);

function fakeMatEl() {
    return { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1760, height: 1126, right: 1760, bottom: 1126, x: 0, y: 0 }) };
}

/** MatRings mounted as the mat mounts it, with a drag (or none) and a hover (or none). */
function rings({ payload = null, pointer = null, hoveredCentre = null, boardTokens = null } = {}) {
    const matRef = { current: fakeMatEl() };
    const tree = (p, hc) => h(
        DeckDndContext.Provider,
        { value: { activePayload: payload, isDragging: !!payload } },
        h(DragPointerContext.Provider, { value: p }, h(MatRings, { matRef, hoveredCentre: hc, boardTokens }))
    );
    const out = render(tree(pointer, hoveredCentre));
    return { ...out, again: (p, hc = hoveredCentre) => out.rerender(tree(p, hc)) };
}

const dotIds = (container) => [...container.querySelectorAll('[data-reach-dot]')].map(el => el.getAttribute('data-reach-dot')).sort();

/** The ids a Token on the mat dots where it stands, sorted. */
const dotsOf = (self) => reachDotsAt(self, reachTargets(self.typeId, self)).map(d => d.id).sort();
const ids = (...tokens) => tokens.map(t => t.id).sort();

describe('which Tokens use reach', () => {
    it('an unbuilt Foundation and a work camp show the ring', () => {
        expect(showsNearRing('rdot_foundation')).toBe(true);
        expect(showsNearRing('rdot_camp')).toBe(true);
        expect(showsNearRing('rdot_tree')).toBe(false);
    });
});

describe('reachDotsAt: the engine\'s own distance test', () => {
    it('a Token exactly at the reach is in, one mat unit past it is out, and the camp works the same ones', () => {
        const camp = placeAt('rdot_camp', 600, 500);
        const edge = placeAt('rdot_tree', 600 + R, 500);
        const past = placeAt('rdot_tree', 600, 500 - R - 1);
        const near = placeAt('rdot_tree', 650, 560);

        const dots = dotsOf(camp);
        expect(dots).toEqual(ids(edge, near));
        expect(dots).toEqual([...tokensWithin(camp, R, camp.id)].sort());
        // What the camp hands out is exactly the dotted trees.
        const worked = Camps.campWork(camp).map(t => t.id).sort();
        expect(worked).toEqual(dots);
        expect(Camps.isCampWork(camp, past)).toBe(false);
    });

    it('never dots the Token the ring belongs to; each dot stands on its Token\'s centre', () => {
        const camp = placeAt('rdot_camp', 400, 400);
        const t = placeAt('rdot_tree', 450, 410);
        expect(reachTargets('rdot_camp', camp)).toEqual([{ id: t.id, x: 450, y: 410 }]);
        expect(reachDotsAt(camp, reachTargets('rdot_camp', camp))).toEqual([{ id: t.id, x: 450, y: 410 }]);
    });
});

describe('⭐ dots only on what the Token acts on or depends on (playmat declutter §2)', () => {
    it('⭐ a Logging Camp dots trees, not an ore vein beside them, nor a Token marked for demolition', () => {
        const camp = placeAt('rdot_camp', 600, 500);
        const tree = placeAt('rdot_tree', 680, 500);
        const vein = placeAt('rdot_vein', 600, 580);
        const marked = placeAt('rdot_tree', 520, 500);
        marked.demolish = true;
        expect(Demolition.isMarked(marked)).toBe(true);
        expect(dotsOf(camp)).toEqual(ids(tree));
        expect(dotsOf(camp)).not.toContain(vein.id);
        // Exactly what the camp hands out.
        expect(Camps.campWork(camp).map(t => t.id)).toEqual([tree.id]);
    });

    it('a camp marked for demolition hands out nothing, so it dots nothing', () => {
        const camp = placeAt('rdot_camp', 600, 500);
        placeAt('rdot_tree', 680, 500);
        camp.demolish = true;
        expect(dotsOf(camp)).toEqual([]);
    });

    it('a support for one tag dots only the Tokens of that tag', () => {
        const grove = placeAt('rdot_grove', 600, 500);
        const oak = placeAt('rdot_tree', 680, 500);
        placeAt('rdot_vein', 600, 580);
        expect(dotsOf(grove)).toEqual(ids(oak));
    });

    it('a support narrowed to a skill dots only that skill\'s Tokens, and nothing while its upkeep is unpaid', () => {
        const buff = placeAt('rdot_mine_buff', 600, 500);
        placeAt('rdot_tree', 680, 500);
        const vein = placeAt('rdot_vein', 600, 580);
        expect(dotsOf(buff)).toEqual(ids(vein));
        buff.blockUpkeep = { stm_rdot_mine_buff: { paid: false } };
        expect(dotsOf(buff)).toEqual([]);
        // From the Shop it has no upkeep owing yet.
        expect(reachDotsAt(buff, reachTargets('rdot_mine_buff', null)).map(d => d.id)).toEqual([vein.id]);
    });

    it('a Cannot rule dots the Tokens it counts', () => {
        const coast = placeAt('rdot_coast', 600, 500);
        const other = placeAt('rdot_coast', 680, 500);
        placeAt('rdot_tree', 600, 580);
        expect(dotsOf(coast)).toEqual(ids(other));
    });

    it('a rule set off by a nearby Token dots the Tokens that can set it off; a count, the Tokens it counts', () => {
        const listener = placeAt('rdot_listener', 600, 500);
        const tree = placeAt('rdot_tree', 680, 500);
        const coast = placeAt('rdot_coast', 600, 580);
        expect(dotsOf(listener)).toEqual(ids(tree));
        const counter = placeAt('rdot_counter', 640, 540);
        expect(dotsOf(counter)).toEqual(ids(coast));
    });

    it('an Acts as dots the stations whose chosen recipe wants it; the station dots what hands it what it wants', () => {
        const anvil = placeAt('rdot_anvil', 600, 500);
        const forge = placeAt('rdot_forge', 680, 500);
        const idle = placeAt('rdot_forge', 520, 500);
        placeAt('rdot_tree', 600, 580);
        expect(StationRecipe.setSelectedRecipe(forge, 'rdot_forge_blade')).toBe(true);
        // A forge with no recipe chosen wants nothing yet.
        expect(dotsOf(anvil)).toEqual(ids(forge));
        expect(dotsOf(forge)).toEqual(ids(anvil));
        expect(dotsOf(idle)).toEqual([]);
    });

    it('⭐ a Foundation dots what its chosen building would touch, and nothing before one is chosen', () => {
        const f = placeAt('rdot_foundation', 600, 500);
        const tree = placeAt('rdot_tree', 680, 500);
        placeAt('rdot_vein', 600, 580);
        expect(dotsOf(f)).toEqual([]);
        expect(reachTargets('rdot_foundation', null)).toEqual([]);
        expect(StationRecipe.setSelectedRecipe(f, 'rdot_build_camp')).toBe(true);
        expect(dotsOf(f)).toEqual(ids(tree));
    });
});

describe('MatRings: the ring and its dots', () => {
    it('draws nothing and works nothing out while nothing is hovered or carried', () => {
        placeAt('rdot_tree', 500, 500);
        const spy = vi.spyOn(ReachDisplay, 'reachDotsAt');
        const targets = vi.spyOn(ReachDisplay, 'reachTargets');
        const { container } = rings();
        expect(container.querySelector('[data-near-ring]')).toBeNull();
        expect(spy).not.toHaveBeenCalled();
        expect(targets).not.toHaveBeenCalled();
    });

    it('hovering a camp: the ring on its centre, a dot on each Token in reach and none past it', () => {
        const camp = placeAt('rdot_camp', 600, 500);
        const inside = placeAt('rdot_tree', 600 + R, 500);
        placeAt('rdot_tree', 600 - R - 1, 500);
        const { container } = rings({ hoveredCentre: { x: camp.x, y: camp.y, id: camp.id } });
        grow();
        const ring = container.querySelector('[data-near-ring]');
        expect(Number(ring.getAttribute('data-cx'))).toBe(600);
        expect(Number(ring.getAttribute('data-r'))).toBe(R);
        expect(dotIds(container)).toEqual([inside.id]);
    });

    it('the ring and its dots are drawn inside a clip to the mat, so a ring at an edge stops there', () => {
        const camp = placeAt('rdot_camp', 20, 20);
        placeAt('rdot_tree', 60, 30);
        const { container } = rings({ hoveredCentre: { x: camp.x, y: camp.y, id: camp.id } });
        grow();
        const clip = container.querySelector('[data-reach-clip]');
        expect(clip).not.toBeNull();
        expect(clip.className).toContain('overflow-hidden');
        expect(clip.className).toContain('pointer-events-none');
        expect(clip.style.borderRadius).not.toBe('');
        expect(clip.querySelector('[data-near-ring]')).not.toBeNull();
        expect(clip.querySelector('[data-reach-dot]')).not.toBeNull();
    });

    it('the hero-lit camp ring is clipped the same way', () => {
        const { container } = render(h(CampReachRing, { ring: { campId: 'c1', x: 10, y: 10, r: R } }));
        const clip = container.querySelector('[data-reach-clip]');
        expect(clip.className).toContain('overflow-hidden');
        expect(clip.querySelector('[data-camp-ring="c1"]')).not.toBeNull();
    });

    it('carrying a camp from the Shop: the ring and dots follow its landing; what it touches is worked out once, the dots once per new spot', () => {
        const a = placeAt('rdot_tree', 500, 500);
        const b = placeAt('rdot_tree', 1000, 500);
        placeAt('rdot_vein', 450, 520);
        const spy = vi.spyOn(ReachDisplay, 'reachDotsAt');
        const targets = vi.spyOn(ReachDisplay, 'reachTargets');
        const payload = { kind: DRAG_KIND.TOKEN, typeId: 'rdot_camp', from: null };

        const { container, again } = rings({ payload, pointer: { x: 400, y: 500 } });
        grow();
        expect(container.querySelector('[data-near-ring]')).not.toBeNull();
        expect(dotIds(container)).toEqual([a.id]);
        expect(spy).toHaveBeenCalledTimes(1);

        // The next frame, the pointer at the same spot: nothing worked out again.
        again({ x: 400, y: 500 });
        expect(spy).toHaveBeenCalledTimes(1);

        again({ x: 1100, y: 500 });
        expect(spy).toHaveBeenCalledTimes(2);
        expect(dotIds(container)).toEqual([b.id]);
        expect(targets).toHaveBeenCalledTimes(1);
    });

    it('carrying a Foundation from the Shop: its ring shows, and no dots, since no building is chosen yet', () => {
        placeAt('rdot_tree', 500, 500);
        const payload = { kind: DRAG_KIND.TOKEN, typeId: 'rdot_foundation', from: null };
        const { container } = rings({ payload, pointer: { x: 450, y: 500 } });
        grow();
        expect(container.querySelector('[data-near-ring]')).not.toBeNull();
        expect(dotIds(container)).toEqual([]);
    });

    it('⭐ hovering a camp beside a vein: the ring takes in both, only the tree is dotted', () => {
        const camp = placeAt('rdot_camp', 600, 500);
        const tree = placeAt('rdot_tree', 680, 500);
        placeAt('rdot_vein', 600, 580);
        const { container } = rings({ hoveredCentre: { x: camp.x, y: camp.y, id: camp.id } });
        grow();
        expect(dotIds(container)).toEqual([tree.id]);
    });

    it('carrying a camp across the mat: its ring shows, and it does not dot itself where it stood', () => {
        const camp = placeAt('rdot_camp', 500, 500);
        const t = placeAt('rdot_tree', 560, 500);
        const payload = { kind: DRAG_KIND.TOKEN, typeId: 'rdot_camp', from: { instanceId: camp.id } };
        const { container } = rings({ payload, pointer: { x: 520, y: 500 } });
        grow();
        expect(container.querySelector('[data-near-ring]')).not.toBeNull();
        expect(dotIds(container)).toEqual([t.id]);
    });

    it('carrying a Token that uses no reach: no ring, nothing worked out', () => {
        placeAt('rdot_tree', 500, 500);
        const spy = vi.spyOn(ReachDisplay, 'reachDotsAt');
        const targets = vi.spyOn(ReachDisplay, 'reachTargets');
        const payload = { kind: DRAG_KIND.TOKEN, typeId: 'rdot_tree', from: null };
        const { container } = rings({ payload, pointer: { x: 400, y: 500 } });
        expect(container.querySelector('[data-near-ring]')).toBeNull();
        expect(spy).not.toHaveBeenCalled();
        expect(targets).not.toHaveBeenCalled();
    });
});

describe('the dot\'s look (owner\'s pick A)', () => {
    it('seven art pixels across, one white highlight pixel, a shadow of the whole shape', () => {
        expect(REACH_DOT).toHaveLength(7);
        for (const row of REACH_DOT) expect(row).toHaveLength(7);
        expect(REACH_DOT.join('').split('w').length - 1).toBe(1);
        // The shadow is one run per row: the dot has no holes.
        expect((REACH_DOT_PATHS.shape.match(/M/g) || []).length).toBe(7);
    });
});

describe('the ring grows and shrinks (brief 720 R1)', () => {
    const pxOf = (container, sel = '[data-near-ring]') => {
        const el = container.querySelector(sel);
        return el ? Number(el.getAttribute('data-px')) : null;
    };

    /** Every `animate` call on an element, with what it played. */
    function recordAnimate() {
        const calls = [];
        const proto = window.Element.prototype;
        const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
        const original = proto.animate;
        proto.animate = function animate(keyframes, options) {
            calls.push({ el: this, keyframes, options });
            return { cancel() {}, finish() {}, onfinish: null, oncancel: null };
        };
        return { calls, restore() { if (had) proto.animate = original; else delete proto.animate; } };
    }

    it('the tween: whole art pixels, nothing to full in RING_GROW_MS, half a ring back in half the time', () => {
        const t = ringTween(0, 40, 40, 0);
        expect(t.ms).toBe(RING_GROW_MS);
        for (let ms = 0; ms <= RING_GROW_MS; ms += 7) expect(Number.isInteger(ringPxAt(t, ms))).toBe(true);
        expect(ringPxAt(t, 0)).toBe(0);
        expect(ringPxAt(t, RING_GROW_MS / 2)).toBe(20);
        expect(ringPxAt(t, RING_GROW_MS)).toBe(40);
        const back = ringTween(20, 0, 40, 0);
        expect(back.ms).toBe(RING_GROW_MS / 2);
        expect(ringPxAt(back, RING_GROW_MS / 2)).toBe(0);
    });

    it('⭐ a hovered camp\'s ring grows out from nothing, stepping, then stands still asking for no frames', () => {
        const camp = placeAt('rdot_camp', 600, 500);
        const { container } = rings({ hoveredCentre: { x: camp.x, y: camp.y, id: camp.id } });
        expect(pxOf(container)).toBe(0);
        const seen = [];
        for (let i = 0; i < 20; i++) {
            frames.frame(16);
            seen.push(pxOf(container));
        }
        const full = seen.at(-1);
        expect(full).toBeGreaterThan(10);
        // Growing all the way, never back, and full by RING_GROW_MS.
        for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
        expect(seen[Math.ceil(RING_GROW_MS / 16) - 1]).toBe(full);
        expect(seen.filter(px => px > 0 && px < full).length).toBeGreaterThan(5);
        expect(frames.pending()).toBe(0);
    });

    it('⭐ the dots come in as the ring reaches them, each with one pulse, and go as it shrinks past', () => {
        const rec = recordAnimate();
        try {
            const camp = placeAt('rdot_camp', 600, 500);
            const near = placeAt('rdot_tree', 650, 500);
            const far = placeAt('rdot_tree', 600 + R - 10, 500);
            const hc = { x: camp.x, y: camp.y, id: camp.id };
            const { container, again } = rings({ hoveredCentre: hc });
            const order = [];
            for (let i = 0; i < 20; i++) {
                frames.frame(16);
                for (const id of dotIds(container)) if (!order.includes(id)) order.push(id);
            }
            expect(order).toEqual([near.id, far.id]);
            const pulses = (id) => rec.calls.filter(c => c.el.getAttribute?.('data-reach-dot') === id).length;
            expect(pulses(near.id)).toBe(1);
            expect(pulses(far.id)).toBe(1);

            again(null, null);
            const gone = [];
            for (let i = 0; i < 20; i++) {
                frames.frame(16);
                gone.push(dotIds(container));
            }
            // The far dot goes first, the near one after; then the ring itself.
            const firstWithout = (id) => gone.findIndex(ids => !ids.includes(id));
            expect(firstWithout(far.id)).toBeLessThan(firstWithout(near.id));
            expect(container.querySelector('[data-near-ring]')).toBeNull();
            expect(frames.pending()).toBe(0);
        } finally {
            rec.restore();
        }
    });

    it('a hover that ends mid-grow shrinks from where it got to', () => {
        const camp = placeAt('rdot_camp', 600, 500);
        const { container, again } = rings({ hoveredCentre: { x: camp.x, y: camp.y, id: camp.id } });
        frames.run(RING_GROW_MS / 2);
        const mid = pxOf(container);
        expect(mid).toBeGreaterThan(0);
        again(null, null);
        expect(pxOf(container)).toBe(mid);
        frames.frame(16);
        expect(pxOf(container)).toBeLessThan(mid);
        // Half grown, it is back to nothing in about half the time.
        frames.run(RING_GROW_MS / 2);
        expect(container.querySelector('[data-near-ring]')).toBeNull();
    });

    it('hovering another Token grows its ring again from nothing', () => {
        const a = placeAt('rdot_camp', 400, 500);
        const b = placeAt('rdot_camp', 1200, 500);
        const { container, again } = rings({ hoveredCentre: { x: a.x, y: a.y, id: a.id } });
        grow();
        again(null, { x: b.x, y: b.y, id: b.id });
        expect(pxOf(container)).toBe(0);
        expect(Number(container.querySelector('[data-near-ring]').getAttribute('data-cx'))).toBe(1200);
        grow();
        expect(pxOf(container)).toBeGreaterThan(10);
    });

    it('⭐ a carried ring grows once, then follows the landing: no regrow, and only Tokens coming into reach pulse', () => {
        const rec = recordAnimate();
        try {
            const a = placeAt('rdot_tree', 500, 500);
            const b = placeAt('rdot_tree', 500 + R + 100, 500);
            const payload = { kind: DRAG_KIND.TOKEN, typeId: 'rdot_camp', from: null };
            const { container, again } = rings({ payload, pointer: { x: 450, y: 500 } });
            grow();
            const full = pxOf(container);
            expect(dotIds(container)).toEqual([a.id]);
            const pulses = (id) => rec.calls.filter(c => c.el.getAttribute?.('data-reach-dot') === id).length;
            expect(pulses(a.id)).toBe(1);

            again({ x: 650, y: 500 });
            expect(pxOf(container)).toBe(full);
            expect(frames.pending()).toBe(0);
            expect(dotIds(container)).toEqual([a.id, b.id].sort());
            expect(pulses(a.id)).toBe(1);
            expect(pulses(b.id)).toBe(1);
        } finally {
            rec.restore();
        }
    });

    it('while drawing is paused the ring shows whole at once and asks for no frames', () => {
        const camp = placeAt('rdot_camp', 600, 500);
        const t = placeAt('rdot_tree', 650, 500);
        setDrawingPaused(true);
        try {
            const { container, again } = rings({ hoveredCentre: { x: camp.x, y: camp.y, id: camp.id } });
            expect(pxOf(container)).toBeGreaterThan(10);
            expect(dotIds(container)).toEqual([t.id]);
            expect(frames.pending()).toBe(0);
            again(null, null);
            expect(container.querySelector('[data-near-ring]')).toBeNull();
        } finally {
            setDrawingPaused(false);
        }
    });

    it('a ring caught mid-grow by a pause stands still, and finishes on the first frame back', () => {
        const camp = placeAt('rdot_camp', 600, 500);
        const { container } = rings({ hoveredCentre: { x: camp.x, y: camp.y, id: camp.id } });
        frames.run(64);
        const mid = pxOf(container);
        setDrawingPaused(true);
        expect(frames.pending()).toBe(0);
        frames.run(RING_GROW_MS);
        expect(pxOf(container)).toBe(mid);
        setDrawingPaused(false);
        frames.frame(16);
        expect(pxOf(container)).toBeGreaterThan(mid);
        expect(frames.pending()).toBe(0);
    });

    it('the hero-lit camp ring grows the same way, and keeps its camp mark while it shrinks', () => {
        const ring = { campId: 'c1', x: 600, y: 500, r: R };
        const out = render(h(CampReachRing, { ring }));
        expect(pxOf(out.container, '[data-camp-ring="c1"]')).toBe(0);
        grow();
        const full = pxOf(out.container, '[data-camp-ring="c1"]');
        expect(full).toBeGreaterThan(10);
        out.rerender(h(CampReachRing, { ring: null }));
        frames.frame(16);
        const shrinking = pxOf(out.container, '[data-camp-ring="c1"]');
        expect(shrinking).toBeGreaterThan(0);
        expect(shrinking).toBeLessThan(full);
        grow();
        expect(out.container.querySelector('[data-camp-ring]')).toBeNull();
    });
});
