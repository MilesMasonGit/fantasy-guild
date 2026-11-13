import * as Orders from '../../systems/board/Orders.js';
import * as Flags from '../../systems/board/Flags.js';
import * as BoardState from '../../systems/board/BoardState.js';
import { isGuildHall } from '../../systems/board/MatCap.js';

/**
 * A QA scene's order for `heroId` at `point`, as the player's drop gives it (`Orders.orderAt`). A
 * point on something no hero works (a Forest, an Orchard, bare ground beside a camp) orders the
 * hero onto the nearest Token they can work within `reach` instead, or, with none, sends them to
 * the spot.
 */
export function qaOrder(heroId, point, reach = 240) {
    if (!heroId || !point) return null;
    const under = Flags.tokenAtPoint(point);
    if (under && Orders.canOrderOnto(heroId, under)) return Orders.orderAt(heroId, point);
    let best = null;
    for (const t of BoardState.tokens()) {
        if (isGuildHall(t) || !Orders.canOrderOnto(heroId, t)) continue;
        const d = (t.x - point.x) ** 2 + (t.y - point.y) ** 2;
        if (d <= reach * reach && (!best || d < best.d)) best = { t, d };
    }
    if (best) return Flags.orderToken(heroId, best.t);
    return Flags.orderSpot(heroId, point);
}
