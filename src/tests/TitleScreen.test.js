// @vitest-environment jsdom
// The title screen: the game's name over a picture, the three save slots beneath in the kit, the
// slot stats as Lucide marks; load, delete and its confirm and the slot messages keep working; the
// owner's logo and painting replace the stand-ins when their files exist.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { SlotSelectionModal } from '../ui/modals/SlotSelectionModal.jsx';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import {
    TITLE_LOGO_SRC, TITLE_PAINTING_SRC, TITLE_BANNER, coverScale, fitScale
} from '../ui/components/title/titleArt.js';
import { areaBannerSrc } from '../config/areaBanners.js';
import { slotAwayText } from '../ui/components/title/slotAway.js';
import { AWAY_REPLACES_LAST_SAVED } from '../ui/modals/SlotSelectionModal.jsx';
import { CATCH_UP } from '../config/loopConstants.js';

const h = React.createElement;
const HOUR = 60 * 60 * 1000;

const slotSave = (heroes, savedAt) => JSON.stringify({
    version: '0.8.1', savedAt, state: { heroes: Array.from({ length: heroes }, (_, i) => ({ id: `h${i}` })), meta: { totalPlaytime: 2 * HOUR + 5 * 60 * 1000 } }
});

const row = (n) => document.querySelector(`[data-save-slot="${n}"]`);
const EMOJI = /\p{Extended_Pictographic}/u;

function plantSlots() {
    localStorage.setItem('fantasy_guild_slot_0', slotSave(3, Date.now() - 3 * HOUR));
    localStorage.setItem('fantasy_guild_slot_2', '{"version":"0.8.1", "savedAt": 12'); // cut off mid-write
    localStorage.setItem('fantasy_guild_last_slot', '0');
}

