// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { GIModal } from '../ui/components/base/GIModal.jsx';
import { pushEscapeLayer, escapeLayerCount, useEscapeLayer } from '../ui/utils/escapeLayers.js';

/**
 * Owner ruling (T-029): Escape closes the top layer only; a click outside closes light pop-ups
 * only; windows and drawers never close on a stray click.
 */

const h = React.createElement;
const escape = (at = document) => act(() => { fireEvent.keyDown(at, { key: 'Escape', code: 'Escape' }); });

afterEach(() => {
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

describe('one Escape, one layer', () => {
    it('closes the layer opened last, and only that one', () => {
        const below = vi.fn();
        const above = vi.fn();
        const offBelow = pushEscapeLayer(below);
        const offAbove = pushEscapeLayer(above);
        escape();
        expect(above).toHaveBeenCalledTimes(1);
        expect(below).not.toHaveBeenCalled();
        offAbove();
        escape();
        expect(below).toHaveBeenCalledTimes(1);
        offBelow();
        expect(escapeLayerCount()).toBe(0);
    });

    it('keeps the Escape from reaching listeners underneath', () => {
        const underneath = vi.fn();
        document.addEventListener('keydown', underneath);
        const off = pushEscapeLayer(() => {});
        escape();
        expect(underneath).not.toHaveBeenCalled();
        off();
        escape();
        expect(underneath).toHaveBeenCalledTimes(1);
        document.removeEventListener('keydown', underneath);
    });

    it('lets a live drag have its Escape: no layer closes', () => {
        const layer = vi.fn();
        const off = pushEscapeLayer(layer);
        document.body.classList.add('gi-dnd-active');
        escape();
        expect(layer).not.toHaveBeenCalled();
        off();
    });

    it('a window over an open panel: the first Escape closes the window, the second the panel', () => {
        const closePanel = vi.fn();
        const closeWindow = vi.fn();
        const Panel = ({ open }) => { useEscapeLayer(open, closePanel); return null; };
        const r = render(h(Panel, { open: true }));
        r.rerender(h(React.Fragment, null,
            h(Panel, { open: true }),
            h(GIModal, { isOpen: true, title: 'Edit', onClose: closeWindow }, 'body')));
        escape();
        expect(closeWindow).toHaveBeenCalledTimes(1);
        expect(closePanel).not.toHaveBeenCalled();
        r.rerender(h(Panel, { open: true }));
        escape();
        expect(closePanel).toHaveBeenCalledTimes(1);
    });

    it('a window with no X takes the Escape and closes nothing under it', () => {
        const closePanel = vi.fn();
        const off = pushEscapeLayer(closePanel);
        render(h(GIModal, { isOpen: true, title: 'Choose a Save', hideClose: true }, 'body'));
        escape();
        expect(closePanel).not.toHaveBeenCalled();
        off();
    });
});

describe('a window never closes on a click outside it', () => {
    it('a click on the backdrop leaves the window open', async () => {
        const onClose = vi.fn();
        render(h(GIModal, { isOpen: true, title: 'Settings', onClose }, h('p', null, 'body')));
        await act(async () => { await new Promise(r => setTimeout(r, 0)); });
        const backdrop = document.querySelector('.bg-black\\/80');
        expect(backdrop).not.toBeNull();
        await act(async () => {
            for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
                backdrop.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
            }
            await new Promise(r => setTimeout(r, 0));
        });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('its X and Escape still close it', () => {
        const onClose = vi.fn();
        render(h(GIModal, { isOpen: true, title: 'Settings', onClose }, 'body'));
        escape();
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
