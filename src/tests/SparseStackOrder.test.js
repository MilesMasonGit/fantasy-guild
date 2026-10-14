import { describe, it, expect } from 'vitest';
import { MAT_Z, STACK_PLACES, createMatStack } from '../ui/components/board/matLayers.js';
import { createStackPlaces } from '../ui/components/board/stackPlaces.js';
import { createStackWriter } from '../ui/components/board/stackWriter.js';

/**
 * ⭐ The mat's stack keeps each Token's and flag's place: the order is the same rule as always,
 * nothing is clamped however full the mat, and a Token that moves changes its own z only.
 */

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * The rule, written out on its own: everything at rest (lower on the mat in front; on one line a
 * Token behind a flag; then placing or planting order; then input order), then the worked Tokens
 * by the same rule, then the hovered one. Keys back to front.
 */
function ruleOrder({ tokens, flags, workedIds, hoveredId }) {
    const worked = new Set(workedIds);
    const cmp = (a, b) => (a.y - b.y) || (a.kind - b.kind) || (a.tie - b.tie) || (a.at - b.at);
    const rest = [];
    const busy = [];
    let hovered = null;
    tokens.forEach((t, at) => {
        const e = { key: `t:${t.id}`, y: t.y, kind: 0, tie: t.placedAt ?? 0, at };
        if (t.id === hoveredId) hovered = e;
        else if (worked.has(t.id)) busy.push(e);
        else rest.push(e);
    });
    flags.forEach((f, i) => rest.push({ key: `f:${f.heroId}`, y: f.y, kind: 1, tie: i, at: tokens.length + i }));
    return [...rest.sort(cmp), ...busy.sort(cmp), ...(hovered ? [hovered] : [])].map(e => e.key);
}

/** Every Token's and flag's z, by key. */
function zByKey(order) {
    const out = new Map();
    for (const [id, z] of order.tokenZ) out.set(`t:${id}`, z);
    for (const [id, z] of order.flagZ) out.set(`f:${id}`, z);
    return out;
}

/** Pairwise: the stack puts every pair the way the rule does, three z values apart or more. */
function expectRuleOrder(order, input) {
    const z = zByKey(order);
    const want = ruleOrder(input);
    expect(z.size).toBe(want.length);
    for (let i = 1; i < want.length; i++) {
        const gap = z.get(want[i]) - z.get(want[i - 1]);
        if (!(gap >= 3)) throw new Error(`${want[i - 1]} (${z.get(want[i - 1])}) should be behind ${want[i]} (${z.get(want[i])}) with room for its hero and badges`);
    }
}

/** Keys whose z changed between two answers (keys in both). */
function changedKeys(a, b) {
    const za = zByKey(a);
    const out = [];
    for (const [k, z] of zByKey(b)) if (za.has(k) && za.get(k) !== z) out.push(k);
    return out.sort();
}

/** A random board of `n` Tokens and up to 8 flags; ties on purpose (whole y values, shared placing times). */
function randomBoard(rnd, n) {
    const ys = 6 + Math.floor(rnd() * 600);
    const tokens = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, y: Math.floor(rnd() * ys) * 2, placedAt: Math.floor(rnd() * n / 2) }));
    const flags = Array.from({ length: Math.floor(rnd() * 9) }, (_, i) => ({ heroId: `h${i}`, y: Math.floor(rnd() * ys) * 2 }));
    const workedIds = tokens.filter(() => rnd() < 0.05).slice(0, 8).map(t => t.id);
    return { tokens, flags, workedIds, hoveredId: rnd() < 0.5 ? tokens[Math.floor(rnd() * n)].id : null, clock: n };
}

/** One random change, as the mat sees them; returns the keys allowed to change z. */
function randomChange(rnd, board) {
    const { tokens } = board;
    const pick = () => tokens[Math.floor(rnd() * tokens.length)];
    const r = rnd();
    if (r < 0.3) {
        const t = pick();
        board.tokens = tokens.map(x => (x === t ? { ...x, y: Math.floor(rnd() * 1200) } : x));
        return [`t:${t.id}`];
    }
    if (r < 0.5) {
        const was = board.hoveredId;
        board.hoveredId = rnd() < 0.2 ? null : pick().id;
        return [was, board.hoveredId].filter(Boolean).map(id => `t:${id}`);
    }
    if (r < 0.65) {
        const t = pick();
        const worked = new Set(board.workedIds);
        if (worked.has(t.id)) worked.delete(t.id);
        else if (worked.size < 8) worked.add(t.id);
        board.workedIds = [...worked];
        return [`t:${t.id}`];
    }
    if (r < 0.8 && tokens.length > 10) {
        // A Token used up, another spawned elsewhere.
        const t = pick();
        board.tokens = tokens.filter(x => x !== t);
        board.workedIds = board.workedIds.filter(id => id !== t.id);
        if (board.hoveredId === t.id) board.hoveredId = null;
        board.tokens.push({ id: `s${board.clock}`, y: Math.floor(rnd() * 1200), placedAt: board.clock++ });
        return [];
    }
    if (board.flags.length) {
        const i = Math.floor(rnd() * board.flags.length);
        board.flags = board.flags.map((f, j) => (j === i ? { ...f, y: Math.floor(rnd() * 1200) } : f));
        return [`f:${board.flags[i].heroId}`];
    }
    return [];
}

