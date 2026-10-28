import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { getRecipe } from '../../../config/registries/recipePoolRegistry.js';
import { formatDuration } from '../drawer/lifecycleLines.js';
import { spawnerCountText, turnCountdownText } from './centreAlert.js';
import { CELL } from './workPlate.js';
import { ringCount } from './ringRow.js';

/**
 * The idle plate: a Token nobody works, once the pointer rests on it, gets the work plate's look
 * under itself with whatever applies to it: what it waits for, its charges, a spawner's count, a
 * quest's progress and the time to its next change (refill, growth, ripening, turn). With nothing
 * to say there is no plate. No React here: `IdlePlate` (WorkPlateLayer.jsx) draws it.
 * An enemy never gets one: hovered, it shows its name and HP only.
 */

/** What each cell's hover says. */
export const IDLE_TIPS = Object.freeze({
    charges: (n) => `Charges: ${Number(n).toLocaleString()} left`,
    quest: (text) => `Quest progress: ${text}`,
    spawner: (text) => `Spawned: ${text}. It stops at the limit`
});

/** Each timer's glyph (`PixelGlyph`'s): a refill, a growth or ripening, a turn. */
const TIMER_GLYPH = Object.freeze({ respawn: 'regrow', grow: 'grow', ripen: 'grow', turn: 'turn' });

/**
 * The timer cell from one read of the Token's clock (`MatToken`'s `readTimer`: `{ kind: 'respawn'
 * | 'grow' | 'ripen' | 'turn', inMs, ... }`), or null with nothing counting.
 * @returns {{kind: 'timer', glyph: string, text: string, tip: string}|null}
 */
export function timerCellOf(roll) {
    const text = roll ? turnCountdownText(roll.inMs) : null;
    if (!text) return null;
    let tip;
    if (roll.kind === 'respawn') {
        // Non-breaking, so the tip never wraps between the number and its unit.
        tip = roll.paused
            ? `Resting. Refills only with ${(roll.needsNearby || []).map(id => tokenName(id) || id).join(' or ')} nearby`
            : `Resting. Refills in ${formatDuration(roll.inMs).replace(/ /g, ' ')}`;
    } else if (roll.kind === 'grow') {
        tip = `Grows into ${tokenName(roll.into) || 'something new'} in ${text}`;
    } else if (roll.kind === 'ripen') {
        tip = `${getRecipe(roll.cropId)?.name || 'Its crop'} ripe in ${text}`;
    } else {
        const chance = `${roll.chance}% chance`;
        tip = roll.back
            ? `Next roll to turn back in ${text} (${chance})`
            : `Next roll to turn into something else in ${text} (${chance})`;
    }
    return { kind: CELL.TIMER, glyph: TIMER_GLYPH[roll.kind] || 'clock', text, tip };
}

/**
 * The idle plate's cells, in the work plate's order: the problem, the charges, then a spawner's
 * count, a quest's progress and the timer.
 * A choice waiting (nothing chosen on a station or Foundation) is left out: hovered, its mark is
 * already the gear that makes the choice.
 * @param {{
 *   problem?: {kind: string, severity: string}|null,
 *   charges?: number|null,
 *   spawner?: {count: number, cap: number}|null,
 *   quest?: {currentCount: number, requiredCount: number, itemId?: string}|null,
 *   timer?: ReturnType<typeof timerCellOf>
 * }} what
 * @returns {object[]} cells, each with its `tip` (a string, or for the problem nothing: the
 *   plate reads it from the engine when the pointer arrives)
 */
export function idlePlateCells({ problem = null, charges = null, spawner = null, quest = null, timer = null } = {}) {
    const cells = [];
    if (problem) cells.push({ kind: CELL.PROBLEM, severity: problem.severity });
    if (charges != null) cells.push({ kind: CELL.CHARGES, count: charges, tip: IDLE_TIPS.charges(charges) });
    const spawned = spawnerCountText(spawner);
    if (spawned) cells.push({ kind: CELL.SPAWNER, text: spawned, tip: IDLE_TIPS.spawner(spawned) });
    if (quest) {
        const required = Math.max(1, Number(quest.requiredCount) || 1);
        const current = Math.max(0, Math.min(required, Number(quest.currentCount) || 0));
        const text = `${ringCount(current)}/${ringCount(required)}`;
        cells.push({ kind: CELL.QUEST, itemId: quest.itemId || null, text, tip: IDLE_TIPS.quest(text) });
    }
    if (timer) cells.push(timer);
    return cells;
}
