// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { GameState } from '../state/GameState.js';
import * as Camps from '../systems/board/Camps.js';
import { tokensWithin } from '../systems/board/nearby.js';
import * as ReachDisplay from '../systems/board/reachDisplay.js';
import { showsNearRing, reachDotsAt } from '../systems/board/reachDisplay.js';
import { STANDARD_REACH_U } from '../config/registries/reachRegistry.js';
import { MatRings } from '../ui/components/board/MatRings.jsx';
import { DeckDndContext, DragPointerContext } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { REACH_DOT, REACH_DOT_PATHS } from '../ui/components/board/reachDot.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * ⭐ The reach ring and its in-reach dots (brief 560 R2): a Foundation and a camp show the one
 * standard ring; every Token inside it wears a dot, by the engine's own distance test, so a dot
 * never disagrees with what a camp works; the dots are worked out when the ring moves to a new
 * spot, not every frame, and not at all while nothing is hovered or carried.
 */

registerTokenTypes({
    rdot_foundation: {
        id: 'rdot_foundation', name: 'Dot Foundation', tokenType: 'foundation', sprite: 's_nature',
        requiresHero: false, foundation: { kind: 'wood', skill: 'construction' }
    },
    rdot_camp: {
        id: 'rdot_camp', name: 'Dot Camp', tokenType: 'camp', sprite: 's_nature',
        requiresHero: false, config: null, camp: { skill: 'woodcutting' }
    },
    rdot_tree: {
        id: 'rdot_tree', name: 'Dot Tree', tokenType: 'resource', sprite: 's_nature', uses: null,
        config: { skill: 'woodcutting', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] }
    }
});

const h = React.createElement;
const R = STANDARD_REACH_U;

beforeEach(() => { GameState.initNew(); clearMat(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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

describe('which Tokens use reach', () => {
    it('an unbuilt Foundation and a work camp show the ring', () => {
        expect(showsNearRing('rdot_foundation')).toBe(true);
        expect(showsNearRing('rdot_camp')).toBe(true);
        expect(showsNearRing('rdot_tree')).toBe(false);
    });
});

describe('reachDotsAt: the engine\'s own test', () => {
    it('a Token exactly at the reach is in, one mat unit past it is out, and the camp works the same ones', () => {
        const camp = placeAt('rdot_camp', 600, 500);
        const edge = placeAt('rdot_tree', 600 + R, 500);
        const past = placeAt('rdot_tree', 600, 500 - R - 1);
        const near = placeAt('rdot_tree', 650, 560);

        const dots = reachDotsAt(camp, camp.id).map(d => d.id).sort();
        expect(dots).toEqual([edge.id, near.id].sort());
        expect(dots).toEqual([...tokensWithin(camp, R, camp.id)].sort());
        // What the camp hands out is exactly the dotted trees.
        const worked = Camps.campWork(camp).map(t => t.id).sort();
        expect(worked).toEqual(dots);
        expect(Camps.isCampWork(camp, past)).toBe(false);
    });

    it('never dots the Token the ring belongs to; each dot stands on its Token\'s centre', () => {
        const f = placeAt('rdot_foundation', 400, 400);
        const t = placeAt('rdot_tree', 450, 410);
        expect(reachDotsAt(f, f.id)).toEqual([{ id: t.id, x: 450, y: 410 }]);
    });
});

describe('MatRings: the ring and its dots', () => {
    it('draws nothing and works nothing out while nothing is hovered or carried', () => {
        placeAt('rdot_tree', 500, 500);
        const spy = vi.spyOn(ReachDisplay, 'reachDotsAt');
        const { container } = rings();
        expect(container.querySelector('[data-near-ring]')).toBeNull();
        expect(spy).not.toHaveBeenCalled();
    });

    it('hovering a camp: the ring on its centre, a dot on each Token in reach and none past it', () => {
        const camp = placeAt('rdot_camp', 600, 500);
        const inside = placeAt('rdot_tree', 600 + R, 500);
        placeAt('rdot_tree', 600 - R - 1, 500);
        const { container } = rings({ hoveredCentre: { x: camp.x, y: camp.y, id: camp.id } });
        const ring = container.querySelector('[data-near-ring]');
        expect(Number(ring.getAttribute('data-cx'))).toBe(600);
        expect(Number(ring.getAttribute('data-r'))).toBe(R);
        expect(dotIds(container)).toEqual([inside.id]);
    });

    it('carrying a Foundation from the Shop: the ring and dots follow its landing, worked out once per new spot', () => {
        const a = placeAt('rdot_tree', 500, 500);
        const b = placeAt('rdot_tree', 1000, 500);
        const spy = vi.spyOn(ReachDisplay, 'reachDotsAt');
        const payload = { kind: DRAG_KIND.TOKEN, typeId: 'rdot_foundation', from: null };

        const { container, again } = rings({ payload, pointer: { x: 400, y: 500 } });
        expect(container.querySelector('[data-near-ring]')).not.toBeNull();
        expect(dotIds(container)).toEqual([a.id]);
        expect(spy).toHaveBeenCalledTimes(1);

        // The next frame, the pointer at the same spot: nothing worked out again.
        again({ x: 400, y: 500 });
        expect(spy).toHaveBeenCalledTimes(1);

        again({ x: 1100, y: 500 });
        expect(spy).toHaveBeenCalledTimes(2);
        expect(dotIds(container)).toEqual([b.id]);
    });

    it('carrying a camp across the mat: its ring shows, and it does not dot itself where it stood', () => {
        const camp = placeAt('rdot_camp', 500, 500);
        const t = placeAt('rdot_tree', 560, 500);
        const payload = { kind: DRAG_KIND.TOKEN, typeId: 'rdot_camp', from: { instanceId: camp.id } };
        const { container } = rings({ payload, pointer: { x: 520, y: 500 } });
        expect(container.querySelector('[data-near-ring]')).not.toBeNull();
        expect(dotIds(container)).toEqual([t.id]);
    });

    it('carrying a Token that uses no reach: no ring, nothing worked out', () => {
        placeAt('rdot_tree', 500, 500);
        const spy = vi.spyOn(ReachDisplay, 'reachDotsAt');
        const payload = { kind: DRAG_KIND.TOKEN, typeId: 'rdot_tree', from: null };
        const { container } = rings({ payload, pointer: { x: 400, y: 500 } });
        expect(container.querySelector('[data-near-ring]')).toBeNull();
        expect(spy).not.toHaveBeenCalled();
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
