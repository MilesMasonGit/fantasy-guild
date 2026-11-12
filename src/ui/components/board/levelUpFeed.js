import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * Every level-up the player should be shown, live or from time away, for the UI pieces that
 * show them (the hero bar's alerts, the number floating over the hero).
 * `onLevelUps(rows, { catchUp })` gets `{ heroId, skillId, skillName, oldLevel, newLevel }` rows;
 * `onReset()` is another save's heroes arriving, so what is up should go.
 * A catch-up plays with the bus quiet, so its level-ups never arrive as `HERO_LEVELED`: they are
 * read off its summary and handed on at the `GAME_RESET` that follows it. ⚠️ On that reset, not
 * on `CATCH_UP_FINISHED`: a load's catch-up finishes before the load's own reset, which would wipe
 * them. Taken once, so a later reset cannot add them again. A dev time-skip or a sleeping PC's
 * catch-up is the same game moved on, so it does not reset.
 *
 * @returns unsubscribe
 */
export function subscribeLevelUps({ onLevelUps, onReset }) {
    let pending = null;
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.HERO_LEVELED, ({ heroId, skillId, skillName, newLevel, oldLevel } = {}) => {
            if (!heroId || !skillName || !Number.isFinite(newLevel)) return;
            onLevelUps([{ heroId, skillId, skillName, oldLevel, newLevel }], { catchUp: null });
        }, UI_LISTENER),
        EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_FINISHED, ({ summary, show } = {}) => {
            const rows = (summary?.levelUps || []).filter(r => r.heroId && r.skillName && Number.isFinite(r.to));
            pending = rows.length ? { rows, show: !!show } : null;
        }, UI_LISTENER),
        EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, ({ reason } = {}) => {
            if (reason !== 'dev_time_skip' && reason !== 'catch_up') onReset?.();
            if (!pending) return;
            const { rows, show } = pending;
            pending = null;
            onLevelUps(
                rows.map(r => ({ heroId: r.heroId, skillId: r.skillId, skillName: r.skillName, oldLevel: r.from, newLevel: r.to })),
                { catchUp: { show } }
            );
        }, UI_LISTENER)
    ];
    return () => offs.forEach(off => off());
}
