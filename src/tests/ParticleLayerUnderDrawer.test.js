// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import { join } from 'node:path';
import { render, cleanup, act } from '@testing-library/react';

/**
 * Loot flies on the mat's layer: over the mat, under the Bank and Shop drawers. Only a hero lifted
 * from the dock flies over everything, to the pointer, which can be over the hero panel.
 */

vi.mock('../systems/core/SettingsManager.js', () => ({
    SettingsManager: { get: () => true }
}));
vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: (id) => ({ id, icon: '*', color: '#4ade80' })
}));
vi.mock('../utils/AssetManager.js', () => ({ resolveSpritePath: () => '' }));
vi.mock('../state/GameState.js', () => ({ GameState: { heroes: [] } }));

import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { ParticleOverlay } from '../ui/components/base/ParticleOverlay.jsx';

const SRC = join(process.cwd(), 'src');
const css = fs.readFileSync(join(SRC, 'tailwind.css'), 'utf8');
const table = Object.fromEntries([...css.matchAll(/^\s*--z-([a-z-]+):\s*(\d+);/gm)].map(m => [m[1], Number(m[2])]));
const root = fs.readFileSync(join(SRC, 'ui', 'ReactRoot.jsx'), 'utf8');

let queue;
let clock;
const fakeCtx = new Proxy({}, {
    get: (target, key) => (key in target ? target[key] : () => ({ addColorStop() {} })),
    set: (target, key, value) => { target[key] = value; return true; }
});

const loot = () => EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
    kind: 'item', refId: 'item_oak_log', quantity: 1,
    fromScreenX: 100, fromScreenY: 100, toScreenX: 400, toScreenY: 300
});
const heroLift = () => EventBus.publish(UI_EVENTS.UI_PARTICLE_FLY, {
    kind: 'hero', heroId: 'h1', destination: 'cursor',
    fromScreenX: 300, fromScreenY: 500, toScreenX: 260, toScreenY: 200
});

describe('the layers table puts loot under the drawers', () => {
    it('the mat flights sit under the drawers, the hero panel, the nav and the mat pop-ups', () => {
        expect(table['mat-flights']).toBeGreaterThan(0);
        expect(table['mat-flights']).toBeLessThan(table.drawer);
        expect(table['mat-flights']).toBeLessThan(table['hero-panel']);
        expect(table['mat-flights']).toBeLessThan(table.nav);
        expect(table['mat-flights']).toBeLessThan(table['mat-tip']);
    });

    it('a hero lifted from the dock still flies over the drawers and the hero panel', () => {
        expect(table['pointer-flight']).toBeGreaterThan(table.drawer);
        expect(table['pointer-flight']).toBeGreaterThan(table['hero-panel']);
        expect(table['pointer-flight']).toBeGreaterThan(table.nav);
    });
});

describe('ReactRoot mounts the mat flights inside the screen layers', () => {
    it('the mat canvas is inside the overlay that holds the drawers, so its number is compared with theirs', () => {
        // ⚠️ A canvas outside `.react-overlay` (z-50) is compared with the overlay as a whole: any
        // number above 50 draws it over the drawers, any below hides it under the mat too.
        const overlayAt = root.indexOf('react-overlay');
        const matAt = root.search(/<ParticleOverlay\s+layer="mat"/);
        const bankAt = root.indexOf('<BankDrawer');
        expect(overlayAt).toBeGreaterThan(-1);
        expect(matAt).toBeGreaterThan(overlayAt);
        expect(matAt).toBeLessThan(bankAt);
    });

    it('no loot flies while the Bank covers the mat', () => {
        const tag = root.match(/<ParticleOverlay\s+layer="mat"[^>]*>/)?.[0] ?? '';
        expect(tag).toMatch(/disabled=\{[^}]*isBankOpen/);
    });

    it('the pointer canvas is mounted too', () => {
        expect(root).toMatch(/<ParticleOverlay\s+layer="pointer"/);
    });
});

describe('each canvas takes its own flights', () => {
    beforeEach(() => {
        queue = [];
        clock = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => clock);
        vi.stubGlobal('requestAnimationFrame', (cb) => { queue.push(cb); return queue.length; });
        vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('the mat canvas draws loot on the mat layer and ignores a hero lifted from the dock', () => {
        const { container } = render(React.createElement(ParticleOverlay, { layer: 'mat', disabled: false }));
        const canvas = container.querySelector('canvas');
        expect(canvas.className).toContain('z-(--z-mat-flights)');
        act(() => { heroLift(); });
        expect(queue.length).toBe(0);
        act(() => { loot(); });
        expect(queue.length).toBe(1);
    });

    it('the pointer canvas draws a hero lifted from the dock on top and ignores loot', () => {
        const { container } = render(React.createElement(ParticleOverlay, { layer: 'pointer', disabled: false }));
        const canvas = container.querySelector('canvas');
        expect(canvas.className).toContain('z-(--z-pointer-flight)');
        act(() => { loot(); });
        expect(queue.length).toBe(0);
        act(() => { heroLift(); });
        expect(queue.length).toBe(1);
    });
});
