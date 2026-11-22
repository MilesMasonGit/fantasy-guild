import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { getRecipe } from '../../../config/registries/recipePoolRegistry.js';
import { turnCountdownText } from './centreAlert.js';
import { CELL } from './workPlate.js';
import { t } from '../../../i18n/index.js';

/**
 * The idle plate: a Token nobody works, once the pointer rests on it, gets the work plate's look
 * under itself only when it is stuck or counting: its problem and the time to its next change
 * (refill, growth, ripening, turn, leaving). Charges, a spawner's count and a quest's progress
 * are not its business (the plate is for work; those stay on the card). With neither a problem
 * nor a timer there is no plate, and the hover is the name alone. No React here: `IdlePlate`
 * (IdlePlate.jsx) draws it. An enemy never gets one: hovered, it shows its name and HP only.
 */

/** Each timer's glyph (`PixelGlyph`'s): a refill, a growth or ripening, a turn. */
const TIMER_GLYPH = Object.freeze({ respawn: 'regrow', grow: 'grow', ripen: 'grow', turn: 'turn', leave: 'clock' });

/**
 * The timer cell from one read of the Token's clock (`MatToken`'s `readTimer`: `{ kind: 'respawn'
 * | 'grow' | 'ripen' | 'turn' | 'leave', inMs, ... }`), or null with nothing counting. `leave` is an
 * event Token's time until it goes (`EventTokens.leavesInMs`).
 * @returns {{kind: 'timer', glyph: string, text: string, tip: string}|null}
 */
export function timerCellOf(roll) {
    const text = roll ? turnCountdownText(roll.inMs) : null;
    if (!text) return null;
    let tip;
    if (roll.kind === 'leave') {
        tip = t(roll.buff ? 'events.plate.buffLeaves' : 'events.plate.nodeLeaves', { time: text.replace(/ /g, ' ') });
    } else if (roll.kind === 'respawn') {
        // Non-breaking, so the tip never wraps between the number and its unit.
        tip = roll.paused
            ? `Resting. Refills only with ${(roll.needsNearby || []).map(id => tokenName(id) || id).join(' or ')} nearby`
            : `Resting. Refills in ${text.replace(/ /g, ' ')}`;
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
 * The idle plate's cells, in the work plate's order: the problem, then the timer.
 * A choice waiting (nothing chosen on a station or Foundation) is left out: hovered, its mark is
 * already the gear that makes the choice.
 * @param {{
 *   problem?: {kind: string, severity: string}|null,
 *   timer?: ReturnType<typeof timerCellOf>
 * }} what
 * @returns {object[]} cells: the timer with its `tip`; the problem without one (the plate reads
 *   it from the engine when the pointer arrives)
 */
export function idlePlateCells({ problem = null, timer = null } = {}) {
    const cells = [];
    if (problem) cells.push({ kind: CELL.PROBLEM, severity: problem.severity });
    if (timer) cells.push(timer);
    return cells;
}
