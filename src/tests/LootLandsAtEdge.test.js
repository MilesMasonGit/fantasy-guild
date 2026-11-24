import { describe, it, expect, beforeEach } from 'vitest';
import './fixtures/fixtureItems.js';
import './fixtures/testTokens.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import { taskRingOf, oneHeroReachOf } from '../systems/board/jobArea.js';
import { taskRingOf as uiTaskRingOf } from '../ui/components/board/taskRing.js';
import { STAND_GAP } from '../systems/board/standing.js';
import { artRadiusOf } from '../config/matGeometry.js';
import { GameState } from '../state/GameState.js';
import { createEmptyBoard } from '../state/StateSchema.js';

const ITEM = 'fixture_oak_wood';
const TYPE = 'fixture_producer';
const ART = 2;
/** Different items, so no drop joins another's stack. */
const ITEMS = ['fixture_oak_wood', 'fixture_charcoal', 'fixture_copper_ore', 'fixture_control_item'];

function place(x, y) {
    return BoardState.addToken(BoardState.createTokenInstance(TYPE), x, y);
}

/** A hero standing still at `point`, working `token`. */
function work(heroId, token, point) {
    BoardState.setClaim(heroId, { instanceId: token.id, typeId: token.typeId, x: token.x, y: token.y });
    BoardState.setHeroBody(heroId, { x: point.x, y: point.y, moving: false, atWork: token.id, facing: 1 });
}

const off = (sprite, centre) => Math.hypot(sprite.x - centre.x, sprite.y - centre.y);

