import { CELL } from './workPlate.js';
import { timerLines, liveTimerSources, TIMER_KIND } from './tokenTimers.js';

/**
 * The idle plate: a Token nobody works, once the pointer rests on it, gets the work plate's look
 * under itself only when it is stuck or counting: its problem and its timers, each the card's own
 * line (`tokenTimers.js`): the cell shows the figure, its tooltip the card's sentence. Charges, a
 * spawner's count and a quest's progress are not its business (they stay on the card). With
 * neither a problem nor a timer there is no plate, and the hover is the name alone. No React here:
 * `IdlePlate` (IdlePlate.jsx) draws it. An enemy never gets one: hovered, it shows its name and HP
 * only.
 */

/**
 * The hover's timer lines for a Token: every running timer and stuck reason the card has, less
 * the stuck reasons its problem cell already says. Left out too: Passive Production, which the
 * hover already shows in its own tooltip under the Token (`PassiveProductionTooltip`), where a
 * plate would sit on top of it; and a spawner spawning as it should, whose next spawn stays on the
 * card beside its family's count (a full or sleeping one is stuck, and shows). Null with none, so
 * a caller can test it.
 * @returns {object[]|null}
 */
export function idleTimerLines(instance, src = liveTimerSources()) {
    const lines = timerLines(instance, src).filter(line => !line.alert
        && line.kind !== TIMER_KIND.PRODUCE
        && !(line.kind === TIMER_KIND.SPAWN && line.state === 'spawning'));
    return lines.length ? lines : null;
}

/**
 * The timer cells from one read of the Token's timers (`idleTimerLines`), in the card's order.
 * @returns {Array<{kind: 'timer', glyph: string, text: string, tip: string}>}
 */
export function timerCellsOf(lines) {
    return (Array.isArray(lines) ? lines : [])
        .filter(line => line?.text)
        .map(line => ({ kind: CELL.TIMER, glyph: line.icon || 'clock', text: line.text, tip: line.tip }));
}

/**
 * The idle plate's cells, in the work plate's order: the problem, then the timers.
 * A choice waiting (nothing chosen on a station or Foundation) is left out: hovered, its mark is
 * already the gear that makes the choice.
 * @param {{
 *   problem?: {kind: string, severity: string}|null,
 *   timers?: ReturnType<typeof timerCellsOf>
 * }} what
 * @returns {object[]} cells: each timer with its `tip`; the problem without one (the plate reads
 *   it from the engine when the pointer arrives)
 */
export function idlePlateCells({ problem = null, timers = [] } = {}) {
    const cells = [];
    if (problem) cells.push({ kind: CELL.PROBLEM, severity: problem.severity });
    cells.push(...(timers || []));
    return cells;
}
