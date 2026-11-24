// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import * as Banners from '../systems/notifications/banners.js';
import { BannerStack, BANNERS_SHOWN_SETTING } from '../ui/components/notifications/BannerStack.jsx';
import { PEEK_MS, cornerBanners, peeksAfter, bannersOut } from '../ui/components/notifications/bannerCorner.js';
import { STUB_COLUMN_TOP_PX, BANNER_CORNER_TOP_PX, STUB_PX } from '../ui/components/notifications/stubGeometry.js';

/**
 * The banner corner: a show/hide icon at the top right, above the item stubs. Shown, every banner
 * is listed (no three-limit, no "+N"); hidden, a new one pops out for about 5 s and tucks back in.
 * The icon counts them, red with a problem among them; shown or hidden is kept per device.
 */

const hero = (name) => ({ kind: 'hero', parts: { heroes: [name] } });
const upgrade = (name) => ({ kind: 'upgrade', parts: { upgrades: [name], detail: 'more' } });
const knockout = (name) => ({ kind: 'knockout', parts: { heroes: [name], lost: [] }, subjects: [{ type: 'hero', id: name }] });
const event = (key) => ({ kind: 'event', parts: { name: 'Rainfall', kind: 'buff', minutes: 20 }, groupKey: key });

const listed = (c) => [...c.querySelectorAll('[data-banner]')].filter(b => b.dataset.bannerLeaving !== 'true');
const icon = (c) => c.querySelector('[data-banner-corner]');
const setShown = (on) => act(() => { SettingsManager.set(BANNERS_SHOWN_SETTING, on); });

beforeEach(() => {
    Banners.reset();
    SettingsManager.set(BANNERS_SHOWN_SETTING, true);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Banners.reset();
    SettingsManager.set(BANNERS_SHOWN_SETTING, true);
});

describe('the rules, pure', () => {
    it('away keeps only the banners that point to a Token; the count and the red follow the list', () => {
        const all = [
            { id: 1, kind: 'knockout', tone: 'problem' },
            { id: 2, kind: 'event', tone: 'milestone' },
            { id: 3, kind: 'hero', tone: 'milestone' }
        ];
        expect(cornerBanners(all, false)).toMatchObject({ count: 3, problem: true });
        expect(cornerBanners(all, true)).toMatchObject({ count: 1, problem: false });
        expect(cornerBanners(all, true).list.map(b => b.id)).toEqual([2]);
    });

    it('hidden, a new banner pops out until its time is up; one put back quietly never does', () => {
        const a = { id: 1 };
        const quiet = { id: 2, quiet: true };
        let at = peeksAfter({ banners: [a, quiet], seen: new Set(), peeks: new Map(), open: false, now: 1000 });
        expect([...at.peeks]).toEqual([[1, 1000 + PEEK_MS]]);
        at = peeksAfter({ banners: [a, quiet], seen: at.seen, peeks: at.peeks, open: false, now: 1000 + PEEK_MS - 1 });
        expect(at.peeks.has(1)).toBe(true);
        at = peeksAfter({ banners: [a, quiet], seen: at.seen, peeks: at.peeks, open: false, now: 1000 + PEEK_MS });
        expect(at.peeks.size).toBe(0);
        // Met once, it does not pop out again.
        at = peeksAfter({ banners: [a, quiet], seen: at.seen, peeks: at.peeks, open: false, now: 99_999 });
        expect(at.peeks.size).toBe(0);
    });

    it('open, nothing pops out, and what arrived while open does not pop out once hidden', () => {
        const a = { id: 1 };
        let at = peeksAfter({ banners: [a], seen: new Set(), peeks: new Map(), open: true, now: 0 });
        expect(at.peeks.size).toBe(0);
        at = peeksAfter({ banners: [a], seen: at.seen, peeks: at.peeks, open: false, now: 1 });
        expect(at.peeks.size).toBe(0);
    });

    it('draws all while open, else only the ones popped out', () => {
        const list = [{ id: 1 }, { id: 2 }];
        expect(bannersOut(list, true, new Map())).toBe(list);
        expect(bannersOut(list, false, new Map([[2, 5]])).map(b => b.id)).toEqual([2]);
    });
});