describe('loot lands on the edge of its job area', () => {
    beforeEach(() => {
        GameState.initNew();
        GameState.state.board = createEmptyBoard();
    });

    it('the engine and the mat measure a job with the same maths', () => {
        expect(uiTaskRingOf).toBe(taskRingOf);
    });

    it('⭐ a worked Token: every drop lands exactly on its job area’s edge, round the area’s centre', () => {
        const token = place(800, 500);
        const hero = { x: 800 + artRadiusOf(TYPE) + STAND_GAP, y: 500 };
        work('hero_a', token, hero);
        const area = taskRingOf(token, [hero], ART);
        expect(area.x).toBeCloseTo((800 + hero.x) / 2, 6);

        for (let i = 0; i < ITEMS.length; i++) {
            const sprite = SpriteLayer.addSprite('item', ITEMS[i], 1, token.id);
            expect(off(sprite, area)).toBeCloseTo(area.r, 6);
            expect(sprite.fromX).toBe(800);
            expect(sprite.fromY).toBe(500);
        }
    });

    it('a job with two heroes: the wider area’s edge', () => {
        const token = place(800, 500);
        const a = { x: 900, y: 500 };
        const b = { x: 700, y: 560 };
        work('hero_a', token, a);
        work('hero_b', token, b);
        const area = taskRingOf(token, [a, b], ART);
        const sprite = SpriteLayer.addSprite('item', ITEM, 1, token.id);
        expect(off(sprite, area)).toBeCloseTo(area.r, 6);
    });

    it('a hero still walking up does not count yet: the no-job distance round the Token', () => {
        const token = place(800, 500);
        work('hero_a', token, { x: 900, y: 500 });
        BoardState.setHeroBody('hero_a', { x: 1200, y: 300, moving: true, atWork: token.id });
        const sprite = SpriteLayer.addSprite('item', ITEM, 1, token.id);
        expect(off(sprite, token)).toBeCloseTo(oneHeroReachOf(TYPE, ART), 6);
    });

    it('⭐ a Token nobody works: a one-hero job’s edge, round the Token', () => {
        const token = place(800, 500);
        const r = oneHeroReachOf(TYPE, ART);
        const oneHero = taskRingOf(token, [{ x: 800 + artRadiusOf(TYPE) + STAND_GAP, y: 500 }], ART);
        expect(r).toBeCloseTo(oneHero.r, 6);
        for (let i = 0; i < 4; i++) {
            const sprite = SpriteLayer.addSprite('item', ITEMS[i], 1, token.id);
            expect(off(sprite, token)).toBeCloseTo(r, 6);
        }
    });

    it('a point with no Token (where a Token stood): a one-hero job’s edge round it', () => {
        const centre = { x: 900, y: 600 };
        const sprite = SpriteLayer.addSprite('item', ITEM, 1, { centre });
        expect(off(sprite, centre)).toBeCloseTo(oneHeroReachOf(undefined, ART), 6);
    });

    it('the direction is the seeded random’s first draw, and every landing draws two numbers', () => {
        const token = place(800, 500);
        const r = oneHeroReachOf(TYPE, ART);
        const real = Math.random;
        const draws = [0.25, 0.9, 0.5, 0.1];
        let n = 0;
        Math.random = () => draws[n++];
        try {
            const first = SpriteLayer.addSprite('item', ITEMS[0], 1, token.id);
            expect(first.x).toBeCloseTo(800 + Math.cos(0.25 * 2 * Math.PI) * r, 6);
            expect(first.y).toBeCloseTo(500 + Math.sin(0.25 * 2 * Math.PI) * r, 6);
            expect(n).toBe(2);
            const second = SpriteLayer.addSprite('item', ITEMS[1], 1, token.id);
            expect(second.x).toBeCloseTo(800 + Math.cos(0.5 * 2 * Math.PI) * r, 6);
            expect(n).toBe(4);
        } finally {
            Math.random = real;
        }
    });

    it('directions differ from drop to drop', () => {
        const token = place(800, 500);
        const points = new Set();
        for (let i = 0; i < ITEMS.length; i++) {
            const s = SpriteLayer.addSprite('item', ITEMS[i], 1, token.id);
            points.add(`${Math.round(s.x)},${Math.round(s.y)}`);
        }
        expect(points.size).toBe(ITEMS.length);
    });

    it('⭐ piles still merge: a second drop of the item joins the first pile', () => {
        const token = place(800, 500);
        work('hero_a', token, { x: 800 + artRadiusOf(TYPE) + STAND_GAP, y: 500 });
        const first = SpriteLayer.addSprite('item', ITEM, 1, token.id);
        for (let i = 0; i < 5; i++) {
            const next = SpriteLayer.addSprite('item', ITEM, 1, token.id);
            expect(next.targetStackId).toBe(first.id);
            expect(Math.hypot(next.x - first.x, next.y - first.y)).toBeLessThanOrEqual(48 + 1e-9);
        }
    });

    it('piles merge across Tokens: a neighbour’s drop joins a pile on the first Token’s edge', () => {
        const a = place(800, 500);
        const b = place(1000, 500);
        const first = SpriteLayer.addSprite('item', ITEM, 1, a.id);
        const next = SpriteLayer.addSprite('item', ITEM, 1, b.id);
        expect(next.targetStackId).toBe(first.id);
    });

    it('a wide job reaches its own edge piles beyond the old two-tile merge distance', () => {
        const token = place(800, 500);
        const heroes = [{ x: 1080, y: 500 }, { x: 800, y: 760 }];
        heroes.forEach((h, i) => work(`hero_${i}`, token, h));
        const area = taskRingOf(token, heroes, ART);
        // The far side of the area from the Token lies past 360 u.
        expect(Math.hypot(area.x - 800, area.y - 500) + area.r).toBeGreaterThan(360);
        const real = Math.random;
        // Aim the first drop at the far side: the direction from the Token to the area's centre.
        const away = Math.atan2(area.y - 500, area.x - 800);
        let n = 0;
        Math.random = () => (n++ === 0 ? (away + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI) : 0.5);
        try {
            const first = SpriteLayer.addSprite('item', ITEM, 1, token.id);
            expect(Math.hypot(first.x - 800, first.y - 500)).toBeGreaterThan(360);
            const next = SpriteLayer.addSprite('item', ITEM, 1, token.id);
            expect(next.targetStackId).toBe(first.id);
        } finally {
            Math.random = real;
        }
    });

    it('piles far apart stay apart', () => {
        const a = place(300, 300);
        const b = place(1600, 800);
        SpriteLayer.addSprite('item', ITEM, 1, a.id);
        const next = SpriteLayer.addSprite('item', ITEM, 1, b.id);
        expect(next.targetStackId).toBeNull();
    });

    it('overflow (no source) still lands anywhere on the mat, in place', () => {
        const sprite = SpriteLayer.addSprite('item', ITEM, 1, null);
        expect(sprite.fromX).toBe(sprite.x);
        expect(sprite.fromY).toBe(sprite.y);
    });
});
