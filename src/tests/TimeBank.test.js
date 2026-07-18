import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { TimeBankManager } from '../systems/core/TimeBankManager.js';
import { TimeManager } from '../systems/core/TimeManager.js';
import { TIME_BANK } from '../config/loopConstants.js';

// CR-053: the Time Bank is the fallback offline system (owner decision),
// so its accrual/drain accounting gets a regression net.

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(),
    error: vi.fn(), getQueue: vi.fn(() => [])
}));

describe('TimeBankManager (CR-053)', () => {
    beforeEach(() => {
        GameState.initNew();
        TimeBankManager.isSpending = false;
        TimeBankManager.activeMultiplier = 1;
        TimeManager.setTimeScale(1);
    });

    it('accrues offline time from a save timestamp', () => {
        TimeBankManager.accrueOffline(Date.now() - 60000);
        expect(TimeBankManager.getBankedMs()).toBeGreaterThanOrEqual(59000);
    });

    it('caps the bank at MAX_MS and discards the excess', () => {
        TimeBankManager.accrueOffline(Date.now() - (TIME_BANK.MAX_MS * 2));
        expect(TimeBankManager.getBankedMs()).toBe(TIME_BANK.MAX_MS);
    });

    it('ignores a missing or future savedAt', () => {
        TimeBankManager.accrueOffline(undefined);
        TimeBankManager.accrueOffline(Date.now() + 60000);
        expect(TimeBankManager.getBankedMs()).toBe(0);
    });

    it('refuses to spend an empty bank', () => {
        const r = TimeBankManager.startSpending(10);
        expect(r.success).toBe(false);
        expect(TimeManager.getTimeScale()).toBe(1);
    });

    it('rejects a multiplier outside the presets', () => {
        GameState.state.time.timeBankMs = 60000;
        expect(TimeBankManager.startSpending(7).success).toBe(false);
    });

    it('sets the engine time-scale while spending', () => {
        GameState.state.time.timeBankMs = 600000;
        expect(TimeBankManager.startSpending(10).success).toBe(true);
        expect(TimeManager.getTimeScale()).toBe(10);
        expect(TimeBankManager.isSpending).toBe(true);
    });

    it('drains by the scaled game-time delta', () => {
        GameState.state.time.timeBankMs = 600000;
        TimeBankManager.startSpending(10);
        TimeBankManager.tick(1000);   // 1000ms of game time advanced
        expect(TimeBankManager.getBankedMs()).toBe(599000);
    });

    it('stops and restores 1x when the bank empties', () => {
        GameState.state.time.timeBankMs = 500;
        TimeBankManager.startSpending(2);
        TimeBankManager.tick(1000);
        expect(TimeBankManager.getBankedMs()).toBe(0);
        expect(TimeBankManager.isSpending).toBe(false);
        expect(TimeManager.getTimeScale()).toBe(1);
    });

    it('does not drain while not spending', () => {
        GameState.state.time.timeBankMs = 60000;
        TimeBankManager.tick(5000);
        expect(TimeBankManager.getBankedMs()).toBe(60000);
    });

    it('stopSpending returns the engine to real time', () => {
        GameState.state.time.timeBankMs = 600000;
        TimeBankManager.startSpending(5);
        TimeBankManager.stopSpending();
        expect(TimeManager.getTimeScale()).toBe(1);
        expect(TimeBankManager.activeMultiplier).toBe(1);
    });
});
