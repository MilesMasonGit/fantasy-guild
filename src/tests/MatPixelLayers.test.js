// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EngineContext } from '../ui/context/EngineContext';
import { Board } from '../ui/components/board/Board.jsx';
import { TokenChargeDeltaFloater } from '../ui/components/board/TokenBadges.jsx';
import { playSpawn } from '../ui/components/board/spawnMotion.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **A Token standing still on the mat is always drawn the one crisp way.** The mat is scaled
 * to fit the window, so a Token stands at a fractional screen position; painted into the mat's
 * own layer it lands crisp. Chrome puts an animation it runs on the compositor on a layer of its
 * own, every Token drawn after it must then be a layer too ("overlap"), and those Tokens were
 * drawn resampled: soft and a pixel off until the animation ended. Any -1, landing hop, flash,
 * spawn, glow or walking enemy among the resting Tokens did it, and every hidden name label (its
 * drop shadow is a filter that needs a layer of its own) spread it.
 * The cure is per animation, not the whole mat: `will-change: contents` on each element that
 * animates among the resting Tokens runs that animation on the main thread. Animations drawn
 * above every resting Token (a worked Token's -1 and hit loop, a walking hero, floor loot) stay on
 * the compositor; the whole mat on the main thread repainted it every frame (a third more frame
 * work). Chrome's layers cannot be seen from jsdom (`npm run bench:crisp` checks them in Chrome):
 * these guard the properties that keep them away.
 */

const h = React.createElement;
const TAILWIND = readFileSync(resolve(__dirname, '../tailwind.css'), 'utf8');

beforeEach(() => { GameState.initNew(); InventoryManager.init(); clearMat(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const engine = (el) => h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el));
const boxesOf = (container, id) => [
    container.querySelector(`[data-token-art][data-token-id="${id}"]`),
    container.querySelector(`[data-token-overlay="${id}"]`)
];
const artInnerOf = (container, id) => container.querySelector(`[data-token-art][data-token-id="${id}"] > .w-full.h-full`);

/** Every declaration block whose selector list names `.cls` exactly. */
function rulesFor(css, cls) {
    const out = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
        const selectors = m[1].split(',').map(s => s.trim());
        if (selectors.some(s => new RegExp(`\\.${cls}(?![\\w-])`).test(s))) out.push(m[2]);
    }
    return out;
}

describe('⭐ an animation among the resting Tokens never runs on the compositor', () => {
    it('the hop, the flash, the glow, the quest halo and the gear pulse keep it on the main thread', () => {
        for (const cls of ['gi-token-land', 'gi-transform-flash', 'gi-transform-glow', 'gi-quest-ready', 'gi-gear-pulse']) {
            const rules = rulesFor(TAILWIND, cls);
            expect(rules.length, cls).toBeGreaterThan(0);
            expect(rules.some(r => /will-change:\s*contents/.test(r)), cls).toBe(true);
        }
    });

    it('an enemy\'s two boxes (its walk and its knockback) keep it on the main thread', () => {
        const enemy = placeAt('fixture_enemy', 400, 400);
        const plain = placeAt('fixture_producer', 800, 640);
        const { container } = render(engine(h(Board)));
        for (const box of boxesOf(container, enemy.id)) expect(box.style.willChange).toBe('contents');
        for (const box of boxesOf(container, plain.id)) expect(box.style.willChange).toBe('');
    });

    it('a Token at rest keeps its art\'s flash and hop on the main thread', () => {
        const token = placeAt('fixture_producer', 400, 400);
        const { container } = render(engine(h(Board)));
        const inner = artInnerOf(container, token.id);
        expect(inner.className).toMatch(/transition-\[filter\]/);
        expect(inner.style.willChange).toBe('contents');
    });

    it('the spawn pop runs on the main thread, and leaves the box as it was', () => {
        const el = document.createElement('div');
        let anim;
        el.animate = vi.fn(() => (anim = { onfinish: null, oncancel: null }));
        playSpawn(el, 10, 20);
        expect(el.style.willChange).toBe('contents');
        anim.onfinish();
        expect(el.style.willChange).toBe('');
    });

    it('a -1 on a Token at rest stays off the compositor; on a worked Token it is left alone', () => {
        const fire = (id) => act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: id, delta: -1, remaining: 3, typeId: 'fixture_producer' });
        });
        const resting = render(h(TokenChargeDeltaFloater, { instanceId: 'tok_rest', atRest: true }));
        fire('tok_rest');
        expect(resting.container.querySelector('.gi-charge-float').style.willChange).toBe('contents');
        const worked = render(h(TokenChargeDeltaFloater, { instanceId: 'tok_work', atRest: false }));
        fire('tok_work');
        expect(worked.container.querySelector('.gi-charge-float').style.willChange).toBe('');
    });
});

describe('⭐ nothing at rest on the mat splits it into layers', () => {
    it('a Token\'s name label is not drawn at all while it is not showing', () => {
        // Its drop shadow is a filter Chrome draws on a layer of its own, transparent or not;
        // every Token drawn after a hidden label then had to be a layer too.
        placeAt('fixture_producer', 400, 400);
        placeAt('fixture_producer_alt', 520, 640);
        const { container } = render(engine(h(Board)));
        const labels = [...container.querySelectorAll('[data-board-origin] [data-token-name]')];
        expect(labels.length).toBe(2);
        for (const label of labels) {
            expect(label.className.split(/\s+/)).toContain('invisible');
            // and it still fades: visibility rides the opacity transition
            expect(label.className).toMatch(/transition-\[opacity,visibility\]/);
        }
    });

    it('nothing on the mat asks for a layer of its own', () => {
        placeAt('fixture_producer', 400, 400);
        placeAt('fixture_enemy', 520, 640);
        const { container } = render(engine(h(Board)));
        const mat = container.querySelector('[data-board-origin]');
        expect(mat.querySelectorAll('[data-token-art]').length).toBe(2);
        for (const el of mat.querySelectorAll('*')) {
            const wc = el.style.willChange;
            if (wc) expect(wc, el.outerHTML.slice(0, 120)).toBe('contents');
        }
    });
});
