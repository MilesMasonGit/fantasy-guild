import * as Flags from '../../../systems/board/Flags.js';
import * as Orders from '../../../systems/board/Orders.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import { dropOnMat, matAccepts } from './dropOnMat.js';
import { pointerToMat, onMatItself } from './matPoint.js';
import { isMatBankLocked } from '../../hooks/useMatBankLock.js';
import { getMapMode } from '../../hooks/useMapMode.js';
import { getSelection, SELECTION_KIND } from '../../hooks/useMatSelection.js';

/**
 * A right-click on the mat: an order for what is selected (`useMatSelection.js`), by **exactly
 * the rules a drop uses**.
 * - **A hero selected**: what dropping them there does. The very drop (`dropOnMat`, with the
 * payload a carried hero has), so the order, the refusal and the red bubble it is said in are the
 * drop's own: work the Token, fight the enemy, hunt from an enemy camp, home on the Guild Hall,
 * wait on bare ground. On their **own job** (`Orders.ownJobAt`: the Token their order names, or
 * the one they work or fight), or on their **own figure**, they stop instead (`Orders.stop`): a
 * job cannot be given twice. A stop puts the pointer's hints out ({@link onSelectedStop}).
 * - **A Token selected**: its move ({@link moveSelectedToken}).
 * - **Nothing selected**: a right-click on a hero's drawn pixel, or on the Token a hero works,
 * stops that hero.
 * Never in a map mode (a click there acts on the Token only), nor while the Bank covers the mat
 * (`matAccepts`: a drop there would land nothing either). Orders land on the mat only: a
 * right-click on a panel over it (the Bank, the Shop, a card) never reaches the mat
 * ({@link rightClickEvent}). The selection stays after the order, so a second right-click
 * corrects the first.
 * @returns the order's result (`{ success, reason?, order?, unchanged? }`), or null when the
 * right-click gave none
 */
export function rightClickAt(point, { heroUnder = null } = {}) {
    if (getMapMode() || isMatBankLocked()) return null;
    const selection = getSelection();
    if (selection?.kind === SELECTION_KIND.HERO) return orderSelectedHero(selection.id, point, heroUnder);
    if (selection?.kind === SELECTION_KIND.TOKEN) return moveSelectedToken(selection.id, point);
    return stopUnder(point, heroUnder);
}

/** The payload a carried hero has, as far as a drop reads it. */
const heroPayload = (heroId) => ({ kind: DRAG_KIND.FLAG, heroId });

function orderSelectedHero(heroId, point, heroUnder) {
    const payload = heroPayload(heroId);
    if (!matAccepts(payload)) return null;
    if (heroUnder === heroId || Orders.ownJobAt(heroId, point)) return stopSelected(heroId);
    return dropOnMat(payload, point);
}

const stopListeners = new Set();

/**
 * Hear a selected hero stopped by right-click: `fn(heroId)`. The selection's hints (`OrderDragLine`)
 * put their marks out, so the hero's yellow "needs a job" mark shows at once.
 * @returns {() => void} unsubscribe
 */
export function onSelectedStop(fn) {
    stopListeners.add(fn);
    return () => stopListeners.delete(fn);
}

function stopSelected(heroId) {
    const result = Orders.stop(heroId);
    for (const fn of [...stopListeners]) fn(heroId);
    return result;
}

/**
 * A right-click with a Token selected: moves it there through the drop's placement checks.
 * Brief 610 S3 builds it; until then it gives no order (a selected enemy never orders a hero).
 * @returns null
 */
export function moveSelectedToken(_instanceId, _point) {
    return null;
}

/** With nothing selected: the hero right-clicked, or the one working the Token there, stops. */
function stopUnder(point, heroUnder) {
    if (heroUnder) return Orders.stop(heroUnder);
    const target = point ? Flags.tokenAtPoint(point) : null;
    const worker = target ? BoardState.workerOf(target.id) : null;
    return worker ? Orders.stop(worker) : null;
}

/**
 * A `contextmenu` event on the mat element `matEl` ({@link rightClickAt}). `heroUnder` is the hero
 * whose drawn pixel it landed on (`MatHero`), or null. Off the mat itself ({@link onMatItself}) it
 * gives no order.
 */
export function rightClickEvent(e, matEl, heroUnder = null) {
    if (!e || !onMatItself(matEl, e.target)) return null;
    e.preventDefault?.();
    const point = pointerToMat({ x: e.clientX, y: e.clientY }, matEl.getBoundingClientRect());
    return rightClickAt(point, { heroUnder });
}
