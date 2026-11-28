import { describe, it, expect } from 'vitest';

import { buildLedger, wedgeKey } from '../systems/progression/ledger/engine.js';
import { buildPace, PROFILE } from '../../cms/src/engine/ledger/pace.js';
import { wayOutSuggestion } from '../../cms/src/engine/ledger/balance.js';
import { ledgerReadout, readoutText } from '../../cms/src/engine/ledgerReadout.js';
import { workspaceCoins, coinsText } from '../../cms/src/engine/ledgerCoins.js';
import { normaliseWorldTables, grownPrice } from '../config/worldTablesShape.js';
import { WORLD_FIXTURE_RAW, worldWorkspace, contentOf } from './fixtures/ledgerWorldMap.js';

/**
 * ⭐ The ledger prices each place by its order in its ring (owner, 2026-11-27, BALANCE_RULES section
 * 8; the balancer's method): the reference guild settles each place as soon as it can, so a ring's
 * places are ordered by when the ledger first has them at the ring's price, the nth then asks the
 * ring's coins x the growth^(n - 1), and every time is worked out at those prices. The count starts
 * again in each ring, a ring's coin proposal is its first place's, and a growth of 1 is the ledger
 * as it was, every place at its ring's price.
 *
 * The fixture world: six lines, each with a place in every ring; ring 1 asks level 3 in the line's
 * skill and `RING1` coins, ring 2 `RING2`; Copper Ore sells for a coin. The Arcane line's skill is a
 * fighting style, so its places' times are floors.
 */

const RING1 = 30;
const RING2 = 60;

/** The fixture's tables with ring 1 and 2 asking coins, `growth` its place price growth (the default when left out), `mod` any other change. */
function tablesOf({ growth, ring1 = RING1, ring2 = RING2, mod = (raw) => raw } = {}) {
    const raw = structuredClone(WORLD_FIXTURE_RAW);
    raw.prices[1] = { ...raw.prices[1], skills: [{ skill: 'line', level: 3 }], coins: ring1 };
    raw.prices[2] = { ...raw.prices[2], coins: ring2 };
    if (growth !== undefined) raw.placePriceGrowth = growth;
    return mod(raw);
}

function placeWorld(options = {}) {
    const ws = worldWorkspace();
    ws.items.item_copper_ore.value = 1;
    return { ...contentOf(ws), worldTables: normaliseWorldTables(tablesOf(options)) };
}

/** As {@link placeWorld}, as the CMS workspace holds it (the read-outs take a workspace). */
function placeWorkspace(options = {}) {
    const ws = worldWorkspace();
    ws.items.item_copper_ore.value = 1;
    return { ...ws, world: tablesOf(options) };
}

/** The trees line's ring 1 also lists a Plane 2 origin, a place of its own; ring 2 asks level 40, so Plane 1's way out is that place. */
const laterRung = (raw) => {
    raw.prices[2].skills = [{ skill: 'line', level: 40 }];
    const trees = raw.lines.find(l => l.id === 'trees');
    trees.origins[1] = [...trees.origins[1], { id: 'token_trees_2', weight: 1 }];
    return raw;
};

const paceOf = (content) => buildPace(content, buildLedger(content));

