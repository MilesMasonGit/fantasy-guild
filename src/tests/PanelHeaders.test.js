// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CloseX, PanelHeader, CLOSE_X_PX } from '../ui/components/base/CloseX.jsx';
import { GIModal } from '../ui/components/base/GIModal.jsx';

// One panel header everywhere (UI_STYLE "Panel headers"): title left, the red pixel X
// (`u_cancel_red.png`, 16 px) at 2× top right.
const h = React.createElement;
const SRC = join(process.cwd(), 'src');
// ⚠️ The Atlas was on its own branch when this landed.
const EXEMPT = [/[\\/]components[\\/]atlas[\\/]/];

function jsxFiles(dir) {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return jsxFiles(path);
        return path.endsWith('.jsx') ? [path] : [];
    });
}

afterEach(cleanup);

describe('the close X', () => {
    it('is the red pixel X at 2×, and calls its handler', () => {
        const onClick = vi.fn();
        const { container } = render(h(CloseX, { onClick }));
        const img = container.querySelector('[data-close-x] img');
        expect(img.getAttribute('src')).toBe('/assets/ui/u_cancel_red.png');
        expect(CLOSE_X_PX).toBe(32);
        expect(img.style.width).toBe('32px');
        fireEvent.click(container.querySelector('[data-close-x]'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('a panel header puts the title first and the X last', () => {
        const { container } = render(h(PanelHeader, { title: 'Shop', onClose: () => {} }, h('span', { 'data-extra': true }, '3 / 10')));
        const header = container.querySelector('[data-panel-header]');
        expect(header.firstElementChild.textContent).toBe('Shop');
        expect(header.lastElementChild.hasAttribute('data-close-x')).toBe(true);
    });

    it('every window wears it', () => {
        render(h(GIModal, { isOpen: true, title: 'Settings', onClose: () => {} }, 'body'));
        expect(document.querySelector('[data-close-x] img').getAttribute('src')).toBe('/assets/ui/u_cancel_red.png');
    });
});

describe('no panel draws a close X of its own', () => {
    it('no UI file closes with a vector X or a hand-drawn copy of the red X', () => {
        const hits = [];
        for (const path of jsxFiles(join(SRC, 'ui'))) {
            if (EXEMPT.some(re => re.test(path))) continue;
            const rel = relative(SRC, path);
            const text = readFileSync(path, 'utf8');
            if (!rel.endsWith('CloseX.jsx') && /u_cancel_red\.png/.test(text) && !/StyleSheetPage/.test(rel)) hits.push(`${rel}: its own red X`);
            if (/<X\s+(?:size|className)/.test(text) && /onClose|setIsOpen\(false\)/.test(text)) {
                // A vector X still drawn next to a close handler: allowed only as a field's clear button.
                const closers = [...text.matchAll(/onClick=\{[^}]*(?:onClose|setIsOpen\(false\))[^}]*\}[^<]*<X\b/g)];
                if (closers.length) hits.push(`${rel}: a vector X closes it`);
            }
        }
        expect(hits).toEqual([]);
    });
});