describe('the corner on screen', () => {
    it('sits above the item stubs, which start under the icon', () => {
        expect(STUB_COLUMN_TOP_PX).toBeGreaterThanOrEqual(BANNER_CORNER_TOP_PX + STUB_PX);
        const view = render(createElement(BannerStack));
        const corner = view.container.querySelector('[data-banners]');
        expect(corner.style.top).toBe(`${BANNER_CORNER_TOP_PX}px`);
        expect(corner.className).toContain('right-0');
        expect(corner.firstChild.querySelector('[data-banner-corner]')).not.toBeNull();
    });

    it('shown: every banner is listed, newest first, with no "+N"', () => {
        for (const n of ['A', 'B', 'C', 'D', 'E']) Banners.push(upgrade(n));
        const view = render(createElement(BannerStack));
        expect(listed(view.container)).toHaveLength(5);
        expect(view.container.querySelector('[data-banners-waiting]')).toBeNull();
        expect(view.container.textContent).not.toContain('+');
        expect(listed(view.container)[0].textContent).toContain('E');
    });

    it('each leaves when clicked', () => {
        vi.useFakeTimers();
        for (const n of ['A', 'B', 'C']) Banners.push(upgrade(n));
        const view = render(createElement(BannerStack));
        fireEvent.click(listed(view.container)[1]);
        act(() => { vi.advanceTimersByTime(300); });
        expect(Banners.getAll().map(b => b.parts.upgrades[0])).toEqual(['C', 'A']);
        expect(listed(view.container)).toHaveLength(2);
    });

    it('the icon counts what waits, red only with a problem among them', () => {
        const view = render(createElement(BannerStack));
        expect(icon(view.container).dataset.bannerCount).toBe('0');
        act(() => { Banners.push(hero('Aela')); Banners.push(upgrade('A')); });
        expect(icon(view.container).dataset.bannerCount).toBe('2');
        expect(icon(view.container).dataset.bannerProblem).toBeUndefined();
        expect(view.container.querySelector('[data-banner-count-text]').textContent).toBe('2');
        act(() => { Banners.push(knockout('Bram')); });
        expect(icon(view.container).dataset.bannerProblem).toBe('true');
        expect(icon(view.container).querySelector('img').getAttribute('src')).toContain('u_alert_red');
    });

    it('a click on the icon hides them all, another shows them all again', () => {
        for (const n of ['A', 'B', 'C', 'D']) Banners.push(upgrade(n));
        const view = render(createElement(BannerStack));
        expect(listed(view.container)).toHaveLength(4);
        fireEvent.click(icon(view.container));
        expect(icon(view.container).dataset.bannerCorner).toBe('hidden');
        expect(listed(view.container)).toHaveLength(0);
        expect(icon(view.container).dataset.bannerCount).toBe('4');
        expect(Banners.getAll()).toHaveLength(4);
        fireEvent.click(icon(view.container));
        expect(listed(view.container)).toHaveLength(4);
    });

    it('hidden: a new banner pops out for about 5 s, then tucks back in', () => {
        vi.useFakeTimers();
        setShown(false);
        Banners.push(upgrade('Old'));
        const view = render(createElement(BannerStack));
        expect(listed(view.container)).toHaveLength(0);
        act(() => { Banners.push(hero('Aela')); });
        expect(listed(view.container).map(b => b.dataset.banner)).toEqual(['hero']);
        act(() => { vi.advanceTimersByTime(PEEK_MS - 100); });
        expect(listed(view.container)).toHaveLength(1);
        act(() => { vi.advanceTimersByTime(200); });
        expect(listed(view.container)).toHaveLength(0);
        // It lifts back in, then is gone from the screen; it still waits in the icon.
        act(() => { vi.advanceTimersByTime(300); });
        expect(view.container.querySelectorAll('[data-banner]')).toHaveLength(0);
        expect(icon(view.container).dataset.bannerCount).toBe('2');
    });

    it('hidden: a banner put back silently (a load) does not pop out', () => {
        setShown(false);
        const view = render(createElement(BannerStack));
        act(() => { Banners.push(knockout('Aela'), { silent: true }); });
        expect(listed(view.container)).toHaveLength(0);
        expect(icon(view.container).dataset.bannerProblem).toBe('true');
    });

    it('over the World Map, nothing at all without a banner that points to a Token', () => {
        Banners.push(hero('Aela'));
        const away = render(createElement(BannerStack, { away: true }));
        expect(icon(away.container)).toBeNull();
        act(() => { Banners.push(event('event:x')); });
        expect(icon(away.container).dataset.bannerCount).toBe('1');
    });
});

describe('shown or hidden is kept per device', () => {
    it('is a setting, shown by default, written to the device storage', () => {
        expect(SettingsManager.get(BANNERS_SHOWN_SETTING)).toBe(true);
        const view = render(createElement(BannerStack));
        fireEvent.click(icon(view.container));
        expect(SettingsManager.get(BANNERS_SHOWN_SETTING)).toBe(false);
        const stored = JSON.parse(localStorage.getItem('fantasy_guild_settings'));
        expect(stored.notifications.bannersShown).toBe(false);
    });

    it('a corner drawn again comes back hidden', () => {
        setShown(false);
        Banners.push(hero('Aela'));
        const view = render(createElement(BannerStack));
        expect(icon(view.container).dataset.bannerCorner).toBe('hidden');
        expect(listed(view.container)).toHaveLength(0);
    });
});
