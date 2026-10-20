// @vitest-environment jsdom
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import React, { useRef } from 'react';
import { render, cleanup } from '@testing-library/react';
import { useStubGlide, stubScreenSpot } from '../ui/components/notifications/stubGlide.js';

/**
 * The stubs glide to a new place (FLIP on `translate`): a stub whose place changed starts from
 * where it was and is sent to 0; a stub that stayed put, or a list scrolled by hand, is left alone.
 * jsdom lays nothing out, so each stub's top comes from its `data-top`.
 */

const h = React.createElement;
const realRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function () {
    const top = Number(this.dataset?.top || 0);
    return { top, bottom: top + 44, left: 0, right: 100, width: 100, height: 44, x: 0, y: top };
};
afterEach(() => cleanup());

function Column({ order, arriving }) {
    const ref = useRef(null);
    useStubGlide(ref);
    return h('div', { ref, 'data-item-stubs': true },
        order.map((id, i) => h('div', {
            key: id, 'data-item-stub': id, 'data-top': String(i * 48), 'data-stub-arriving': id === arriving ? 'true' : undefined
        })));
}

describe('stub glide', () => {
    it('a stub that moves up when one above leaves glides from its old place; the ones above stay still', () => {
        const view = render(h(Column, { order: ['a', 'b', 'c'] }));
        view.rerender(h(Column, { order: ['a', 'c'] }));
        const a = view.container.querySelector('[data-item-stub="a"]');
        const c = view.container.querySelector('[data-item-stub="c"]');
        expect(c.dataset.stubGliding).toBe('true');
        expect(c.style.translate).toBe('0 0');
        expect(a.dataset.stubGliding).toBeUndefined();
        expect(a.style.translate).toBe('');
    });

    it('a stub made again (arriving) slides in from the edge rather than gliding from its old place', () => {
        const view = render(h(Column, { order: ['a', 'b', 'c'] }));
        view.rerender(h(Column, { order: ['b', 'c', 'a'], arriving: 'a' }));
        expect(view.container.querySelector('[data-item-stub="a"]').dataset.stubGliding).toBeUndefined();
    });

    it('nothing is touched when nothing moved', () => {
        const view = render(h(Column, { order: ['a', 'b'] }));
        view.rerender(h(Column, { order: ['a', 'b'] }));
        expect(view.container.querySelector('[data-stub-gliding]')).toBeNull();
    });

    it('finds a stub on screen for anything flying to it', () => {
        render(h(Column, { order: ['a', 'b'] }));
        expect(stubScreenSpot('b')).toMatchObject({ inView: true, rect: { top: 48 } });
        expect(stubScreenSpot('zzz')).toBeNull();
    });
});

afterAll(() => { Element.prototype.getBoundingClientRect = realRect; });
