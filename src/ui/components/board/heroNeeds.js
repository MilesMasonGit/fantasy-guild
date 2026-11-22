/**
 * The waiting speech bubbles a hero raises (`speechBubbles.js`), each with the condition that
 * clears it. Today: gear that broke.
 */

import { GameState } from '../../../state/GameState.js';
import { BOARD_EVENTS, ALERT } from '../../../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import { toolsOfHero } from '../../../systems/equipment/HeroTools.js';
import { getHeroWeaponSlot } from '../../../systems/combat/CombatFormulas.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { toolOf, toolKindLabel, neededToolOf } from '../../../config/registries/toolKinds.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { t } from '../../../i18n/index.js';
import { SPEECH_TONE } from './speechTone.js';

/** The key a broken tool's or weapon's bubble is raised under. */
export const GEAR_BROKE_KEY = 'gearBroke';

/** What may answer a broken item: hearing these, the store asks again. */
const GEAR_CHECK_ON = Object.freeze([
    ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED,
    ENGINE_EVENTS.HERO_DEPLOYED,
    BOARD_EVENTS.HERO_MOVED
]);

function heroRecord(heroId) {
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

/** The order a hero has now, as a number to compare: another order is another job. Null for none. */
function jobOf(heroId) {
    const flag = BoardState.flagOf(heroId);
    if (!flag) return null;
    return flag.plantedAt ?? flag.pinnedTo ?? 0;
}

/**
 * The bubble for `heroId`'s broken gear: a tool of `kind` (or a weapon, `kind` null), worded with
 * `name`. It stands while the hero holds nothing working of that kind and keeps the job they had.
 */
export function gearBrokeSpec(heroId, { kind, name }) {
    const job = jobOf(heroId);
    const holds = () => {
        const hero = heroRecord(heroId);
        if (!hero || jobOf(heroId) !== job) return false;
        if (kind) return !toolsOfHero(hero).some(tool => tool.backed && tool.kind === kind);
        return getHeroWeaponSlot(hero) === null;
    };
    return {
        key: GEAR_BROKE_KEY,
        text: t('messages.gearBroke', { item: name }),
        tone: SPEECH_TONE.ATTENTION,
        holds,
        checkOn: GEAR_CHECK_ON
    };
}

/** The bubble for a `GEAR_BROKE` payload, or null. */
export function gearBrokeSpecOf({ heroId, itemId, use } = {}) {
    if (!heroId || !itemId) return null;
    const item = getItem(itemId);
    const tool = use === 'fight' ? null : toolOf(item);
    return gearBrokeSpec(heroId, { kind: tool?.kind ?? null, name: item?.name || itemId });
}

/**
 * After a load, a hero still ordered onto work they cannot do for want of a tool lost it: an order
 * is refused without one. Worded with the tool's kind, since which item broke is not saved. A broken
 * weapon ended its order, so nothing stands for it here (the needs-a-job mark says it).
 */
export function rebuildGearBroke(raise) {
    for (const [heroId, flag] of Object.entries(BoardState.getFlags() || {})) {
        if (!flag || Flags.isSpot(flag)) continue;
        const ordered = BoardState.getTokenById(flag.pinnedTo);
        if (!ordered) continue;
        const refusal = Flags.orderRefusal(heroId, ordered);
        if (refusal?.reason !== ALERT.NO_TOOL) continue;
        const need = neededToolOf(getTokenType((refusal.on || ordered).typeId));
        if (!need) continue;
        raise(heroId, gearBrokeSpec(heroId, { kind: need.kind, name: toolKindLabel(need.kind) }));
    }
}
