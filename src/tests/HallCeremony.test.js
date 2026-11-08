// @vitest-environment jsdom
// The Guild Hall's upgrade ceremony: a purchase heard while the sky is open bursts its star, runs
// light to what it opened and marks a finished constellation, once; a load, a catch-up or a dev
// write plays nothing. The frames are whole art pixels.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, act } from '@testing-library/react';
import { GuildHallBoard, finishedConstellations } from '../ui/components/board/GuildHallBoard.jsx';
import {
    ceremonyFor, burstFrames, burstMs, runSteps, constellationStars, CEREMONY_PX, STAR_CHIME, CONSTELLATION_CHIME
} from '../ui/components/board/hallCeremony.js';
import { ceremonyMs } from '../ui/components/board/HallCeremony.jsx';
import { planStarThatOpens, planConstellationOneShort } from '../ui/dev/hallCeremonyDev.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { totalPrice } from '../config/guildUpgrades.js';
import { withOuterUpgrade, OUTER_UPGRADE_ID as OUTER } from './fixtures/outerUpgrade.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

const renderWeb = () => render(React.createElement(GuildHallBoard, {}));
const ceremonyIn = (container) => container.querySelector('[data-hall-ceremony]');
const src = (rel) => readFileSync(resolve(__dirname, rel), 'utf8');

/** Buy a star's next rank as the panel does: its price in the Bank, then the purchase. */
function buy(id) {
    for (const { itemId, quantity } of totalPrice(GuildUpgradeManager.getNextCost(id))) InventoryManager.addItem(itemId, quantity);
    expect(GuildUpgradeManager.purchase(id).success, id).toBe(true);
}

withOuterUpgrade();

let sounds;
let unsubscribe;
beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.progress.guildUpgrades = {};
    InventoryManager.init();
    sounds = [];
    unsubscribe = EventBus.subscribe(ENGINE_EVENTS.AUDIO_PLAY, (d) => sounds.push(d));
});
afterEach(() => {
    unsubscribe?.();
    EventBus.setQuiet(false);
    vi.useRealTimers();
});

describe('what a purchase lights', () => {
    it('plays nothing without a star and a rank: a load or a dev write', () => {
        expect(ceremonyFor(undefined, undefined, {})).toBeNull();
        expect(ceremonyFor('no_such_star', 1, {})).toBeNull();
        expect(ceremonyFor('bank_tabs', 0, {})).toBeNull();
    });

    it('names the stars a first rank opens, and none for a later rank', () => {
        const first = ceremonyFor('bank_tabs', 1, { bank_tabs: 1 });
        expect(first.opened).toEqual([OUTER]);
        expect(ceremonyFor('bank_tabs', 2, { bank_tabs: 2 }).opened).toEqual([]);
        // A star already open through another link is not opened again.
        expect(ceremonyFor('bank_tabs', 1, { bank_tabs: 1, roster_size: 1 }).opened).toEqual([OUTER]);
    });

    it('names a constellation the purchase finished, agreeing with the sky, and only then', () => {
        // The Vault is Bank Tabs and the outer test star.
        expect(ceremonyFor('bank_tabs', 1, { bank_tabs: 1 }).finished).toEqual([]);
        const done = ceremonyFor(OUTER, 1, { bank_tabs: 1, [OUTER]: 1 });
        expect(done.finished).toEqual(['vault']);
        expect(finishedConstellations({ bank_tabs: 1, [OUTER]: 1 })).toContain('vault');
        expect(ceremonyFor(OUTER, 2, { bank_tabs: 1, [OUTER]: 2 }).finished).toEqual([]);
    });

    it('QA plans leave the sky one purchase short of each moment', () => {
        const opens = planStarThatOpens();
        expect(opens.ok).toBe(true);
        expect(ceremonyFor(opens.id, 1, opens.ranks).opened.length).toBeGreaterThan(0);
        const short = planConstellationOneShort();
        expect(short.ok).toBe(true);
        expect(ceremonyFor(short.id, 1, short.ranks).finished.length).toBe(1);
    });
});

describe('the frames are hard pixels', () => {
    it('every burst frame is whole art pixels, clear of the star, moving outward', () => {
        for (const kind of ['star', 'opened', 'constellation']) {
            const frames = burstFrames(kind);
            expect(frames.length, kind).toBeGreaterThan(1);
            let lastReach = 0;
            for (const f of frames) {
                expect(f.px.length).toBeGreaterThan(0);
                for (const [x, y] of f.px) {
                    expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
                    // Clear of a star with its item outline (34 art pixels across).
                    expect(Math.max(Math.abs(x), Math.abs(y))).toBeGreaterThanOrEqual(kind === 'opened' ? 9 : 11);
                }
                const reach = Math.max(...f.px.map(([x, y]) => Math.hypot(x, y)));
                expect(reach).toBeGreaterThan(lastReach);
                lastReach = reach;
            }
        }
        expect(burstMs('constellation')).toBeGreaterThan(burstMs('star'));
    });

    it('the light hops whole art pixels and never takes more than about a second', () => {
        for (const len of [40, 280, 600, 1400]) {
            const { hops, ms } = runSteps(len);
            expect(Number.isInteger(hops) && hops > 0).toBe(true);
            expect((len + 6 * CEREMONY_PX) / hops).toBeLessThanOrEqual(6 * CEREMONY_PX);
            expect(ms).toBeLessThanOrEqual(hops * 60);
            if (hops * 30 <= 900) expect(ms).toBeLessThanOrEqual(900);
        }
    });

    it('draws no soft glow or blur, and holds every frame (steps)', () => {
        const css = src('../tailwind.css');
        const block = css.slice(css.indexOf('upgrade ceremony'), css.indexOf('gi-constellation-glow-still 900ms'));
        expect(block.length).toBeGreaterThan(100);
        expect(block).not.toMatch(/blur|drop-shadow|box-shadow|ease|linear/);
        expect(block).toMatch(/steps\(1, end\)/);
        expect(src('../ui/components/board/HallCeremony.jsx')).toMatch(/steps\(\$\{hops\}, end\)/);
    });
});