describe('the order a ring\'s places are settled in', () => {
    it('⭐ is when each is first had at the ring\'s price, timed places first, and the 2nd and 3rd ask the growth once and twice', () => {
        const pace = paceOf(placeWorld());
        // Every place at the ring's price: what the first pass times.
        const flat = paceOf(placeWorld({ growth: 1 }));
        const rows = pace.placeOrder(1, PROFILE.MAXED);
        expect(rows.length).toBe(6);
        for (const r of rows) expect(r.firstHours, r.key).toBeCloseTo(flat.arrivalOf(r.key, PROFILE.MAXED).hours, 9);

        const timed = rows.filter(r => r.complete);
        const byFirst = [...timed].sort((a, b) => a.firstHours - b.firstHours).map(r => r.key);
        expect(timed.map(r => r.key)).toEqual(byFirst);
        expect(timed.length).toBeGreaterThanOrEqual(3);
        // A place whose time is a floor (a fighting style's level) comes after every timed one, however soon its floor.
        expect(rows.slice(timed.length).map(r => r.key)).toEqual([wedgeKey('arcane', 1)]);
        expect(rows[rows.length - 1].firstHours).toBeLessThan(rows[0].firstHours);
        expect(rows.map(r => r.order)).toEqual([1, 2, 3, 4, 5, 6]);

        // The 1st asks the ring's price, the 2nd x 1.25, the 3rd x 1.5625, rounded.
        expect(rows.slice(0, 3).map(r => r.coins)).toEqual([30, 38, 47]);
        expect(rows.map(r => r.coins)).toEqual(rows.map((r, i) => Math.round(RING1 * 1.25 ** i)));
        expect(rows.every(r => r.ringCoins === RING1)).toBe(true);

        // Re-timed at those prices: the 1st as before, each further one later than at the ring's price.
        expect(rows[0].hours).toBeCloseTo(rows[0].firstHours, 9);
        for (const r of rows.slice(1)) {
            expect(r.hours, r.key).toBeGreaterThan(r.firstHours);
            expect(r.hours, r.key).toBe(pace.arrivalOf(r.key, PROFILE.MAXED).hours);
        }
    });

    it('⭐ is the same however often it is worked out, and each profile keeps its own', () => {
        const once = paceOf(placeWorld());
        const again = paceOf(placeWorld());
        for (const profile of [PROFILE.MAXED, PROFILE.TYPICAL, PROFILE.BARE]) {
            expect(again.placeOrder(1, profile)).toEqual(once.placeOrder(1, profile));
            const flat = paceOf(placeWorld({ growth: 1 }));
            for (const r of once.placeOrder(1, profile)) expect(r.firstHours).toBeCloseTo(flat.arrivalOf(r.key, profile).hours, 9);
        }
    });

    it('⭐ starts again in the next ring', () => {
        const pace = paceOf(placeWorld());
        const ring2 = pace.placeOrder(2, PROFILE.MAXED);
        expect(ring2.length).toBe(6);
        expect(ring2.slice(0, 3).map(r => r.coins)).toEqual([60, 75, 94]);
        expect(ring2.every(r => r.ringCoins === RING2)).toBe(true);
        // A ring-2 place waits for its wedge's ring-1 place, at that place's own order's price.
        for (const r of ring2.filter(x => x.complete)) expect(r.hours, r.key).toBeGreaterThanOrEqual(r.firstHours - 1e-9);
        const trees = ring2.find(r => r.key === wedgeKey('trees', 2));
        expect(trees.order).toBeGreaterThan(1);
        expect(trees.hours).toBeGreaterThan(trees.firstHours);
    });

    it('⭐ at a growth of 1, every place asks its ring\'s price and is had when it was', () => {
        const pace = paceOf(placeWorld({ growth: 1 }));
        expect(pace.placePriceGrowth).toBe(1);
        for (const ring of [1, 2, 3]) {
            for (const r of pace.placeOrder(ring, PROFILE.MAXED)) {
                expect(r.coins, r.key).toBe(r.ringCoins);
                expect(r.hours, r.key).toBe(r.firstHours);
            }
        }
        for (const tier of [0, 1, 2]) {
            const g = pace.gateOf(tier);
            expect(g.order, `stage ${tier}`).toBeNull();
            expect(g.coins).toBe(g.ringCoins);
        }
        // The first pass of any growth is the same timing.
        const steep = paceOf(placeWorld({ growth: 2 }));
        for (const r of steep.placeOrder(1, PROFILE.TYPICAL)) expect(r.firstHours).toBeCloseTo(pace.arrivalOf(r.key, PROFILE.TYPICAL).hours, 9);
        expect(steep.placeOrder(1, PROFILE.TYPICAL)[1].coins).toBe(RING1 * 2);
    });
});

