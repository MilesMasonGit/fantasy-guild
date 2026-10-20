// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import * as ItemStubs from '../systems/notifications/itemStubs.js';
import {
    fliesToStub, bookFlight, placeFlights, landFlight, getCopies, resetCopies, COPY_LINGER_MS
} from '../ui/components/notifications/stubLanding.js';
import { STUB_PX, PITCH_PX, SPRITE_INSET_PX } from '../ui/components/notifications/stubGeometry.js';
import { LEAVE_MS } from '../systems/notifications/itemStubs.js';

/**
 * Where collected loot lands (owner, third look): on its own stub's sprite, where the stub rests
 * (not where a slide or glide has it this frame); a stub scrolled out of view, or a new one below a
 * full column, gets a copy popped out over the bottom stubs, which takes the landings and slides
 * back. Read in one batch per burst. jsdom lays nothing out, so every box comes from `data-rect`.
 */

const realRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function () {
    const [left, top, width, height] = (this.dataset?.rect || '0,0,0,0').split(',').map(Number);
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
};
afterAll(() => { Element.prototype.getBoundingClientRect = realRect; });

/** A stub at `top`, `width` wide, flush right at 1600 unless `slide` pushes it out of the edge. */
function stubHtml(itemId, top, { width = 80, slide = 0, leaving = false } = {}) {
    const left = 1600 - width + slide;
    return `<div data-item-stub="${itemId}" data-rect="${left},${top},${width},${STUB_PX}"${leaving ? ' data-stub-leaving="true"' : ''}>`
        + `<span data-stub-sprite data-rect="${left + width - SPRITE_INSET_PX - 16},${top + 6},32,32"></span></div>`;
}

const COLUMN = 'data-item-stubs data-rect="1400,40,200,900"';

beforeEach(() => {
    ItemStubs.reset();
    resetCopies();
    document.body.innerHTML = '';
});
afterEach(() => {
    vi.useRealTimers();
    resetCopies();
    ItemStubs.reset();
    document.body.innerHTML = '';
});

function booked(itemId, qty = 1) {
    ItemStubs.recordFlow(itemId, { added: qty });
    return bookFlight(itemId, qty);
}

describe('which loot flies to a stub', () => {
    it('loot whose item has a stub, while the column is drawn', () => {
        document.body.innerHTML = `<div ${COLUMN}></div>`;
        ItemStubs.recordFlow('oak', { added: 1 });
        expect(fliesToStub('oak')).toBe(true);
        expect(fliesToStub('copper')).toBe(false);
    });

    it('nothing while the column is not drawn (item stubs switched off)', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        expect(fliesToStub('oak')).toBe(false);
    });
});

describe('landing on a stub in view', () => {
    it('lands on the stub\'s sprite', () => {
        document.body.innerHTML = `<div ${COLUMN}>${stubHtml('stone', 64)}${stubHtml('oak', 112)}</div>`;
        const b = booked('oak');
        placeFlights([b]);
        expect(b.spot).toEqual({ x: 1600 - SPRITE_INSET_PX, y: 112 + STUB_PX / 2 });
        expect(b.copy).toBe(false);
        expect(getCopies()).toEqual([]);
    });

    it('a stub still sliding out of the edge is landed on where it will rest', () => {
        document.body.innerHTML = `<div ${COLUMN}>${stubHtml('oak', 64, { slide: 88 })}</div>`;
        const b = booked('oak');
        placeFlights([b]);
        expect(b.spot.x).toBe(1600 - SPRITE_INSET_PX);
    });

    it('a wide (pinned, open) stub is landed on at its sprite, not at its edge', () => {
        document.body.innerHTML = `<div ${COLUMN}><div data-item-stub="oak" data-rect="1300,64,300,${STUB_PX}">`
            + `<span data-stub-sprite data-rect="1350,70,32,32"></span></div></div>`;
        const b = booked('oak');
        placeFlights([b]);
        expect(b.spot).toEqual({ x: 1366, y: 86 });
    });

    it('reads each stub once per batch, however many flights go to it', () => {
        document.body.innerHTML = `<div ${COLUMN}>${stubHtml('oak', 64)}</div>`;
        const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect');
        const flights = [booked('oak'), booked('oak'), booked('oak')];
        placeFlights(flights);
        // The column, the stub and its sprite: three boxes for three flights.
        expect(spy).toHaveBeenCalledTimes(3);
        spy.mockRestore();
        expect(new Set(flights.map(f => f.spot.y)).size).toBe(1);
    });
});

/** A scrolling column: the list shows 84..484; `iron` is scrolled below it. */
function scrolledColumn(extra = '') {
    document.body.innerHTML = `<div ${COLUMN}><div data-stubs-scroll data-rect="1400,84,200,400">`
        + `${stubHtml('stone', 84)}${stubHtml('oak', 132)}${stubHtml('iron', 600)}${stubHtml('tin', 648)}${extra}</div></div>`;
}

