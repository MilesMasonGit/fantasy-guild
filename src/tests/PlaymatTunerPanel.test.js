// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { PlaymatTuner } from '../ui/components/PlaymatTuner.jsx';
import { tuning, setTuning, resetTuning, tuningReport } from '../config/playmatTuning.js';

/**
 * The ground's tuner (dev builds): its sliders move the live values, it follows a change made
 * anywhere, and Copy values hands the owner every value as text, falling back to a box to copy
 * from when the browser refuses the clipboard.
 */

const h = React.createElement;
const mount = () => render(h(EngineContext.Provider, { value: { GameState, EventBus } }, h(PlaymatTuner)));
const open = (container) => fireEvent.click(container.querySelector('button[title^="Open the ground"]'));

afterEach(() => {
    cleanup();
    resetTuning();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('the ground tuner', () => {
    it('opens from its GROUND button, and a slider moves the live value', () => {
        const { container } = mount();
        expect(container.textContent).toContain('GROUND');
        open(container);
        const coverage = container.querySelector('input[aria-label="Coverage"]');
        fireEvent.change(coverage, { target: { value: '0.4' } });
        expect(tuning('patchCoverage')).toBe(0.4);
    });

    it('carries the ground look\'s controls: the pixel size, a look\'s Clean colours, the quieting and the rim', () => {
        const { container } = mount();
        open(container);
        fireEvent.change(container.querySelector('input[aria-label="Ground pixel size"]'), { target: { value: '1' } });
        expect(tuning('groundPixel')).toBe(1);
        fireEvent.change(container.querySelector('input[aria-label="Forest hue"]'), { target: { value: '0.05' } });
        expect(tuning('cleanHue_forest')).toBe(0.05);
        fireEvent.change(container.querySelector('input[aria-label="Quiet decorations"]'), { target: { value: '0.25' } });
        expect(tuning('decorQuiet')).toBe(0.25);
        const rim = container.querySelector('input[aria-label="Darker rim"]');
        expect(rim.type).toBe('checkbox');
        fireEvent.click(rim);
        expect(tuning('rimOn')).toBe(0);
    });

    it('follows a value changed elsewhere', () => {
        const { container } = mount();
        open(container);
        act(() => { setTuning('beachWidth', 20); });
        expect(container.querySelector('input[aria-label="Beach width (u)"]').value).toBe('20');
    });

    it('Copy values puts every value on the clipboard', async () => {
        const writeText = vi.fn(() => Promise.resolve());
        vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
        setTuning('wearClump', 30);
        const { container, findByText } = mount();
        open(container);
        await act(async () => { fireEvent.click([...container.querySelectorAll('button')].find(b => b.textContent.includes('Copy values'))); });
        expect(writeText).toHaveBeenCalledWith(tuningReport());
        expect(await findByText(/Copied/)).toBeTruthy();
    });

    it('shows the text to copy by hand when the browser refuses both ways of copying', async () => {
        vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
        document.execCommand = vi.fn(() => false);
        const { container } = mount();
        open(container);
        await act(async () => { fireEvent.click([...container.querySelectorAll('button')].find(b => b.textContent.includes('Copy values'))); });
        expect(container.querySelector('textarea').value).toBe(tuningReport());
        expect(container.textContent).toMatch(/Select the text below/);
    });
});
