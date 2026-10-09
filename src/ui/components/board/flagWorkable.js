import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import { centreOf } from '../../../systems/board/nearby.js';

/**
 * The Tokens a flag planted at `point` would let `heroId` work: centre inside the flag's reach
 * (`Flags.flagReaches`) and nothing in the hero's rules refusing it (`Flags.pinRefusal`: the
 * skill held at a high enough level, its rule switched on, the Token not disallowed). What the
 * player could fix later (inputs, charges, a recipe) and another hero already working it do not
 * count against it.
 * One pass over the mat's Tokens; the drag calls it once per pointer move.
 * @returns {{ id: string, x: number, y: number }[]}
 */
export function workableInReach(heroId, point) {
    if (!heroId || !point) return [];
    const flag = { x: point.x, y: point.y };
    const out = [];
    for (const instance of BoardState.tokens()) {
        const centre = centreOf(instance);
        if (!centre || !Flags.flagReaches(flag, centre)) continue;
        if (Flags.pinRefusal(heroId, instance) !== null) continue;
        out.push({ id: instance.id, x: centre.x, y: centre.y });
    }
    return out;
}