describe('a stub out of view: a copy pops out over the bottom stubs', () => {
    it('the flight lands on a copy at the bottom of the visible list', () => {
        scrolledColumn();
        const b = booked('iron');
        placeFlights([b]);
        const copyTop = 484 - STUB_PX;
        expect(b.copy).toBe(true);
        expect(b.spot).toEqual({ x: 1600 - SPRITE_INSET_PX, y: copyTop + STUB_PX / 2 });
        expect(getCopies()).toMatchObject([{ itemId: 'iron', top: copyTop - 40, leaving: false }]);
    });

    it('a second item\'s copy sits just above the first; the same item shares its copy', () => {
        scrolledColumn();
        const a = booked('iron');
        const b = booked('tin');
        const c = booked('iron');
        placeFlights([a, b, c]);
        expect(c.spot).toEqual(a.spot);
        expect(b.spot.y).toBe(a.spot.y - PITCH_PX);
        expect(getCopies().map(k => k.itemId)).toEqual(['iron', 'tin']);
    });

    it('a stub in view in the same list is landed on, no copy', () => {
        scrolledColumn();
        const b = booked('oak');
        placeFlights([b]);
        expect(b.copy).toBe(false);
        expect(b.spot.y).toBe(132 + STUB_PX / 2);
    });

    it('a stub not drawn yet in a column with room is landed on where it will appear, below the last', () => {
        document.body.innerHTML = `<div ${COLUMN}>${stubHtml('stone', 64)}${stubHtml('oak', 112)}</div>`;
        const b = booked('copper');
        placeFlights([b]);
        expect(b.copy).toBe(false);
        expect(b.spot).toEqual({ x: 1600 - SPRITE_INSET_PX, y: 112 + PITCH_PX + STUB_PX / 2 });
    });

    it('a stub not drawn yet in a full list gets a copy too', () => {
        scrolledColumn();
        const b = booked('copper');
        placeFlights([b]);
        expect(b.copy).toBe(true);
    });

    it('the copy takes its landings, lingers, then slides back and goes', () => {
        vi.useFakeTimers();
        scrolledColumn();
        const a = booked('iron');
        const b = booked('iron');
        placeFlights([a, b]);
        landFlight(a);
        vi.advanceTimersByTime(COPY_LINGER_MS * 2);
        expect(getCopies()[0].leaving).toBe(false);
        landFlight(b);
        vi.advanceTimersByTime(COPY_LINGER_MS + 1);
        expect(getCopies()[0].leaving).toBe(true);
        vi.advanceTimersByTime(LEAVE_MS + 1);
        expect(getCopies()).toEqual([]);
    });

    it('a copy sliding back is called out again by a new flight, in the same place', () => {
        vi.useFakeTimers();
        scrolledColumn();
        const a = booked('iron');
        placeFlights([a]);
        landFlight(a);
        vi.advanceTimersByTime(COPY_LINGER_MS + 1);
        expect(getCopies()[0].leaving).toBe(true);
        const b = booked('iron');
        placeFlights([b]);
        expect(b.spot).toEqual(a.spot);
        expect(getCopies()).toMatchObject([{ itemId: 'iron', leaving: false }]);
        vi.advanceTimersByTime(LEAVE_MS + 1);
        expect(getCopies()).toHaveLength(1);
    });

    it('with no room left for another copy the flight is not placed (it goes to the Guild Hall)', () => {
        document.body.innerHTML = `<div ${COLUMN}><div data-stubs-scroll data-rect="1400,84,200,${STUB_PX}">`
            + `${stubHtml('stone', 84)}${stubHtml('iron', 600)}${stubHtml('tin', 648)}</div></div>`;
        const a = booked('iron');
        const b = booked('tin');
        placeFlights([a, b]);
        expect(a.copy).toBe(true);
        expect(b.spot).toBeNull();
    });
});

describe('a flight that ends without landing', () => {
    it('still lets its count through, and a copy waits for nothing more', () => {
        vi.useFakeTimers();
        scrolledColumn();
        ItemStubs.recordFlow('iron', { added: 2 });
        ItemStubs.flush();
        const b = booked('iron', 3);
        placeFlights([b]);
        expect(ItemStubs.shownNetOf(ItemStubs.getStub('iron'))).toBe(2);
        landFlight(b);
        expect(ItemStubs.shownNetOf(ItemStubs.getStub('iron'))).toBe(5);
        vi.advanceTimersByTime(COPY_LINGER_MS + LEAVE_MS + 2);
        expect(getCopies()).toEqual([]);
    });

    it('no column at placing time: nothing placed, nothing claimed', () => {
        ItemStubs.recordFlow('oak', { added: 1 });
        const b = bookFlight('oak', 1);
        placeFlights([b]);
        expect(b.spot).toBeNull();
        expect(getCopies()).toEqual([]);
    });
});
