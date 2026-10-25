import { ALERT } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as MatCap from '../../../systems/board/MatCap.js';
import * as Charges from '../../../systems/board/Charges.js';
import { getMissingRequirements, effectiveIO } from '../../../systems/board/RecipeResolver.js';
import { workConfigOf } from '../../../systems/board/StationRecipe.js';
import { MASTERY_LEVEL } from '../../../systems/hero/PromotionSystem.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { getItem, getAllItems } from '../../../config/registries/itemRegistry.js';
import { neededToolOf, toolNeedPhrase } from '../../../config/registries/toolKinds.js';
import { joinNames } from './heroBubbles.js';

/**
 * A Token's one problem mark: which problem it shows, how bad it is, and what its hover says.
 * **Waiting** (yellow) is a Token that needs something given to it: items, a Token beside it,
 * charges, a choice. **Can't** (red) is one that cannot go on however it is fed: no room, the
 * mat at its cap, a hero who cannot do the work.
 */

export const SEVERITY = Object.freeze({ WAITING: 'waiting', CANT: 'cant' });

/** Each problem's severity. A problem missing here draws no mark. */
export const PROBLEM_SEVERITY = Object.freeze({
    [ALERT.INPUTS]: SEVERITY.WAITING,
    [ALERT.NO_RECIPE]: SEVERITY.WAITING,
    [ALERT.CHARGES]: SEVERITY.WAITING,
    [ALERT.CHOOSE_RECIPE]: SEVERITY.WAITING,
    [ALERT.CHOOSE_BUILD]: SEVERITY.WAITING,
    [ALERT.SPAWN_NEEDS_ITEM]: SEVERITY.WAITING,
    [ALERT.GROW_NEEDS_NEARBY]: SEVERITY.WAITING,
    [ALERT.GROW_NEEDS_ITEM]: SEVERITY.WAITING,
    [ALERT.NO_ROOM]: SEVERITY.CANT,
    [ALERT.ACCESS]: SEVERITY.CANT,
    [ALERT.UNSKILLED]: SEVERITY.CANT,
    [ALERT.NO_TOOL]: SEVERITY.CANT,
    [ALERT.SPAWN_NO_ROOM]: SEVERITY.CANT,
    [ALERT.SPAWN_MAT_FULL]: SEVERITY.CANT
});

/** The mark's picture for each severity: placeholders until the owner draws the problem mark. */
export const PROBLEM_SPRITE = Object.freeze({
    [SEVERITY.WAITING]: '/assets/ui/u_alert_yellow.png',
    [SEVERITY.CANT]: '/assets/ui/u_alert_red.png'
});

/** The mark's art size: its sprite's own pixels, drawn at the Token's art-pixel size. */
export const PROBLEM_MARK_ART_PX = 16;

/** The hover text's colour for each severity (UI_STYLE colours). */
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
 * - `choose`: `'recipe'` or `'build'` while a station or Foundation has nothing chosen.
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
        const kind = choose === 'build' ? ALERT.CHOOSE_BUILD : ALERT.CHOOSE_RECIPE;
        found.push({ kind, severity: PROBLEM_SEVERITY[kind] });
    }
    return found.find(p => p.severity === SEVERITY.CANT) || found[0] || null;
}

/** "a Pickaxe", "an Anvil": Tokens are countable things, items are not. */
const withArticle = (name) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;

/** "an Oak Forest", "an Oak Forest or a Wild Oak Forest": any one of them will do. */
const joinOr = (names) => (names.length < 2 ? names[0] || '' : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`);

/** A context tag as a name: `fishing_rod` reads `Fishing Rod`. */
const tagName = (tag) => String(tag || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** Where the charges ran short: on the Token itself, or on a Token beside it (by tag). */
function chargesText(instance) {
    const plan = Charges.planCycle(instance.id, instance, effectiveIO(instance.id, instance));
    const beside = (plan?.missing || []).find(m => m.reason === 'charges' && m.tag);
    return beside ? `Too few charges on the ${tagName(beside.tag)} nearby` : 'Too few charges left';
}

/** The skill the Token's work needs, by name, and the level it asks for. */
function skillNeeded(instance) {
    const config = workConfigOf(getTokenType(instance.typeId), instance);
    const skillId = config?.skill || null;
    return {
        name: skillId ? (getSkill(skillId)?.name || skillId) : null,
        level: Math.max(1, Number(config?.skillRequired) || 1)
    };
}

/**
 * What the mark's hover says, read from the engine NOW (so call it when the pointer arrives,
 * never per render): exactly what is missing or in the way.
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
            return instance ? chargesText(instance) : 'Too few charges left';
        case ALERT.CHOOSE_RECIPE:
            return 'Choose a recipe';
        case ALERT.CHOOSE_BUILD:
            return 'Choose what to build';
        case ALERT.NO_ROOM: {
            if (getTokenType(instance?.typeId)?.foundation) return 'No room to build here';
            return MatCap.canPlaceMore(1) ? 'No room for what it makes' : 'Token cap full';
        }
        case ALERT.ACCESS: {
            const skill = instance ? skillNeeded(instance) : { name: null };
            return skill.name ? `Needs ${skill.name} ${skill.level}/${MASTERY_LEVEL}` : 'Hero’s level is too low';
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
            const names = (problem.needs || []).map(id => withArticle(getTokenType(id)?.name || id));
            return names.length ? `Needs ${joinOr(names)} nearby to grow` : 'Needs a Token nearby to grow';
        }
        case ALERT.GROW_NEEDS_ITEM: {
            const names = (problem.needs || []).map(id => getItem(id)?.name || id);
            return names.length ? `Needs ${joinNames(names)} to grow` : 'Needs items to grow';
        }
        case ALERT.SPAWN_NO_ROOM:
            return 'No room to spawn';
        case ALERT.SPAWN_MAT_FULL:
            return 'Token cap full';
        default:
            return '';
    }
}
