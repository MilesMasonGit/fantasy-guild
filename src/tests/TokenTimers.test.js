import { describe, it, expect } from 'vitest';
import {
    timerLines, passiveHoverLines, spawnLine, growthLine, respawnLine, leaveLine, demolitionLine,
    produceLine, leftByRegrow, TIMER_KIND
} from '../ui/components/board/tokenTimers.js';
import { idleTimerLines, timerCellsOf } from '../ui/components/board/idlePlate.js';
import { cardLifecycle } from '../ui/components/board/tokenCard.js';

/**
 * One writer for a Token's timer sentences: the card's Events lines and the idle hover's timer
 * cells read the same lines, so they say the same thing in the same words (Exhausted, Respawns,
 * Expires). Every engine read is a stub here.
 */

const NB = ' ';

const TYPES = {
    forest: { name: 'Oak Forest', spawner: { spawns: [{ typeId: 'sapling', weight: 1 }], allowance: 5, intervalMs: 20000 } },
    sapling: { name: 'Oak Sapling', grows: { into: 'tree', afterMs: 30000 } },
    tree: { name: 'Oak Tree', respawn: { mode: 'regrow', into: 'stump' } },
    stump: { name: 'Oak Stump', grows: { into: 'sapling', afterMs: 150000 } },
    vein: { name: 'Copper Vein', respawn: { mode: 'refill', afterMs: 60000 } },
    orchard: { name: 'Apple Orchard' },
    hall: { name: 'Guild Hall' },
    rock: { name: 'Rock' }
};
const ITEMS = { item_seedling: 'Oak Seedling', item_coal: 'Coal', item_seed: 'Oak Seed', item_water: 'Water' };

const hallPassive = (well = 0) => (i) => (i.typeId !== 'hall' ? { lines: [], nextInMs: 300000, lapMs: 300000 } : {
    lines: [
        { itemId: 'item_seed', quantity: 2, source: 'token' },
        ...(well ? [{ itemId: 'item_water', quantity: 10 * well, source: 'wishing_well' }] : [])
    ],
    nextInMs: 300000 - (i.clocks?.passiveMs || 0),
    lapMs: 300000
});

function src(overrides = {}) {
    return {
        typeOf: (id) => TYPES[id] || null,
        allTypes: () => TYPES,
        tokenName: (id) => TYPES[id]?.name || id,
        itemName: (id) => ITEMS[id] || id,
        recipeName: (id) => id,
        workerOf: () => null,
        demolishMs: 10000,
        eventLeave: () => null,
        nextTurn: () => null,
        spawnerStatus: () => null,
        nextGrowth: () => null,
        field: () => null,
        respawn: () => null,
        passive: hallPassive(),
        ...overrides
    };
}