describe('⭐ the order is the rule, on random boards of 10 to 300 Tokens and flags', () => {
    it('every pair, on 60 boards, through 40 changes each', () => {
        const rnd = mulberry32(7);
        for (let k = 0; k < 60; k++) {
            const board = randomBoard(rnd, 10 + Math.floor(rnd() * 291));
            const stack = createMatStack();
            expectRuleOrder(stack.order(board), board);
            for (let c = 0; c < 40; c++) {
                randomChange(rnd, board);
                expectRuleOrder(stack.order(board), board);
            }
        }
    });
});

describe('⭐ a Token that moves changes its own z only', () => {
    it('a move, a hover, a hero starting or stopping, a spawn, a flag moved: only that one', () => {
        const rnd = mulberry32(11);
        let changes = 0;
        for (let k = 0; k < 30; k++) {
            const board = randomBoard(rnd, 10 + Math.floor(rnd() * 291));
            const stack = createMatStack();
            let last = stack.order(board);
            for (let c = 0; c < 60; c++) {
                const allowed = randomChange(rnd, board);
                const next = stack.order(board);
                const moved = changedKeys(last, next);
                for (const key of moved) if (!allowed.includes(key)) throw new Error(`${key} changed z though only ${allowed.join(', ') || 'nothing'} moved`);
                changes += moved.length;
                last = next;
            }
            expect(stack.spreads).toBe(0);
        }
        expect(changes).toBeGreaterThan(500);
    });

    it('passing one neighbour: the Token that moved takes the new place, not the neighbour', () => {
        const stack = createMatStack();
        const tokens = [{ id: 'a', y: 100 }, { id: 'b', y: 200 }, { id: 'c', y: 300 }];
        const before = stack.order({ tokens });
        const after = stack.order({ tokens: [{ id: 'a', y: 250 }, tokens[1], tokens[2]] });
        expect(changedKeys(before, after)).toEqual(['t:a']);
        // And when b moves past a again, b moves.
        const back = stack.order({ tokens: [{ id: 'a', y: 250 }, { id: 'b', y: 260 }, tokens[2]] });
        expect(changedKeys(after, back)).toEqual(['t:b']);
        // Moving up the mat past one neighbour, too: c goes behind b.
        const up = stack.order({ tokens: [{ id: 'a', y: 250 }, { id: 'b', y: 260 }, { id: 'c', y: 255 }] });
        expect(changedKeys(back, up)).toEqual(['t:c']);
    });

    it('a long session on the cap-256 board: a z change or less per change, no spreading', () => {
        const rnd = mulberry32(3);
        const board = randomBoard(rnd, 290);
        const stack = createMatStack();
        let last = stack.order(board);
        let moved = 0;
        const n = 5000;
        for (let c = 0; c < n; c++) {
            randomChange(rnd, board);
            const next = stack.order(board);
            moved += changedKeys(last, next).length;
            last = next;
        }
        expect(stack.spreads).toBe(0);
        expect(moved / n).toBeLessThan(1);
    });
});