describe('what else reads a place\'s price', () => {
    it('⭐ a ring\'s coin proposal still reads its first place: the ring\'s price, paid when its first place can start', () => {
        const pace = paceOf(placeWorld());
        const flat = paceOf(placeWorld({ growth: 1 }));
        const ring = (p, n) => p.coinPrices().find(x => x.kind === 'ring' && x.ring === n);
        expect(ring(pace, 1)).toMatchObject({ coins: RING1 });
        expect(ring(pace, 2)).toMatchObject({ coins: RING2 });
        // Ring 1's first place waits on nothing grown, so its proposal is as at a growth of 1.
        expect(ring(pace, 1)).toEqual(ring(flat, 1));
        expect(ring(pace, 1).proposed).toBeGreaterThan(0);
        // A ring arrives with its first place, the first of the order.
        expect(pace.ringOpensAt(1, PROFILE.TYPICAL).key).toBe(pace.placeOrder(1, PROFILE.TYPICAL)[0].key);
        expect(pace.ringOpensAt(2, PROFILE.TYPICAL).key).toBe(pace.placeOrder(2, PROFILE.TYPICAL)[0].key);
    });

    it('⭐ a stage\'s way out asks its place\'s price by its order, and a coin suggestion moves the ring\'s price', () => {
        const options = { ring1: 400, mod: laterRung };
        const pace = paceOf(placeWorld(options));
        const tables = normaliseWorldTables(tablesOf(options));
        const g = pace.gateOf(1);
        expect(g.place).toBe('wedge:trees:1:2');
        const own = pace.placeOrder(1, PROFILE.MAXED).find(r => r.key === g.place);
        expect(g.order).toBe(own.order);
        expect(g.order).toBeGreaterThan(1);
        expect(g.ringCoins).toBe(400);
        expect(g.coins).toBe(grownPrice(400, tables, g.order - 1));
        expect(g.coins).toBe(own.coins);
        // Re-timed at other ring coins, it asks them grown by the same order.
        expect(pace.wayOutWith(1, { coins: 1000 }).coins).toBe(grownPrice(1000, tables, g.order - 1));
        expect(pace.wayOutWith(1, { coins: 1000 }).hours).toBeGreaterThan(g.hours);

        // A budget the way out is well under: the suggestion raises the ring's price, from the ring's own.
        const s = wayOutSuggestion(pace, 1, g.hours * 60 * 1.5);
        expect(s.coins).toMatchObject({ ring: 1, from: 400 });
        expect(s.coins.to).toBeGreaterThan(400);
        expect(pace.wayOutWith(1, { coins: s.coins.to }).hours).toBeCloseTo(s.coins.hours, 9);
    });

    it('⭐ the ledger read-out lists each ring\'s places in order, with what each asks and when it is had, and a way out names its order', () => {
        const out = ledgerReadout(placeWorkspace({ mod: laterRung }), { layouts: false });
        expect(out.places.growth).toBe(1.25);
        const ring1 = out.places.places.filter(p => p.ring === 1);
        expect(ring1.map(p => p.opt.order)).toEqual(ring1.map((p, i) => i + 1));
        expect(ring1.map(p => p.opt.coins)).toEqual(ring1.map((p, i) => Math.round(RING1 * 1.25 ** i)));
        const rung = ring1.find(p => p.key === 'wedge:trees:1:2');
        expect(rung).toMatchObject({ name: expect.stringMatching(/^Trees ring 1, /), ring: 1, rung: 2, ringCoins: RING1 });
        expect(rung.typ).toMatchObject({ order: expect.any(Number), coins: expect.any(Number) });
        expect(rung.opt.minutes).toBeGreaterThan(rung.opt.firstMinutes);
        expect(out.places.places.filter(p => p.ring === 2).map(p => p.opt.coins).slice(0, 2)).toEqual([60, 75]);

        const plane1 = out.stages[1].gate;
        expect(plane1).toMatchObject({ place: 'wedge:trees:1:2', order: rung.opt.order, coins: rung.opt.coins, ringCoins: RING1 });
        expect(out.stages[0].gate).toMatchObject({ order: 1, coins: RING1, ringCoins: RING1 });

        const text = readoutText(out).join('\n');
        expect(text).toMatch(new RegExp(`^Plane 1 \\| .+: Trees ring 1, .+, forestry \\d+ \\+ ${rung.opt.coins} coins \\(ring 1's ${rung.opt.order}th place, the ring's ${RING1}\\)`, 'm'));
        expect(text).toMatch(/^Places, ring by ring in the order Maxed settles them, each asking the ring's coins x 1\.25 for each place before it/m);
        expect(text).toMatch(/^Ring 1: 1 Ores ring 1 30 [\d.]+ min \[1, 30, [\d.]+ min\]; 2 Trees ring 1 38 /m);
    });

    it('⭐ the coin read-out lists each ring\'s places in the order Typical settles them, each at its price', () => {
        const result = workspaceCoins(placeWorkspace());
        expect(result.places[1].map(p => p.coins)).toEqual(result.places[1].map((p, i) => Math.round(RING1 * 1.25 ** i)));
        const text = coinsText(result);
        expect(text).toMatch(/^- Ring 1 \(ring at .+\): asks 30 for its first place, each further place 1\.25 times the one before; Typical settles its 6 places in this order \(coins asked, had at\): 1st Ores ring 1 30 at .+, 2nd Trees ring 1 38 at .+, 3rd .+ 47 at .+; proposed \d+/m);
        expect(text).toMatch(/^- Ring 2 \(ring at .+\): asks 60 for its first place, .*1st Ores ring 2 60 at .+, 2nd .+ 75 at /m);
    });
});
