// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../ui/modals/SettingsModal.jsx';
import { SettingsManager } from '../systems/core/SettingsManager.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ The mat's size is a game value, not Mat Tuner numbers, and a shipped
 * build (`vite build --mode ship`) has no Debug Mode and no QA tools (GDD §16: owner ruling
 * 2026-10-06). The dev and perf builds keep the tuning, which there starts at the game values; a
 * test build (a plain `vite build`) uses the game values, as a ship build does.
 */

const TUNING_KEY = 'tabletop_guild_mat_tuning';
const TUNED = { matSteps: 6, matAspect: 0.5, reach: 500 };

/** The tuning, geometry and reach modules as a build of `mode` loads them, with `TUNED` stored. */
async function loadAs(mode) {
    vi.resetModules();
    vi.stubEnv('DEV', mode === 'development');
    vi.stubEnv('PROD', mode !== 'development');
    vi.stubEnv('MODE', mode);
    localStorage.setItem(TUNING_KEY, JSON.stringify(TUNED));
    const tuning = await import('../config/matTuning.js');
    const geometry = await import('../config/matGeometry.js');
    const reach = await import('../config/registries/reachRegistry.js');
    const nearby = await import('../systems/board/nearby.js');
    return { tuning, geometry, reach, nearby };
}

afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('the game values', () => {
    it('are today’s shipped numbers, and the Mat Tuner starts at them', async () => {
        const { tuning, geometry, reach } = await loadAs('development');
        expect(geometry.MAT_STEPS).toBe(12);
        expect(reach.STANDARD_REACH_U).toBe(240);
        expect(tuning.matTuningDefault('reach')).toBe(reach.STANDARD_REACH_U);
        expect(geometry.MAT_ASPECT).toBe(13 / 24);
        expect(tuning.matTuningDefault('matSteps')).toBe(geometry.MAT_STEPS);
        expect(tuning.matTuningDefault('matAspect')).toBe(geometry.MAT_ASPECT);
    });
});

describe('a shipped build uses the game values whatever the tuner once stored', () => {
    it('the mat is MAT_STEPS, every other tuner number its default', async () => {
        const { tuning, geometry, reach, nearby } = await loadAs('ship');
        expect(geometry.matSteps()).toBe(12);
        expect(geometry.matW()).toBe(1920);
        expect(geometry.matH()).toBe(1040);
        expect(tuning.matTuning('reach')).toBe(tuning.matTuningDefault('reach'));
        expect(nearby.reachRadius()).toBe(reach.STANDARD_REACH_U);
        expect(tuning.setMatTuning('matSteps', 8)).toBe(false);
        expect(geometry.matSteps()).toBe(12);
    });

    it('a dev build still takes the tuner’s numbers', async () => {
        const { tuning, geometry, nearby } = await loadAs('development');
        expect(geometry.matSteps()).toBe(6);
        expect(geometry.matH()).toBe(480);
        expect(tuning.matTuning('reach')).toBe(500);
        expect(nearby.reachRadius()).toBe(500);
    });

    it('so does a perf build (the measuring build, never shipped)', async () => {
        const { geometry } = await loadAs('perf');
        expect(geometry.matSteps()).toBe(6);
    });

    it('a test build (a plain vite build, the owner’s desktop builds) uses the game values too', async () => {
        const { tuning, geometry } = await loadAs('production');
        expect(geometry.matSteps()).toBe(12);
        expect(tuning.setMatTuning('matSteps', 8)).toBe(false);
        expect(geometry.matSteps()).toBe(12);
    });
});

describe('Settings has no Dev Tools tab in a shipped build', () => {
    const tabLabels = () => Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());

    beforeEach(() => {
        vi.stubGlobal('__APP_VERSION__', '0.0.0-test');
        SettingsManager.resetOptions();
    });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

    // Debug Mode only matters in a perf build, so a test build has no switch either.
    it.each(['ship', 'production'])('%s: no Debug Mode anywhere', (mode) => {
        vi.stubEnv('DEV', false);
        vi.stubEnv('MODE', mode);
        render(React.createElement(SettingsModal, { isOpen: true, onClose: () => {} }));
        expect(tabLabels().some(t => t.includes('Dev tools'))).toBe(false);
        expect(document.body.textContent).not.toContain('Debug mode');
    });

    it('dev: the Dev Tools tab and its Debug Mode switch', () => {
        render(React.createElement(SettingsModal, { isOpen: true, onClose: () => {} }));
        const dev = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dev tools'));
        expect(dev).toBeTruthy();
        fireEvent.click(dev);
        expect(document.body.textContent).toContain('Debug mode');
    });
});
