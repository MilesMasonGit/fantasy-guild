// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { StationGearBadge } from '../ui/components/board/TokenBadges.jsx';

const TAILWIND = readFileSync(resolve(__dirname, '../tailwind.css'), 'utf8');
const h = React.createElement;
afterEach(cleanup);

/** The body of `@keyframes name { ... }`, and each keyframe block inside it. */
function keyframes(name) {
    const start = TAILWIND.indexOf(`@keyframes ${name}`);
    if (start < 0) return null;
    let depth = 0;
    let i = TAILWIND.indexOf('{', start);
    const open = i;
    for (; i < TAILWIND.length; i++) {
        if (TAILWIND[i] === '{') depth++;
        else if (TAILWIND[i] === '}' && --depth === 0) break;
    }
    const body = TAILWIND.slice(open + 1, i);
    const frames = [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ at: m[1].trim(), css: m[2] }));
    return { body, frames };
}

function ruleBody(selector) {
    const re = /([^{}]+){([^{}]*)}/g;
    let m;
    while ((m = re.exec(TAILWIND))) {
        if (m[1].trim() === selector) return m[2];
    }
    return '';
}

const mount = (props) => render(h(StationGearBadge, { isDragging: false, recipe: null, onClick: () => {}, ...props })).container;

describe('T-153: the gear alert is a stepped gold outline, never a movement', () => {
    it('the keyframes touch only the outline colour, in two different golds', () => {
        const kf = keyframes('gi-gear-alert');
        expect(kf, 'gi-gear-alert keyframes exist').toBeTruthy();
        expect(kf.body).not.toMatch(/transform|scale|translate|filter|drop-shadow|brightness|box-shadow|opacity|width|height|top|left|margin|padding/);
        const colours = kf.frames.map(f => f.css.match(/background-color:\s*([^;]+)/)?.[1].trim());
        expect(colours.every(Boolean)).toBe(true);
        expect(new Set(colours).size).toBe(2);
        expect(colours.some(c => /gi-gold\b(?!-)|#fbbf24/i.test(c))).toBe(true);
    });

    it('the colour steps, it does not fade', () => {
        const rule = ruleBody('.gi-gear-alert');
        expect(rule).toMatch(/animation:[^;]*gi-gear-alert/);
        expect(rule).toMatch(/steps\(\s*1/);
        expect(rule).not.toMatch(/ease|linear/);
    });

    it('the old pulse is gone', () => {
        expect(TAILWIND).not.toMatch(/@keyframes gi-gear-pulse/);
        expect(ruleBody('.gi-gear-pulse')).toBe('');
    });

    it('an unset gear draws four outline layers; a set gear draws none', () => {
        const unset = mount({ pulsing: true });
        expect(unset.querySelectorAll('[data-gear-outline]').length).toBe(4);
        cleanup();
        const set = mount({ pulsing: false, recipe: { id: 'r', name: 'R' } });
        expect(set.querySelectorAll('[data-gear-outline]').length).toBe(0);
    });

    it('the outline layers sit one art pixel (0.75px at 24px for a 32px sprite) out from the 2px inset, each in one direction', () => {
        const layers = [...mount({ pulsing: true }).querySelectorAll('[data-gear-outline]')];
        const offsets = layers.map(l => [l.style.left, l.style.top].join(' ')).sort();
        expect(offsets).toEqual(['1.25px 2px', '2.75px 2px', '2px 1.25px', '2px 2.75px'].sort());
        for (const l of layers) {
            expect(l.className).toContain('gi-gear-alert');
            expect(l.style.imageRendering).toBe('pixelated');
            expect(l.style.maskImage || l.style.webkitMaskImage).toContain('/assets/ui/ui_gear.png');
        }
    });

    it('the box never changes: no transform, filter or scale on the button, its layers or the image', () => {
        const root = mount({ pulsing: true });
        const button = root.querySelector('button');
        const nodes = [button, ...button.querySelectorAll('*')];
        for (const n of nodes) {
            expect(n.style.transform, n.tagName).toBe('');
            expect(n.style.filter, n.tagName).toBe('');
            expect(n.className).not.toMatch(/(^|\s)(hover:|active:)?scale-/);
            expect(n.className).not.toMatch(/gi-gear-pulse/);
        }
        expect(button.className).toContain('w-7');
        expect(button.className).toContain('h-7');
        // the outline layers are the same box as the art, not a bigger one
        const img = button.querySelector('img');
        for (const l of button.querySelectorAll('[data-gear-outline]')) {
            expect(l.style.width).toBe('');
            expect(l.className).toContain('w-6');
            expect(l.className).toContain('h-6');
            expect(img.className).toContain('w-6');
        }
    });

    it('the alert gear does not scale on hover, and a set gear carries no alert class', () => {
        const set = mount({ pulsing: false, recipe: { id: 'r', name: 'R' } }).querySelector('button');
        cleanup();
        const unset = mount({ pulsing: true }).querySelector('button');
        expect(unset.className).not.toMatch(/scale/);
        expect(set.className).not.toMatch(/gi-gear/);
    });
});
