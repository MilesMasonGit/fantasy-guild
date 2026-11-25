import { ALERT } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as MatCap from '../../../systems/board/MatCap.js';
import * as Respawn from '../../../systems/board/Respawn.js';
import { getMissingRequirements } from '../../../systems/board/RecipeResolver.js';
import { siteTypeOf, buildRefusal } from '../../../systems/board/SiteRules.js';
import { workConfigOf } from '../../../systems/board/StationRecipe.js';
import * as Laboratories from '../../../systems/board/Laboratories.js';
import * as Mastery from '../../../systems/progression/Mastery.js';
import { levelNeed, heroLevel } from '../../../systems/core/levelNeed.js';
import { GameState } from '../../../state/GameState.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { fieldOf } from '../../../config/registries/tokenConstants.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { getItem, getAllItems } from '../../../config/registries/itemRegistry.js';
import { withArticle } from '../../../systems/effects/toolNames.js';
import { neededToolOf, toolNeedPhrase } from '../../../config/registries/toolKinds.js';
import { joinNames } from './heroBubbles.js';

/**
 * A Token's one problem mark: which problem it shows, how bad it is, and what the Token card
 * says of it. **Waiting** (yellow) is a Token that needs something given to it or waits for room:
 * items, a Token beside it, charges, a choice, a full Token cap (a spawner's: the cap frees as
 * Tokens leave). **Can't** (red) is one that cannot go on however it is fed: no room, a hero who
 * cannot do the work.
 */

export const SEVERITY = Object.freeze({ WAITING: 'waiting', CANT: 'cant' });

/** Each problem's severity. A problem missing here draws no mark. */
export const PROBLEM_SEVERITY = Object.freeze({
    [ALERT.INPUTS]: SEVERITY.WAITING,
    [ALERT.NO_RECIPE]: SEVERITY.WAITING,
    [ALERT.CHARGES]: SEVERITY.WAITING,
    [ALERT.CHOOSE_RECIPE]: SEVERITY.WAITING,
    [ALERT.CHOOSE_BUILD]: SEVERITY.WAITING,
    [ALERT.CHOOSE_NODE]: SEVERITY.WAITING,
    [ALERT.NODE_MASTERED]: SEVERITY.WAITING,
    [ALERT.SPAWN_NEEDS_ITEM]: SEVERITY.WAITING,
    [ALERT.GROW_NEEDS_NEARBY]: SEVERITY.WAITING,
    [ALERT.GROW_NEEDS_ITEM]: SEVERITY.WAITING,
    [ALERT.NO_ROOM]: SEVERITY.CANT,
    [ALERT.BUILD_SITE]: SEVERITY.CANT,
    [ALERT.ACCESS]: SEVERITY.CANT,
    [ALERT.UNSKILLED]: SEVERITY.CANT,
    [ALERT.NO_TOOL]: SEVERITY.CANT,
    [ALERT.SPAWN_NO_ROOM]: SEVERITY.CANT,
    [ALERT.SPAWN_MAT_FULL]: SEVERITY.WAITING
});

/** The mark's picture for each severity: placeholders until the owner draws the problem mark. */
export const PROBLEM_SPRITE = Object.freeze({
    [SEVERITY.WAITING]: '/assets/ui/u_alert_yellow.png',
    [SEVERITY.CANT]: '/assets/ui/u_alert_red.png'
});

/** The mark's art size: its sprite's own pixels, drawn at the Token's art-pixel size. */
export const PROBLEM_MARK_ART_PX = 16;

/**
 * Every gear on a Token, in mat units: the mark's own footprint, so the gear that stands in a
 * choice's '!' and the gear of a station with a recipe are one size, and the swap from the '!'
 * moves nothing around it.
 */
export const tokenGearPx = (artUnit = 2) => PROBLEM_MARK_ART_PX * artUnit;

/** The reason's colour on the Token card for each severity (UI_STYLE colours). */
export const PROBLEM_COLOUR = Object.freeze({
    [SEVERITY.WAITING]: 'var(--color-ui-gold)',
    [SEVERITY.CANT]: 'var(--color-ui-red)'
});

/**
 * The one problem a Token shows, or null.
 * - `alert`: the engine's `instance.alert` (a worked Token's block, or a fixable reason a flag
 * passed it over for);
 * - `spawner`: a spawner's `{ alert, needs }` (`SpawnerSystem.spawnerAlertOf`);
 * - `growth`: a growing Token's `{ alert, needs }` (`Growth.growthAlertOf`: a Stump with no Forest
 * in reach, or stopped for want of a seedling);
 * - `choose`: `'recipe'`, `'build'` or `'node'` while a station, a Foundation or a Laboratory has
 * nothing chosen.
 * A can't beats a waiting; otherwise the work alert first, then the spawner's, the growth's, then
 * the choice.
 * @returns {{kind: string, severity: string, needs?: string[]}|null}
 */
