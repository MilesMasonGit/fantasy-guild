import { getSkill } from '../../config/registries/skillRegistry.js';
import { t } from '../../i18n/index.js';

/**
 * The one way the game writes a level requirement: "Needs [icon] Melee 15", and where one hero is
 * involved "Needs [icon] Melee 15 (Ana: 12)". Every place that says what level something asks
 * calls this; a hero's own level ("25/99") is written elsewhere.
 *
 * Each writer returns `{ text, icons, parts }`:
 * - `text`: the plain words, for a spot that can only hold text (a native `title`, a log line);
 * - `icons`: `[{ skill, at }]`, each skill icon and the character of `text` it stands before;
 * - `parts`: the same as a list to draw in order, `{ text }` or `{ icon }` (a skill id).
 */

// Stands in for the icon while the words are filled, so a language can put the icon where its
// word order wants it; never shown.
const ICON = '\u0001';

const skillName = (skillId) => getSkill(skillId)?.name || skillId || '';

/** Split filled words at each icon mark into `{ text, icons, parts }`. */
function partsOf(marked, skills) {
    const icons = [];
    const parts = [];
    let text = '';
    marked.split(ICON).forEach((words, i) => {
        // The marks fall between the pieces, one per skill in order.
        const skill = i > 0 ? skills[i - 1] : null;
        if (skill) {
            icons.push({ skill, at: text.length });
            parts.push({ icon: skill });
        }
        if (words) {
            text += words;
            parts.push({ text: words });
        }
    });
    return { text, icons, parts };
}

/** One skill and level with its icon mark, "[icon] Melee 15", plus the hero's own when given. */
function levelMarked({ skill, level, hero = null, have = null }) {
    const vars = { icon: ICON, skill: skillName(skill), level };
    return hero != null && have != null
        ? t('levelNeed.levelHero', { ...vars, hero, have })
        : t('levelNeed.level', vars);
}

/**
 * "Needs [icon] Melee 15"; with `hero` (a name) and `have` (their level) "Needs [icon] Melee 15 (Ana: 12)".
 * @param {string} skill a skill id
 * @param {number} level
 * @param {{ hero?: string|null, have?: number|null }} [who]
 */
export function levelNeed(skill, level, { hero = null, have = null } = {}) {
    return levelNeeds([{ skill, level, hero, have }]);
}

/**
 * Several requirements after one "Needs": "Needs [icon] Melee 15, [icon] Defence 10". Each row may
 * carry its own `hero` and `have`. Null for an empty list.
 * @param {{ skill: string, level: number, hero?: string|null, have?: number|null }[]} needs
 */
export function levelNeeds(needs) {
    const rows = (needs || []).filter(n => n?.skill);
    if (!rows.length) return null;
    const list = rows.map(levelMarked).join(t('levelNeed.join'));
    return partsOf(t('levelNeed.needs', { list }), rows.map(r => r.skill));
}

/**
 * A skill and level that is not a requirement of a hero (an enemy's own level): "[icon] Melee 12".
 * @param {string} skill a skill id
 * @param {number} level
 */
export function skillLevel(skill, level) {
    return partsOf(levelMarked({ skill, level }), [skill]);
}

/** `icons` moved along by `by` characters: the words were put after `by` characters of other text. */
export const shiftIcons = (icons, by) => (icons || []).map(i => ({ ...i, at: i.at + by }));

/**
 * `{ hero, have }` for {@link levelNeed}: a hero record's name and level in `skill`; empty when
 * either is unknown, so the words fall back to the form without a hero.
 */
export function heroLevel(hero, skill) {
    const have = hero?.skills?.[skill]?.level;
    return hero?.name && Number.isFinite(have) ? { hero: hero.name, have } : {};
}