describe('the words', () => {
    it('an exhausted Token: Exhausted, and when it respawns; waiting for a Token nearby, no time', () => {
        const at = { id: 'v', typeId: 'vein' };
        expect(respawnLine(at, { mode: 'refill', resting: true, inMs: 240000 }, src()))
            .toMatchObject({ label: 'Exhausted', text: '4m 0s', tip: `Exhausted · respawns in 4m${NB}0s` });
        expect(respawnLine(at, { mode: 'refill', resting: true, paused: true, needsNearby: ['orchard'] }, src()))
            .toMatchObject({ label: 'Exhausted', text: '–', tip: 'Exhausted · respawns only with an Apple Orchard nearby', tone: 'warning', alert: true });
    });

    it('before it runs out, how it respawns: a refill in its rest, a regrow as what it leaves', () => {
        expect(respawnLine({ id: 'v', typeId: 'vein' }, { mode: 'refill', resting: false, afterMs: 60000 }, src()))
            .toMatchObject({ label: 'Respawns', text: '1m', tip: 'Respawns 1m after it\'s used up', live: false });
        expect(respawnLine({ id: 't', typeId: 'tree' }, { mode: 'regrow', into: 'stump', resting: false }, src()))
            .toMatchObject({ label: 'Respawns', text: 'Oak Stump', tip: 'Leaves Oak Stump when it\'s used up, which respawns', live: false });
    });

    it('what a used-up Token leaves respawns as the next stage; a plain growth grows', () => {
        expect(leftByRegrow('stump', TYPES)).toBe(true);
        expect(leftByRegrow('sapling', TYPES)).toBe(false);
        const growth = { inMs: 150000, into: 'sapling', cost: [], needsNearby: [] };
        expect(growthLine({ id: 's', typeId: 'stump' }, growth, src()))
            .toMatchObject({ kind: TIMER_KIND.GROW, label: 'Respawns', text: '2m 30s', tip: `Respawns as Oak Sapling in 2m${NB}30s` });
        const plain = growthLine({ id: 'p', typeId: 'sapling' }, { inMs: 30000, into: 'tree', cost: [], needsNearby: [] }, src());
        expect(plain).toMatchObject({ text: '30s', tip: 'Grows into Oak Tree in 30s' });
        expect(plain.label).toBeUndefined();
    });

    it('a growth waiting says why, with no time, and leaves the hover to its problem mark', () => {
        const at = { id: 's', typeId: 'stump' };
        expect(growthLine(at, { inMs: 0, into: 'sapling', paused: true, needsNearby: ['forest'], cost: [] }, src()))
            .toMatchObject({ text: '–', tip: 'Respawns as Oak Sapling only with an Oak Forest nearby', alert: true });
        const cost = [{ itemId: 'item_seedling', quantity: 1 }];
        expect(growthLine(at, { inMs: 0, into: 'sapling', stopped: true, short: ['item_seedling'], cost, needsNearby: [] }, src()))
            .toMatchObject({ text: '–', tip: 'Stopped: needs 1 Oak Seedling to respawn as Oak Sapling', alert: true });
        expect(growthLine(at, { inMs: 1000, into: 'sapling', cost, needsNearby: [] }, src()).tip)
            .toBe('Respawns as Oak Sapling in 1s, for 1 Oak Seedling from the Bank');
    });

    it('an event: Expires in, worked or not for a node', () => {
        expect(leaveLine({ inMs: 297000, buff: true })).toMatchObject({ label: 'Expires in', text: '4m 57s', tip: `Expires in 4m${NB}57s` });
        expect(leaveLine({ inMs: 3600000, buff: false }).tip).toBe(`Expires in 1h${NB}0m, worked or not`);
    });

    it('a spawner, every state: the figure, and the sentence without the family count', () => {
        const def = TYPES.forest;
        const s = (state, extra = {}) => spawnLine(def, { state, count: 3, cap: 5, ...extra }, src());
        expect(s('spawning', { nextInMs: 4000 })).toMatchObject({ text: '4s', tip: `Spawns Oak Sapling. Next in 4s.` });
        expect(s('at_cap')).toMatchObject({ text: 'full', tip: 'Spawns Oak Sapling. Its family is full: it waits for room.' });
        expect(s('sleeping')).toMatchObject({ text: 'asleep', tip: 'Spawns Oak Sapling. Asleep while enemies hold this place.' });
        expect(s('needs_item', { needs: ['item_coal'] })).toMatchObject({ text: 'needs items', tip: 'Spawns Oak Sapling. Waiting for Coal.', alert: true });
        expect(s('no_room', { nextInMs: 1 })).toMatchObject({ text: 'no room', alert: true });
        expect(s('mat_full')).toMatchObject({ text: 'mat full', tip: 'Spawns Oak Sapling. The mat is full.', alert: true });
        for (const state of ['spawning', 'at_cap', 'sleeping', 'needs_item', 'no_room', 'mat_full']) {
            expect(s(state, { nextInMs: 1, needs: [] }).tip).not.toMatch(/3/);
        }
    });

    it('demolition: waiting for a hero, then its countdown', () => {
        const at = { id: 'r', typeId: 'rock', demolish: true, cycleElapsedMs: 4000 };
        expect(demolitionLine(at, src())).toMatchObject({ text: '–', tip: 'Marked for demolition: waiting for a hero with Construction' });
        expect(demolitionLine(at, src({ workerOf: () => 'h1' }))).toMatchObject({ text: '6s', tip: 'Marked for demolition: gone in 6s' });
    });

    it('Passive Production: its next payout', () => {
        expect(produceLine(hallPassive()({ typeId: 'hall', clocks: { passiveMs: 100000 } }), src()))
            .toMatchObject({ kind: TIMER_KIND.PRODUCE, text: '3m 20s', tip: `Passive Production: 2 Oak Seed, next in 3m${NB}20s` });
        expect(produceLine({ lines: [] }, src())).toBeNull();
    });
});

