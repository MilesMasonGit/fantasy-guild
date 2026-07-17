// Fantasy Guild - Time Bank Manager (Deck Loop rework, Phase 8)
//
// Replaces the deferred offline-progress SIMULATOR. Instead of math-modelling
// the world while the game is closed, time spent away is banked (capped) and
// later "played out" by accelerating the LIVE engine via TimeManager's
// time-scale. Because it's the real engine running faster, combat, crafting,
// RNG and every other system just work — there is no parallel simulation to
// keep in sync.
//
// See loopConstants.TIME_BANK for the cap, presets, and the drain/accounting
// model. Registered on the game loop by EngineBootstrap.

import { GameState } from '../../state/GameState.js';
import { EventBus } from './EventBus.js';
import { TimeManager } from './TimeManager.js';
import * as NotificationSystem from './NotificationSystem.js';
import { TIME_BANK } from '../../config/loopConstants.js';
import { logger } from '../../utils/Logger.js';

/** How often (in drain ticks) to push a UI refresh while fast-forwarding. */
const UI_REFRESH_EVERY_TICKS = 10;

export const TimeBankManager = {
    initialized: false,
    /** True while the bank is actively being spent (engine accelerated). */
    isSpending: false,
    /** Current fast-forward multiplier (1 when not spending). */
    activeMultiplier: 1,
    _uiThrottle: 0,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Closed-only accrual: when a save loads, bank the time since it was
        // written (SaveManager stamps `savedAt` on the save and forwards it on
        // the game_loaded event). A brand-new game emits no meaningful gap.
        EventBus.subscribe('game_loaded', ({ savedAt }) => this.accrueOffline(savedAt));

        logger.info('TimeBankManager', 'Time bank initialized');
    },

    // ------------------------------------------------------------------
    // Bank storage (persisted on state.time.timeBankMs)
    // ------------------------------------------------------------------

    /** Read the bank, defensively defaulting for pre-Phase-8 saves. */
    getBankedMs() {
        const time = GameState.state?.time;
        if (!time) return 0;
        if (typeof time.timeBankMs !== 'number' || isNaN(time.timeBankMs)) {
            time.timeBankMs = 0;
        }
        return time.timeBankMs;
    },

    /** Write the bank, clamped to [0, MAX_MS]. */
    _setBank(ms) {
        const time = GameState.state?.time;
        if (!time) return;
        time.timeBankMs = Math.max(0, Math.min(TIME_BANK.MAX_MS, ms));
    },

    // ------------------------------------------------------------------
    // Accrual
    // ------------------------------------------------------------------

    /**
     * Add offline time (now − savedAt) to the bank, capped. Anything past the
     * 24h cap is discarded, matching the standard idle-game "come back within
     * a day" contract.
     * @param {number} savedAt - epoch ms the loaded save was written
     */
    accrueOffline(savedAt) {
        if (!savedAt || typeof savedAt !== 'number') return;
        const elapsed = Date.now() - savedAt;
        if (elapsed <= 0) return;

        const before = this.getBankedMs();
        this._setBank(before + elapsed);
        const gained = this.getBankedMs() - before;

        if (gained > 0) {
            logger.info('TimeBankManager',
                `Banked ${Math.round(gained / 1000)}s offline (bank now ${Math.round(this.getBankedMs() / 1000)}s)`);
        }
        this._publish();
    },

    // ------------------------------------------------------------------
    // Spending (fast-forward)
    // ------------------------------------------------------------------

    /**
     * Begin fast-forwarding at a preset multiplier. The live engine simply
     * runs faster; _tick() drains the bank as game-time advances.
     * @param {number} multiplier - one of TIME_BANK.PRESETS
     */
    startSpending(multiplier) {
        if (!TIME_BANK.PRESETS.includes(multiplier)) {
            return { success: false, error: `Invalid speed ${multiplier}x` };
        }
        if (this.getBankedMs() <= 0) {
            NotificationSystem.notify('Time bank is empty.', 'info');
            return { success: false, error: 'Time bank empty' };
        }

        this.isSpending = true;
        this.activeMultiplier = multiplier;
        this._uiThrottle = 0;
        TimeManager.setTimeScale(multiplier);
        logger.info('TimeBankManager', `Fast-forward started at ${multiplier}x`);
        this._publish();
        return { success: true };
    },

    /** Stop fast-forwarding and return the engine to real time (1x). */
    stopSpending() {
        if (!this.isSpending) return { success: true };
        this.isSpending = false;
        this.activeMultiplier = 1;
        TimeManager.setTimeScale(1);
        logger.info('TimeBankManager', 'Fast-forward stopped');
        this._publish();
        return { success: true };
    },

    /**
     * Drain tick. `delta` is already the
     * time-scaled game-time for this tick (realDelta × multiplier), so the
     * bank drains by exactly the game-time the world advanced (the model in
     * loopConstants.TIME_BANK). Empties → snap back to 1x.
     */
    tick(delta) {
        if (!this.isSpending) return;
        if (!delta || isNaN(delta)) return;

        const remaining = this.getBankedMs() - delta;
        if (remaining <= 0) {
            this._setBank(0);
            this.stopSpending();
            NotificationSystem.notify('Time bank spent — back to normal speed.', 'info');
            return;
        }

        this._setBank(remaining);

        // Throttle UI refreshes — the bar doesn't need per-tick precision.
        if (++this._uiThrottle >= UI_REFRESH_EVERY_TICKS) {
            this._uiThrottle = 0;
            this._publish();
        }
    },

    _publish() {
        EventBus.publish('time_bank_updated', {
            bankedMs: this.getBankedMs(),
            isSpending: this.isSpending,
            multiplier: this.activeMultiplier
        });
    }
};

export default TimeBankManager;