beforeEach(() => {
    localStorage.clear();
    NotificationSystem.dismissAll();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('the slots', () => {
    it('shows a filled, an empty and a damaged slot for what each holds', () => {
        plantSlots();
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        expect(row(1).getAttribute('data-slot-state')).toBe('filled');
        expect(row(2).getAttribute('data-slot-state')).toBe('empty');
        expect(row(3).getAttribute('data-slot-state')).toBe('damaged');
        expect(row(1).textContent).toContain('Last Played');
        expect(row(2).textContent).toContain('New Game');
        expect(row(3).textContent).toContain('Damaged');
    });

    it('a filled slot\'s stats are Lucide marks with their values, and no emoji shows anywhere', () => {
        plantSlots();
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        const stat = (name) => row(1).querySelector(`[data-slot-stat="${name}"]`);
        expect(stat('heroes').textContent.trim()).toBe('3');
        expect(stat('playtime').textContent.trim()).toBe('2h 5m');
        expect(stat('away').textContent.trim()).toBe('3 h');
        for (const name of ['heroes', 'playtime', 'away']) {
            expect(stat(name).querySelector('svg.lucide'), name).not.toBeNull();
        }
        expect(document.body.textContent).not.toMatch(EMOJI);
    });

    it('Load and New Game hand the slot to the game', () => {
        plantSlots();
        const onSelect = vi.fn();
        render(h(SlotSelectionModal, { isOpen: true, onSelect }));
        fireEvent.click([...row(1).querySelectorAll('button')].find(b => b.textContent.includes('Load')));
        fireEvent.click([...row(2).querySelectorAll('button')].find(b => b.textContent.includes('New Game')));
        expect(onSelect.mock.calls.map(c => c[0])).toEqual([0, 1]);
    });

    it('delete asks first; Cancel keeps the save, Confirm removes it and says so', () => {
        plantSlots();
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        fireEvent.click(row(1).querySelector('[data-slot-delete]'));
        expect(row(1).textContent).toContain('Delete Forever?');
        fireEvent.click([...row(1).querySelectorAll('button')].find(b => b.textContent.includes('Cancel')));
        expect(row(1).textContent).not.toContain('Delete Forever?');
        expect(localStorage.getItem('fantasy_guild_slot_0')).not.toBeNull();

        fireEvent.click(row(1).querySelector('[data-slot-delete]'));
        fireEvent.click([...row(1).querySelectorAll('button')].find(b => b.textContent.includes('Confirm')));
        expect(localStorage.getItem('fantasy_guild_slot_0')).toBeNull();
        expect(row(1).getAttribute('data-slot-state')).toBe('empty');
        expect(document.querySelector('[data-slot-message]').textContent).toBe('Slot 1 deleted');
    });

    it('a damaged slot can be deleted, which frees it', () => {
        plantSlots();
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        fireEvent.click(row(3).querySelector('[data-slot-delete]'));
        fireEvent.click([...row(3).querySelectorAll('button')].find(b => b.textContent.includes('Confirm')));
        expect(localStorage.getItem('fantasy_guild_slot_2')).toBeNull();
        expect(row(3).getAttribute('data-slot-state')).toBe('empty');
    });

    it('a refused load\'s message shows red under the slots', () => {
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        act(() => { NotificationSystem.notify('This save appears to be damaged and could not be loaded.', 'error'); });
        const line = document.querySelector('[data-slot-message]');
        expect(line.textContent).toContain('damaged');
        expect(line.className).toContain('text-red-400');
    });

    it('a slot whose save cannot be parsed reads as damaged, not empty', () => {
        localStorage.setItem('fantasy_guild_slot_1', 'not json');
        expect(SaveManager.getSlotInfo(1)).toMatchObject({ slotIndex: 1, damaged: true });
        expect(SaveManager.getSlotInfo(0)).toBeNull();
    });
});

describe('the title', () => {
    it('the game\'s name in the display size over the banner picture, until the owner\'s art exists', () => {
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        const name = document.querySelector('[data-title-name]');
        expect(name.getAttribute('data-title-name')).toBe('text');
        expect(name.textContent).toBe('Fantasy Guild');
        expect(name.className).toContain('ui-text-display');
        expect(document.querySelector('[data-title-picture]').getAttribute('data-title-picture')).toBe(areaBannerSrc(TITLE_BANNER));
    });

    it('the owner\'s logo and painting replace the name and the banner once their files load', async () => {
        const sizes = { [TITLE_LOGO_SRC]: [200, 60], [TITLE_PAINTING_SRC]: [480, 270] };
        class FakeImage {
            set src(v) {
                this._src = v;
                const size = sizes[v];
                if (size) {
                    [this.naturalWidth, this.naturalHeight] = size;
                    queueMicrotask(() => this.onload?.());
                } else {
                    queueMicrotask(() => this.onerror?.());
                }
            }
            get src() { return this._src; }
        }
        vi.stubGlobal('Image', FakeImage);
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        await act(async () => { await Promise.resolve(); });
        const name = document.querySelector('[data-title-name]');
        expect(name.getAttribute('data-title-name')).toBe('logo');
        const logo = name.querySelector('img');
        expect(logo.getAttribute('src')).toBe(TITLE_LOGO_SRC);
        // Drawn at a whole multiple of its size.
        expect(parseInt(logo.style.width) % 200).toBe(0);
        expect(document.querySelector('[data-title-picture]').getAttribute('data-title-picture')).toBe(TITLE_PAINTING_SRC);
    });

    it('a missing logo or painting keeps the stand-ins', async () => {
        class MissingImage { set src(v) { queueMicrotask(() => this.onerror?.()); } }
        vi.stubGlobal('Image', MissingImage);
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        await act(async () => { await Promise.resolve(); });
        expect(document.querySelector('[data-title-name]').getAttribute('data-title-name')).toBe('text');
        expect(document.querySelector('[data-title-picture]').getAttribute('data-title-picture')).toBe(areaBannerSrc(TITLE_BANNER));
    });
});

describe('whole-pixel scales', () => {
    it('cover grows by whole steps, shrinks a picture bigger than the box', () => {
        expect(coverScale({ width: 256, height: 256 }, { width: 1366, height: 768 })).toBe(6);
        expect(coverScale({ width: 256, height: 256 }, { width: 1920, height: 1080 })).toBe(8);
        expect(coverScale({ width: 256, height: 256 }, { width: 256, height: 100 })).toBe(1);
        expect(coverScale({ width: 3840, height: 2160 }, { width: 1920, height: 1080 })).toBe(0.5);
    });

    it('fit is the largest whole multiple inside the box, at least 1', () => {
        expect(fitScale({ width: 200, height: 60 }, { width: 672, height: 240 })).toBe(3);
        expect(fitScale({ width: 900, height: 60 }, { width: 672, height: 240 })).toBe(1);
    });
});

describe('each slot shows the time away it has built up', () => {
    const MIN = 60 * 1000;
    const now = 1_800_000_000_000;
    const info = (ago) => ({ slotIndex: 0, lastSavedAt: now - ago });

    it('in the away summary wording', () => {
        expect(slotAwayText(info(20 * 1000), now)).toBe('less than a minute');
        expect(slotAwayText(info(45 * MIN), now)).toBe('45 min');
        expect(slotAwayText(info(3 * HOUR + 12 * MIN), now)).toBe('3 h 12 min');
        expect(slotAwayText(info(24 * HOUR), now)).toBe('24 h');
    });

    it('past the 24 hours a load plays, it reads 24 h (max)', () => {
        expect(CATCH_UP.CAP_MS).toBe(24 * HOUR);
        expect(slotAwayText(info(24 * HOUR + MIN), now)).toBe('24 h (max)');
        expect(slotAwayText(info(30 * HOUR), now)).toBe('24 h (max)');
        expect(slotAwayText(info(40 * 24 * HOUR), now)).toBe('24 h (max)');
    });

    it('nothing for an empty or damaged slot, or one with no save time', () => {
        expect(slotAwayText(null, now)).toBeNull();
        expect(slotAwayText({ slotIndex: 2, damaged: true }, now)).toBeNull();
        expect(slotAwayText({ slotIndex: 0, lastSavedAt: null }, now)).toBeNull();
    });

    it('a save time a little ahead of the clock reads less than a minute', () => {
        expect(slotAwayText(info(-5 * MIN), now)).toBe('less than a minute');
    });

    it('on the screen: the away stat replaces last saved, whose time moves to its tip; none on empty or damaged slots', () => {
        expect(AWAY_REPLACES_LAST_SAVED).toBe(true);
        plantSlots();
        localStorage.setItem('fantasy_guild_slot_1', slotSave(1, Date.now() - 30 * HOUR));
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        const away = row(1).querySelector('[data-slot-stat="away"]');
        expect(away.textContent.trim()).toBe('3 h');
        expect(away.getAttribute('title')).toContain('last saved 3 hours ago');
        expect(row(1).querySelector('[data-slot-stat="saved"]')).toBeNull();
        expect(row(2).querySelector('[data-slot-stat="away"]').textContent.trim()).toBe('24 h (max)');
        localStorage.removeItem('fantasy_guild_slot_1');
        cleanup();
        render(h(SlotSelectionModal, { isOpen: true, onSelect: () => {} }));
        expect(row(2).querySelector('[data-slot-stat]')).toBeNull();
        expect(row(3).querySelector('[data-slot-stat]')).toBeNull();
    });
});
