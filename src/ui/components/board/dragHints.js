import { useSyncExternalStore } from 'react';
import { GameState } from '../../../state/GameState.js';
import * as WorkCheck from '../../../systems/board/WorkCheck.js';
import * as HeroTools from '../../../systems/equipment/HeroTools.js';
import * as SkillSystem from '../../../systems/hero/SkillSystem.js';
import { isEnemyToken } from '../../../systems/board/BoardCombat.js';
import { workConfigOf } from '../../../systems/board/StationRecipe.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { getAllItems } from '../../../config/registries/itemRegistry.js';
import { handEntries } from '../../../config/registries/equipmentConstants.js';
import { toolItemFor } from '../../../config/registries/toolKinds.js';
import { isWarCamp } from '../../../config/registries/tokenConstants.js';

/**
 * The drag hints: while a hero is carried over a Token, every hero shows whether they could work
 * it, as marks over their figure on the mat, on their hero bar card and on the carried flag.
 *
 * - A worked Token: a **tool mark** when its work needs a tool (the hero's own fitting tool, else
 * the lowest tier that will do) and a **skill mark** with the hero's level, each passing or not.
 * Pass and fail are `WorkCheck.heroReason`'s own two gates read apart (`skillFailure`,
 * `toolNeedOf` with `HeroTools.fittingToolOf`), never a copy of them. A Token naming no skill
 * gates nobody (`heroReason` answers null), so it shows nothing.
 * - An enemy: the weapons and shields in the hero's hands, one each (a two-handed weapon takes one
 * slot), with no pass or fail. A gathering tool is never shown there; hands holding no weapon or
 * shield show nothing.
 *
 * ⚠️ Worked out once as the carried hero enters a Token (`OrderDragLine` calls
 * {@link setHintTarget} as the Token under the pointer changes), never per pointer move, and
 * emptied when it leaves or the drag ends. While nothing is aimed at, every hero's answer is null
 * and nothing is drawn.
 */

/**
 * One hero's marks for Token `instance`, or null for none:
 * `{ kind: 'work', tool: { itemId, pass } | null, skill: { skillId, level, pass } }` or
 * `{ kind: 'hands', items: [itemId, ...] }`.
 */
export function marksFor(heroId, instance) {
    const def = getTokenType(instance?.typeId);
    if (!def || !heroId) return null;
    // A War Camp hands out only fights: its hint is the same as an enemy's.
    if (isEnemyToken(instance) || isWarCamp(def)) {
        const hero = heroRecord(heroId);
        const items = hero ? handEntries(hero).map(e => e.itemId).filter(id => !HeroTools.isToolItem(id)) : [];
        return items.length ? { kind: 'hands', items } : null;
    }
    const config = workConfigOf(def, instance);
    if (!config?.skill) return null;
    const skill = {
        skillId: config.skill,
        level: SkillSystem.getSkillLevel(heroId, config.skill) ?? 0,
        pass: WorkCheck.skillFailure(heroId, config) === null
    };
    const need = WorkCheck.toolNeedOf(instance);
    let tool = null;
    if (need) {
        const own = HeroTools.fittingToolOf(heroId, need);
        const itemId = own || toolItemFor(need, getAllItems());
        if (itemId) tool = { itemId, pass: own !== null };
    }
    return { kind: 'work', tool, skill };
}

function heroRecord(heroId) {
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

let targetId = null;
let byHero = new Map();
const listeners = new Set();

function emit() {
    for (const fn of listeners) fn();
}

/**
 * Aim the hints at Token `instance` (every hero's marks worked out now), or put them out with null.
 * The same Token again is a no-op.
 */
export function setHintTarget(instance) {
    const id = instance?.id ?? null;
    if (id === targetId) return;
    targetId = id;
    const next = new Map();
    if (instance) {
        for (const hero of GameState.state?.heroes || []) {
            const marks = hero?.id ? marksFor(hero.id, instance) : null;
            if (marks) next.set(hero.id, marks);
        }
    }
    if (next.size === 0 && byHero.size === 0) return;
    byHero = next;
    emit();
}

/** Hero `heroId`'s marks now, or null. The same object until the aim changes. */
export function hintsOf(heroId) {
    return byHero.get(heroId) || null;
}

/** Whether any hero shows marks now. */
export function hintsShowing() {
    return byHero.size > 0;
}

export function subscribeHints(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Hero `heroId`'s marks; redraws its caller only as the aim changes. */
export function useHeroHints(heroId) {
    return useSyncExternalStore(subscribeHints, () => hintsOf(heroId), () => null);
}
