import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { hallCameraSides } from './fixtures/hallCameraSides.js';
import { SRC } from './fixtures/sourceScan.js';
import { bottomDrawerToClose } from '../ui/hooks/useOneBottomDrawer.js';

/**
 * ⭐ **The hero bar shows on every screen** (concept_inspection_drawers §1): the mat, the Bank, the
 * Shop, the world map and the Guild Hall. `ReactRoot` lays it under the Hall camera, on neither of
 * its sides, so the camera never takes it away; and outside the mat column's own layer, so it is
 * drawn over the side drawers and the hero panel.
 */
describe('the hero bar on every screen', () => {
    it('is laid once, under the Hall camera rather than on either of its sides', () => {
        const { code, camera, hall, mat } = hallCameraSides();
        expect([...code.matchAll(/<BottomHeroDock\b/g)]).toHaveLength(1);
        expect(camera).not.toContain('<BottomHeroDock');
        expect(hall).not.toContain('<BottomHeroDock');
        expect(mat).not.toContain('<BottomHeroDock');
        expect(code.indexOf('<BottomHeroDock')).toBeGreaterThan(code.indexOf('</HallCamera>'));
    });

    it('is outside the box that gives the camera its layer: its own layer is the screen’s', () => {
        const { code } = hallCameraSides();
        const camera = code.indexOf('<HallCamera');
        const box = code.lastIndexOf('<div className="flex-1 min-h-0 relative flex flex-col z-10">', camera);
        expect(box).toBeGreaterThan(-1);
        // Only the camera and the arrival card stand in the box; it closes before the bar.
        const between = code.slice(code.indexOf('</HallCamera>'), code.indexOf('<BottomHeroDock'));
        expect(between).toMatch(/<ArrivalCard \/>[\s\S]*<\/div>/);
        // The column around both has no layer of its own, or the bar could never be over a drawer.
        const column = code.slice(code.lastIndexOf('<div', box - 1), box);
        expect(column).not.toMatch(/\bz-\d/);
    });

    it('its layer is over the drawers and the hero panel, and under the nav', () => {
        const css = fs.readFileSync(`${SRC}/tailwind.css`, 'utf8');
        const z = (name) => Number(new RegExp(`--z-${name}:\\s*(\\d+)`).exec(css)?.[1]);
        expect(z('hero-bar')).toBeGreaterThan(z('drawer'));
        expect(z('hero-bar')).toBeGreaterThan(z('hero-panel'));
        expect(z('hero-bar')).toBeLessThan(z('nav'));
    });

    it('the hero tabs beside the Bank are gone', () => {
        expect(fs.existsSync(`${SRC}/ui/components/dock/HeroDockTab.jsx`)).toBe(false);
        expect(hallCameraSides().code).not.toContain('showTabs');
    });
});

/** One panel at a time over the bar: the Shop and a hero's panel close each other. */
describe('one bottom panel at a time', () => {
    const none = { shop: false, hero: null };

    it('opening the Shop closes the hero panel', () => {
        expect(bottomDrawerToClose({ shop: false, hero: 'h1' }, { shop: true, hero: 'h1' })).toBe('hero');
    });

    it('opening a hero, or another hero, closes the Shop', () => {
        expect(bottomDrawerToClose({ shop: true, hero: null }, { shop: true, hero: 'h1' })).toBe('shop');
        expect(bottomDrawerToClose({ shop: true, hero: 'h1' }, { shop: true, hero: 'h2' })).toBe('shop');
    });

    it('one alone stays open, and nothing open closes nothing', () => {
        expect(bottomDrawerToClose(none, { shop: true, hero: null })).toBeNull();
        expect(bottomDrawerToClose(none, { shop: false, hero: 'h1' })).toBeNull();
        expect(bottomDrawerToClose(none, none)).toBeNull();
    });

    it('ReactRoot keeps the rule with the Shop and the hero panel', () => {
        expect(hallCameraSides().code).toMatch(/useOneBottomDrawer\(\{ shopOpen: ui\.shop\.isOpen, heroId: inspectHeroId, closeShop: ui\.shop\.close, closeHero: closeInspectHero \}\)/);
    });
});