describe('the ceremony on the open sky', () => {
    it('a purchase bursts its star and runs light to what it opened, with a chime, then goes', async () => {
        vi.useFakeTimers();
        const { container } = renderWeb();
        expect(ceremonyIn(container)).toBeNull();

        await act(async () => buy('bank_tabs'));
        const c = ceremonyIn(container);
        expect(c?.getAttribute('data-hall-ceremony')).toBe('bank_tabs');
        expect(c.getAttribute('data-ceremony-opened')).toBe(OUTER);
        expect(c.querySelector('[data-ceremony-burst="star"]')).toBeTruthy();
        expect(c.querySelectorAll('[data-ceremony-run]')).toHaveLength(1);
        expect(c.querySelector('[data-ceremony-burst="opened"]')).toBeTruthy();
        expect(sounds).toEqual([{ clip: STAR_CHIME, options: { pitchVariance: 0 } }]);

        await act(async () => { vi.advanceTimersByTime(ceremonyMs({ opened: [OUTER], finished: [] }, 900) + 10); });
        expect(ceremonyIn(container)).toBeNull();
    });

    it('finishing a constellation plays the bigger moment: big burst, every star sparkles, the lines flash', async () => {
        GameState.state.progress.guildUpgrades = { bank_tabs: 1 };
        const { container } = renderWeb();
        await act(async () => buy(OUTER));
        const c = ceremonyIn(container);
        expect(c.getAttribute('data-ceremony-finished')).toBe('vault');
        expect(c.querySelector('[data-ceremony-burst="constellation"]')).toBeTruthy();
        // Every other star of the Vault sparkles.
        expect(c.querySelectorAll('[data-ceremony-burst="opened"]')).toHaveLength(constellationStars('vault').length - 1);
        expect(container.querySelector('[data-constellation-glow="vault"]')).toBeTruthy();
        expect(sounds.map(s => s.clip)).toEqual([CONSTELLATION_CHIME]);
        // The slot for the owner's picture is there (its art is not yet).
        expect(container.querySelector('[data-constellation-picture="vault"]')?.getAttribute('src'))
            .toBe('/assets/playmat/screens/constellation_vault.png');
    });

    it('plays once per purchase: a second purchase replaces the first', async () => {
        const { container } = renderWeb();
        await act(async () => buy('bank_tabs'));
        await act(async () => buy('bank_tabs'));
        expect(container.querySelectorAll('[data-hall-ceremony]')).toHaveLength(1);
        expect(ceremonyIn(container).getAttribute('data-ceremony-opened')).toBe('');
        expect(sounds).toHaveLength(2);
    });

    it('plays nothing on load, on a dev write, on a reset, or on a catch-up', async () => {
        GameState.state.progress.guildUpgrades = { bank_tabs: 1, [OUTER]: 1, roster_size: 1 };
        const { container } = renderWeb();
        expect(ceremonyIn(container)).toBeNull();
        expect(container.querySelector('[data-constellation-glow]')).toBeNull();

        await act(async () => {
            EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});
            EventBus.publish(ENGINE_EVENTS.GAME_RESET, {});
        });
        // A load that finishes a constellation while the sky is open does not flash it.
        await act(async () => {
            GameState.state.progress.guildUpgrades = { bank_tabs: 1, [OUTER]: 1, roster_size: 1, wishing_well: 1 };
            EventBus.publish(ENGINE_EVENTS.GAME_RESET, {});
        });
        expect(ceremonyIn(container)).toBeNull();
        expect(container.querySelector('[data-constellation-glow]')).toBeNull();

        // A catch-up runs with the bus quiet: the sky does not hear a purchase in it.
        EventBus.setQuiet(true);
        await act(async () => buy('bank_tabs'));
        EventBus.setQuiet(false);
        expect(ceremonyIn(container)).toBeNull();
        expect(sounds).toEqual([]);
    });

    it('a rank bought while the Hall is closed plays nothing when it opens', async () => {
        buy('bank_tabs');
        const { container } = renderWeb();
        expect(ceremonyIn(container)).toBeNull();
        expect(container.querySelector('[data-constellation-glow]')).toBeNull();
    });

    it('under reduced motion shows the still version: one frame and the line lit, held', async () => {
        const mm = window.matchMedia;
        window.matchMedia = (q) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} });
        try {
            const { container } = renderWeb();
            await act(async () => buy('bank_tabs'));
            const c = ceremonyIn(container);
            expect(c.classList.contains('gi-ceremony-still')).toBe(true);
            expect(c.querySelectorAll('.gi-burst-still').length).toBeGreaterThan(0);
            expect(c.querySelector('.gi-run-still')).toBeTruthy();
        } finally {
            window.matchMedia = mm;
        }
    });
});

