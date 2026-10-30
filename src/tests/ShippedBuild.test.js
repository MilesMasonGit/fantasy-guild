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
 * ⭐ The mat's size and the bounty numbers are game values, not Mat Tuner numbers, and a shipped
 * build has no Debug Mode and no QA tools (GDD §16: owner ruling 2026-10-06). The dev and perf
 * builds keep the tuner, which there starts at the game values.
 */

const TUNING_KEY = 'fantasy_guild_mat_tuning';
const TUNED = { matSteps: 6, matAspect: 0.5, questCap: 9, questCapMax: 9, questEverySec: 30, nearRadius: 500 };

/** The tuning, geometry and quest modules as a build of `mode` loads them, with `TUNED` stored. */
async function loadAs(mode) {
    vi.resetModules();
    vi.stubEnv('DEV', mode === 'development');
    vi.stubEnv('PROD', mode !== 'development');
    vi.stubEnv('MODE', mode);
    localStorage.setItem(TUNING_KEY, JSON.stringify(TUNED));
    const tuning = await import('../config/matTuning.js');
    const geometry = await import('../config/matGeometry.js');
    const quests = await import('../systems/quests/QuestTokens.js');
    return { tuning, geometry, quests };
}

afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('the game values', () => {
    it('are today’s shipped numbers, and the Mat Tuner starts at them', async () => {
        const { tuning, geometry, quests } = await loadAs('development');
        expect(geometry.MAT_STEPS).toBe(12);
        expect(geometry.MAT_ASPECT).toBe(13 / 24);
        expect(quests.QUEST_CAP_BASE).toBe(2);
        expect(quests.QUEST_CAP_MAX).toBe(5);
        expect(quests.QUEST_EVERY_SEC).toBe(180);
        expect(tuning.matTuningDefault('matSteps')).toBe(geometry.MAT_STEPS);
        expect(tuning.matTuningDefault('matAspect')).toBe(geometry.MAT_ASPECT);
        expect(tuning.matTuningDefault('questCap')).toBe(quests.QUEST_CAP_BASE);
        expect(tuning.matTuningDefault('questCapMax')).toBe(quests.QUEST_CAP_MAX);
        expect(tuning.matTuningDefault('questEverySec')).toBe(quests.QUEST_EVERY_SEC);
    });
});

describe('a shipped build uses the game values whatever the tuner once stored', () => {
    it('the mat is MAT_STEPS, the bounties the quest game values, every other tuner number its default', async () => {
        const { tuning, geometry, quests } = await loadAs('production');
        expect(geometry.matSteps()).toBe(12);
        expect(geometry.matW()).toBe(1920);
        expect(geometry.matH()).toBe(1040);
        expect(quests.questCap()).toBe(2);
        expect(quests.questIntervalMs()).toBe(180_000);
        expect(tuning.matTuning('nearRadius')).toBe(tuning.matTuningDefault('nearRadius'));
        expect(tuning.setMatTuning('matSteps', 8)).toBe(false);
        expect(geometry.matSteps()).toBe(12);
    });

    it('a dev build still takes the tuner’s numbers', async () => {
        const { tuning, geometry, quests } = await loadAs('development');
        expect(geometry.matSteps()).toBe(6);
        expect(geometry.matH()).toBe(480);
        expect(quests.questCap()).toBe(9);
        expect(quests.questIntervalMs()).toBe(30_000);
        expect(tuning.matTuning('nearRadius')).toBe(500);
    });

    it('so does a perf build (the measuring build, never shipped)', async () => {
        const { geometry } = await loadAs('perf');
        expect(geometry.matSteps()).toBe(6);
    });
});

describe('Settings has no Dev Tools tab in a shipped build', () => {
    const tabLabels = () => Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());

    beforeEach(() => {
        vi.stubGlobal('__APP_VERSION__', '0.0.0-test');
        SettingsManager.resetOptions();
    });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

    it('shipped: no Debug Mode anywhere', () => {
        vi.stubEnv('DEV', false);
        vi.stubEnv('MODE', 'production');
        render(React.createElement(SettingsModal, { isOpen: true, onClose: () => {} }));
        expect(tabLabels().some(t => t.includes('Dev Tools'))).toBe(false);
        expect(document.body.textContent).not.toContain('Debug Mode');
    });

    it('dev: the Dev Tools tab and its Debug Mode switch', () => {
        render(React.createElement(SettingsModal, { isOpen: true, onClose: () => {} }));
        const dev = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dev Tools'));
        expect(dev).toBeTruthy();
        fireEvent.click(dev);
        expect(document.body.textContent).toContain('Debug Mode');
    });
});