export function problemOf({ alert = null, spawner = null, growth = null, choose = null } = {}) {
    const found = [];
    if (alert && PROBLEM_SEVERITY[alert]) found.push({ kind: alert, severity: PROBLEM_SEVERITY[alert] });
    for (const stuck of [spawner, growth]) {
        if (stuck?.alert && PROBLEM_SEVERITY[stuck.alert]) {
            found.push({ kind: stuck.alert, severity: PROBLEM_SEVERITY[stuck.alert], needs: stuck.needs || [] });
        }
    }
    if (choose) {
        const kind = choose === 'build' ? ALERT.CHOOSE_BUILD : choose === 'node' ? ALERT.CHOOSE_NODE : ALERT.CHOOSE_RECIPE;
        found.push({ kind, severity: PROBLEM_SEVERITY[kind] });
    }
    return found.find(p => p.severity === SEVERITY.CANT) || found[0] || null;
}

/** "an Oak Forest", "an Oak Forest or a Wild Oak Forest": any one of them will do. */
const joinOr = (names) => (names.length < 2 ? names[0] || '' : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`);

/** The skill the Token's work needs, by id and name, and the level it asks for. */
function skillNeeded(instance) {
    const config = workConfigOf(getTokenType(instance.typeId), instance);
    const skillId = config?.skill || null;
    return {
        id: skillId,
        name: skillId ? (getSkill(skillId)?.name || skillId) : null,
        level: Math.max(1, Number(config?.skillRequired) || 1)
    };
}

/** The record of the hero working `instance`, or null. */
function workerHero(instance) {
    const heroId = BoardState.workerOf(instance.id);
    return heroId ? (GameState.state?.heroes || []).find(h => h?.id === heroId) || null : null;
}

/**
 * What the Token card says of the problem, read from the engine NOW: exactly what is missing or
 * in the way.
 * @param {{kind: string, needs?: string[]}} problem from {@link problemOf}
 * @param {string} instanceId
 */
export function problemText(problem, instanceId) {
    if (!problem) return '';
    const instance = BoardState.getTokenById(instanceId);
    switch (problem.kind) {
        case ALERT.INPUTS: {
            const missing = instance ? getMissingRequirements(instanceId, instance) : null;
            const items = missing?.type === 'items' ? missing.items : [];
            return items.length ? `Needs ${joinNames(items)}` : 'Needs items';
        }
        case ALERT.NO_RECIPE: {
            const missing = instance ? getMissingRequirements(instanceId, instance) : null;
            const tokens = missing?.type === 'tokens' ? missing.items : [];
            return tokens.length ? `Needs ${joinNames(tokens.map(withArticle))} nearby` : 'Nothing to make';
        }
        case ALERT.CHARGES:
            return 'Too few charges left';
        case ALERT.CHOOSE_RECIPE:
            return 'Choose a recipe';
        case ALERT.CHOOSE_BUILD:
            return 'Choose what to build';
        case ALERT.CHOOSE_NODE:
            return 'Choose a node to study';
        case ALERT.NODE_MASTERED: {
            const node = instance ? Laboratories.targetOf(instance) : null;
            const name = node ? Mastery.kindName(Mastery.kindOf(node)) : null;
            return name ? `${name} is fully mastered: choose another node` : 'Fully mastered: choose another node';
        }
        case ALERT.BUILD_SITE: {
            // The build's own sentence: Needs stone., Needs a Leyline nearby.
            const built = instance ? siteTypeOf(instance) : null;
            return (built && buildRefusal(instance, built)) || 'Can’t be built here';
        }
        case ALERT.NO_ROOM: {
            if (getTokenType(instance?.typeId)?.foundation) return 'No room to build here';
            return MatCap.canPlaceMore(1) ? 'No room for what it makes' : 'Token cap full';
        }
        case ALERT.ACCESS: {
            const skill = instance ? skillNeeded(instance) : { name: null };
            return skill.id ? levelNeed(skill.id, skill.level, heroLevel(workerHero(instance), skill.id)).text : 'Hero’s level is too low';
        }
        case ALERT.UNSKILLED: {
            const skill = instance ? skillNeeded(instance) : { name: null };
            return skill.name ? `Needs the ${skill.name} skill` : 'Hero lacks the skill';
        }
        case ALERT.NO_TOOL: {
            const need = neededToolOf(getTokenType(instance?.typeId));
            return need ? `Needs ${toolNeedPhrase(need, getAllItems())}` : 'Needs a tool in hand';
        }
        case ALERT.SPAWN_NEEDS_ITEM: {
            const names = (problem.needs || []).map(id => getItem(id)?.name || id);
            return names.length ? `Needs ${joinNames(names)} to spawn` : 'Needs items to spawn';
        }
        case ALERT.GROW_NEEDS_NEARBY: {
            const names = (problem.needs || []).map(id => getTokenType(id)?.name || id);
            // The same wait on an exhausted Token (a Bare apple tree whose Orchard is gone) is for its respawn.
            const what = Respawn.isResting(instance) ? 'respawn' : 'grow';
            return names.length ? `Needs its own ${joinOr(names)} to ${what}` : `Needs its owner to ${what}`;
        }
        case ALERT.GROW_NEEDS_ITEM: {
            const names = (problem.needs || []).map(id => getItem(id)?.name || id);
            // The same stop on a Field is for want of its seed: it waits to sow.
            const what = fieldOf(getTokenType(instance?.typeId)) ? 'sow' : 'grow';
            return names.length ? `Needs ${joinNames(names)} to ${what}` : `Needs items to ${what}`;
        }
        case ALERT.SPAWN_NO_ROOM:
            return 'No room to spawn';
        case ALERT.SPAWN_MAT_FULL:
            return 'Token cap full';
        default:
            return '';
    }
}