describe('⭐ no clamp: 256 Tokens, 25 Starter Camp sites, the Hall, quests and 8 flags', () => {
    const rnd = mulberry32(5);
    const tokens = Array.from({ length: 256 + 25 + 1 + 3 }, (_, i) => ({ id: `t${i}`, y: Math.floor(rnd() * 1400), placedAt: i }));
    // Flags spread down the mat, the last near the bottom, among the Tokens a clamp would tie.
    const flags = Array.from({ length: 8 }, (_, i) => ({ heroId: `h${i}`, y: 100 + i * 185 }));
    const workedIds = ['t3', 't40', 't77', 't120', 't199', 't250', 't270', 't283'];
    const input = { tokens, flags, workedIds, hoveredId: 't100' };
    const order = createMatStack().order(input);

    it('every Token and flag keeps its own place, in the rule\'s order', () => {
        const all = [...order.tokenZ.values(), ...order.flagZ.values()];
        expect(new Set(all).size).toBe(tokens.length + flags.length);
        expectRuleOrder(order, input);
    });

    it('so a flag never covers a Token standing lower on the mat', () => {
        // A clamp made the resting Tokens past its last rank share one z, and every flag (drawn
        // after them in the page) covered all of them.
        let pairs = 0;
        for (const f of flags) {
            for (const t of tokens) {
                if (t.y <= f.y) continue;
                pairs++;
                expect(order.tokenZ.get(t.id)).toBeGreaterThan(order.flagZ.get(f.heroId) + 2);
            }
        }
        expect(pairs).toBeGreaterThan(500);
    });

    it('the worked Tokens above everything at rest, the hovered one above them, all below the walking heroes', () => {
        const restMax = Math.max(...tokens.filter(t => !workedIds.includes(t.id) && t.id !== 't100').map(t => order.tokenZ.get(t.id)), ...order.flagZ.values());
        const worked = workedIds.map(id => order.tokenZ.get(id));
        expect(Math.min(...worked)).toBeGreaterThan(restMax + 2);
        expect(order.tokenZ.get('t100')).toBeGreaterThan(Math.max(...worked) + 2);
        expect(order.tokenZ.get('t100') + 2).toBeLessThan(MAT_Z.WAITING_HERO);
    });
});

describe('when there is no free place left', () => {
    it('a small range still keeps the order, and spreads only a window around the spot', () => {
        // 64 places for 20 entries: the same spot runs out of room within a few arrivals.
        const places = createStackPlaces(64);
        const keys = Array.from({ length: 20 }, (_, i) => ({ key: `k${i}`, sign: '' }));
        let last = places.place(keys);
        let list = keys;
        let mostMoved = 0;
        for (let i = 0; i < 40; i++) {
            // A new entry right after the fifth, every time.
            list = [...list.slice(0, 5), { key: `n${i}`, sign: '' }, ...list.slice(5)];
            if (list.length > 30) list = list.filter((e, j) => j !== list.length - 1);
            const next = places.place(list);
            const seq = list.map(e => next.get(e.key));
            for (let j = 1; j < seq.length; j++) expect(seq[j]).toBeGreaterThan(seq[j - 1]);
            expect(Math.min(...seq)).toBeGreaterThanOrEqual(0);
            expect(Math.max(...seq)).toBeLessThan(64);
            let moved = 0;
            for (const e of list) if (last.has(e.key) && last.get(e.key) !== next.get(e.key)) moved++;
            mostMoved = Math.max(mostMoved, moved);
            last = next;
        }
        expect(places.spreads).toBeGreaterThan(0);
        expect(mostMoved).toBeLessThan(30);
    });

    it('the mat has room for every Token it could ever hold', () => {
        expect(STACK_PLACES).toBeGreaterThan(1000 * 1000);
    });
});

describe('⭐ the stack writer writes only the boxes whose z changed', () => {
    function box() {
        const el = { writes: 0, z: '' };
        el.style = {};
        Object.defineProperty(el.style, 'zIndex', { get: () => el.z, set: (v) => { el.writes++; el.z = String(v); } });
        return el;
    }

    it('one Token moved: its two boxes, nothing else', () => {
        const writer = createStackWriter();
        const els = {};
        for (const id of ['a', 'b', 'c']) {
            els[id] = { art: box(), badges: box() };
            writer.attach(id, 'art', els[id].art);
            writer.attach(id, 'badges', els[id].badges);
        }
        const stack = createMatStack();
        const tokens = [{ id: 'a', y: 1 }, { id: 'b', y: 2 }, { id: 'c', y: 3 }];
        writer.apply(stack.order({ tokens }).tokenZ);
        const writes = () => Object.fromEntries(Object.entries(els).map(([id, b]) => [id, b.art.writes + b.badges.writes]));
        expect(writes()).toEqual({ a: 2, b: 2, c: 2 });
        expect(Number(els.a.badges.z)).toBe(Number(els.a.art.z) + 2);

        // The same order again: nothing written.
        writer.apply(stack.order({ tokens: tokens.map(t => ({ ...t })) }).tokenZ);
        expect(writes()).toEqual({ a: 2, b: 2, c: 2 });

        // a moves to the front: only a's boxes.
        writer.apply(stack.order({ tokens: [{ id: 'a', y: 9 }, tokens[1], tokens[2]] }).tokenZ);
        expect(writes()).toEqual({ a: 4, b: 2, c: 2 });
        expect(Number(els.a.art.z)).toBeGreaterThan(Number(els.c.art.z));
    });

    it('a box that arrives takes the current z at once', () => {
        const writer = createStackWriter();
        writer.apply(new Map([['a', 40]]));
        const art = box();
        writer.attach('a', 'art', art);
        expect(art.z).toBe('40');
    });
});