describe('timerLines and the idle hover', () => {
    it('a marked Token is demolition and nothing else', () => {
        const at = { id: 'v', typeId: 'vein', demolish: true };
        const lines = timerLines(at, src({ respawn: () => ({ mode: 'refill', resting: true, inMs: 1000 }) }));
        expect(lines.map(l => l.kind)).toEqual([TIMER_KIND.DEMOLITION]);
        expect(idleTimerLines(at, src()).map(l => l.kind)).toEqual([TIMER_KIND.DEMOLITION]);
    });

    it('descriptions are the card\'s alone; a running timer is both\'s', () => {
        const at = { id: 'v', typeId: 'vein' };
        expect(timerLines(at, src({ respawn: () => ({ mode: 'refill', resting: false, afterMs: 60000 }) }))).toEqual([]);
        expect(idleTimerLines(at, src({ respawn: () => ({ mode: 'refill', resting: false, afterMs: 60000 }) }))).toBeNull();
        const resting = src({ respawn: () => ({ mode: 'refill', resting: true, inMs: 5000 }) });
        const [card] = cardLifecycle(at, TYPES.vein, resting);
        const [hover] = idleTimerLines(at, resting);
        expect(hover.tip).toBe(card.tip);
        expect(hover.text).toBe(card.text);
        expect(timerCellsOf([hover])).toEqual([{ kind: 'timer', glyph: 'regrow', text: '5s', tip: 'Exhausted · respawns in 5s' }]);
    });

    it('a spawner: full and asleep on the hover; spawning, and what its problem mark says, left out', () => {
        const at = { id: 'f', typeId: 'forest' };
        const with_ = (state) => src({ spawnerStatus: () => ({ state, count: 5, cap: 5, nextInMs: 2000, needs: ['item_coal'] }) });
        expect(idleTimerLines(at, with_('at_cap'))).toEqual([expect.objectContaining({ text: 'full' })]);
        expect(idleTimerLines(at, with_('sleeping'))).toEqual([expect.objectContaining({ text: 'asleep' })]);
        for (const state of ['spawning', 'needs_item', 'no_room', 'mat_full']) expect(idleTimerLines(at, with_(state))).toBeNull();
        // The card keeps every state, its family's count in front.
        expect(cardLifecycle(at, TYPES.forest, with_('spawning'))[0]).toMatchObject({ text: '5/5 · next 2s' });
        expect(cardLifecycle(at, TYPES.forest, with_('at_cap'))[0]).toMatchObject({ text: '5/5 · full' });
    });

    it('Passive Production is on the card, and on the hover only in its own tooltip', () => {
        const at = { id: 'h', typeId: 'hall' };
        expect(timerLines(at, src()).map(l => l.kind)).toEqual([TIMER_KIND.PRODUCE]);
        expect(cardLifecycle(at, TYPES.hall, src()).map(l => l.label)).toEqual(['Produces']);
        expect(idleTimerLines(at, src())).toBeNull();
    });

    it('an event, a growth and a refill together, in the card\'s order', () => {
        const at = { id: 's', typeId: 'stump' };
        const lines = timerLines(at, src({
            eventLeave: () => ({ inMs: 60000, buff: false }),
            nextGrowth: () => ({ inMs: 3000, into: 'sapling', cost: [], needsNearby: [] }),
            respawn: () => ({ mode: 'refill', resting: true, inMs: 2000 })
        }));
        expect(lines.map(l => l.kind)).toEqual([TIMER_KIND.LEAVE, TIMER_KIND.GROW, TIMER_KIND.RESPAWN]);
    });
});

describe('passiveHoverLines', () => {
    it('says when the shared timer pays next, then what it pays', () => {
        expect(passiveHoverLines({ id: 'h', typeId: 'hall', clocks: { passiveMs: 100000 } }, src()))
            .toEqual(['Passive Production · next in 3m 20s', '2 Oak Seed']);
    });

    it('starts a fresh clock at the full lap, and names the Wishing Well', () => {
        expect(passiveHoverLines({ id: 'h', typeId: 'hall' }, src({ passive: hallPassive(2) })))
            .toEqual(['Passive Production · next in 5m 0s', '2 Oak Seed', '20 Water (Wishing Well)']);
    });

    it('is empty for a Token that pays nothing, or no Token', () => {
        expect(passiveHoverLines({ id: 't', typeId: 'tree' }, src())).toEqual([]);
        expect(passiveHoverLines(null, src())).toEqual([]);
    });
});
