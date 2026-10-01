// CR3-203 — there was no error boundary anywhere: a render exception on any
// surface unmounted the WHOLE React app while the engine kept ticking and
// saving underneath it, so the player saw a black screen with no sign their
// game was still alive. The fix is one boundary per surface (owner ruling):
// only the crashed area is replaced by a small "Something went wrong here"
// panel with a Reload button; everything else keeps working.
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ui/components/base/ErrorBoundary.jsx';
import { logger } from '../utils/Logger.js';

const h = React.createElement;

function Boom() {
    throw new Error('kaboom');
}

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('CR3-203: ErrorBoundary', () => {
    it('replaces only the crashed surface with a small fallback panel; siblings keep rendering', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const view = render(
            h('div', null,
                h(ErrorBoundary, { label: 'Crashy' }, h(Boom)),
                h('div', { 'data-testid': 'sibling' }, 'still here')
            )
        );
        const fallback = view.container.querySelector('[data-error-boundary="Crashy"]');
        expect(fallback).not.toBeNull();
        expect(fallback.textContent).toContain('Something went wrong here');
        expect(view.container.querySelector('[data-testid="sibling"]')).not.toBeNull();
    });

    it('logs the error through the logger (always-on, even in production)', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        render(h(ErrorBoundary, { label: 'Crashy' }, h(Boom)));
        expect(errorSpy).toHaveBeenCalled();
        expect(errorSpy.mock.calls[0][0]).toBe('ErrorBoundary');
    });

    it('renders normal children untouched when nothing throws', () => {
        const view = render(
            h(ErrorBoundary, { label: 'Fine' }, h('div', { 'data-testid': 'ok' }, 'all good'))
        );
        expect(view.container.querySelector('[data-testid="ok"]')).not.toBeNull();
        expect(view.container.querySelector('[data-error-boundary]')).toBeNull();
    });

    it('offers a Reload button that reloads the page', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        const reload = vi.fn();
        const original = window.location;
        Object.defineProperty(window, 'location', { value: { ...original, reload }, configurable: true });
        const view = render(h(ErrorBoundary, { label: 'Crashy' }, h(Boom)));
        const btn = view.container.querySelector('button');
        expect(btn).not.toBeNull();
        fireEvent.click(btn);
        expect(reload).toHaveBeenCalledTimes(1);
        Object.defineProperty(window, 'location', { value: original, configurable: true });
    });
});
