import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { TokenChargeDeltaFloater } from '../ui/components/board/TokenBadges.jsx';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';

/**
 * ⭐ **A charge floater (-1, +50) is a CSS animation**.
 */

const CSS = fs.readFileSync(path.resolve(__dirname, '../tailwind.css'), 'utf8');
const h = React.createElement;

afterEach(() => { cleanup(); vi.useRealTimers(); });

const charge = (delta) => act(() => {
    EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_f', delta, remaining: 9, typeId: 'token_oak_tree' });
});

describe('⭐ the floater animates in CSS', () => {
    it('each number carries the CSS animation and no script-driven style', () => {
        const { container } = render(h(TokenChargeDeltaFloater, { instanceId: 'tok_f', anchor: 'ring' }));
        charge(-1);
        const item = [...container.querySelectorAll('[data-charge-floater] > *')].find(el => el.textContent === '-1');
        expect(item).toBeTruthy();
        expect(item.className).toContain('gi-charge-float');
        expect(item.style.opacity).toBe('');
        expect(item.style.transform).toBe('');
    });

    it('the keyframes match the old curve, and touch only opacity and transform', () => {
        const kf = /@keyframes gi-charge-float \{([\s\S]*?)\n\}/.exec(CSS);
        expect(kf).not.toBeNull();
        const body = kf[1];
        for (const stop of ['0%', '8%', '82%', '100%']) expect(body).toContain(stop);
        const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map(m => m[1]);
        expect(new Set(props)).toEqual(new Set(['opacity', 'transform']));
        expect(CSS).toMatch(/\.gi-charge-float \{\s*animation: gi-charge-float 3s ease-out both;/);
    });

    it('is gone after its 3 seconds', () => {
        vi.useFakeTimers();
        const { container } = render(h(TokenChargeDeltaFloater, { instanceId: 'tok_f' }));
        charge(50);
        expect(container.textContent).toContain('+50');
        act(() => { vi.advanceTimersByTime(3001); });
        expect(container.textContent).not.toContain('+50');
    });
});
