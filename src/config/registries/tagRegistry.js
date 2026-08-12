// Fantasy Guild - Card Tag Registry
// Card Mutators & Tokens, Phase 2 (mutator_roadmap_v1.md · status_effects_plan.md §15.4).
//
// Every Card carries a `tags: []` array. Tokens declare `target_tags` and are
// stamped onto the slots whose Card tags match (see `tokenMatchesTags` in
// ./TokenRegistry.js — that helper is this module's consumer).
//
// === Why tags are DERIVED, not authored ===
// §15.4 is explicit: tags are "auto-seeded from each card's existing
// skill/subskill so the catalog doesn't need hand-auditing". Hand-tagging the
// whole catalog is a standing non-goal. Everything below is computed from data
// the cards already carry, so a new card is correctly tagged the moment it is
// authored, with zero extra fields. CARD_TAG_OVERRIDES is the deliberately
// tiny escape hatch for flavour a card's own data cannot express.
//
// === Canonical casing ===
// Tags are normalised to Title Case on read ('fishing' -> 'Fishing'). One
// casing, always, so 'Fishing' and 'fishing' can never both circulate as
// distinct tags. `tokenMatchesTags` compares case-insensitively, so this is
// belt-and-braces — but it is what keeps tooltips and debug output readable.

import { SKILLS, SKILL_CATEGORIES } from './skillRegistry.js';
import { DatabaseManager } from '../DatabaseManager.js';

/**
 * The flavour tags §15.4 calls out by name, and how each one is reached.
 * Kept short on purpose — do NOT speculatively tag the catalog.
 *
 *  - Aquatic    — derived: the `aquatic` parent skill (and its `nautical`
 *                 legacy alias, and subskills like `fishing`) resolve to it.
 *                 Hand-added only for water-themed cards whose skill is not
 *                 aquatic (see CARD_TAG_OVERRIDES).
 *  - Gathering  — derived: the skill category of labor/aquatic/nature.
 *  - Social     — derived: the `social` skill.
 *  - Hazard     — derived: the card can start a fight (a `combat_trigger`
 *                 output, or an enemyId on a non-combat card).
 *
 * That all four fall out of existing data is the point: the four names §15.4
 * lists as "hand-added where they matter" mostly do not need hands at all.
 */
export const FLAVOUR_TAGS = ['Aquatic', 'Gathering', 'Social', 'Hazard'];

/**
 * Hand-added flavour, keyed by card template id.
 *
 * KEEP THIS SMALL. An entry belongs here only when a card's theme genuinely
 * is not recoverable from its skill, subskill, type or outputs. If you find
 * yourself adding many entries, the derivation rules below are wrong — fix
 * them instead.
 *
 * Derived tags are always merged in as well; an override adds, never replaces.
 */
export const CARD_TAG_OVERRIDES = {
    // A well is a water card, but it is worked with the Nature skill, so
    // nothing in its own data says "water". This is exactly the case the
    // override map exists for.
    task_wishing_well: ['Aquatic']
};

// --- Subskill id -> display name -------------------------------------------
// Stations reference a subskill by generated id (config.recipeGroup), not by
// name, so 'subskill_mpqi3mkd' has to become 'Baking' before it can be a tag.
let SUBSKILL_NAMES = null;
function getSubskillNames() {
    if (SUBSKILL_NAMES) return SUBSKILL_NAMES;
    SUBSKILL_NAMES = {};
    try {
        for (const module of Object.values(DatabaseManager.subskillFiles || {})) {
            const data = module.default || module;
            const list = Array.isArray(data) ? data : Object.values(data || {});
            list.forEach(sub => {
                if (sub?.id && sub?.name) SUBSKILL_NAMES[sub.id] = sub.name;
            });
        }
    } catch {
        // Subskill data is optional; stations simply lose their subskill tag.
    }
    return SUBSKILL_NAMES;
}

/**
 * Normalise one tag to canonical Title Case.
 * @param {string} raw
 * @returns {string|null} null when the input is not a usable tag
 */
export function normalizeTag(raw) {
    if (raw === null || raw === undefined) return null;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    return trimmed
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Normalise a list of tags: canonical casing, de-duplicated, order preserved.
 * @param {Array<string>} list
 * @returns {string[]}
 */
export function normalizeTags(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of list) {
        const tag = normalizeTag(raw);
        if (tag && !seen.has(tag)) {
            seen.add(tag);
            out.push(tag);
        }
    }
    return out;
}

/** Does this card's data say it can start a fight? */
function isHazard(template) {
    const cardType = template.cardType;
    if (cardType === 'combat' || cardType === 'dungeon' || cardType === 'invasion') {
        return false; // fighting IS the card; "Hazard" means an unexpected fight
    }
    const outputs = template.outputs || template.config?.outputs;
    if (Array.isArray(outputs) && outputs.some(o => o?.type === 'combat_trigger')) {
        return true;
    }
    return Boolean(template.enemyId || template.config?.enemyId);
}

/**
 * Derive the full tag list for a card template.
 *
 * Sources, in order:
 *   1. cardType            — 'task' -> Task, 'combat' -> Combat. Combat cards
 *                            MUST be tagged; the Phase 7 combat axis (§15.13)
 *                            targets them by tag like anything else.
 *   2. skill               — the id the card actually declares ('fishing',
 *                            'nautical', 'nature'). Tagged as-is when it names
 *                            a real skill or subskill.
 *   3. parent skill        — a subskill or legacy id also contributes its
 *                            parent ('fishing' -> Aquatic, 'industry' -> Labor).
 *   4. skill category      — Gathering / Processing / Special / Combat.
 *   5. subskill (stations) — config.recipeGroup resolved to its display name.
 *   6. taskCategory        — when a card declares one.
 *   7. Hazard              — derived from combat_trigger / enemyId.
 *   8. template.tags       — anything explicitly authored on the card.
 *   9. CARD_TAG_OVERRIDES  — the small hand-added flavour map above.
 *
 * @param {object} template - a card template (or anything template-shaped)
 * @returns {string[]} canonical, de-duplicated tags
 */
export function deriveCardTags(template) {
    if (!template || typeof template !== 'object') return [];

    const raw = [];

    // 1. Card type
    if (template.cardType) raw.push(template.cardType);

    // 2/3. Skill and its layer.
    //
    // Sub-skills and legacy parent aliases are both gone: an id is a real skill
    // or it is not tagged at all. The old three-step (id → parent → category)
    // collapses to two, because a skill no longer has a parent — only a layer.
    const skillId = template.skill || template.config?.skill;
    if (skillId) {
        const id = String(skillId).toLowerCase();
        if (SKILLS[id]) {
            raw.push(id);

            const layer = SKILLS[id].layer;
            if (layer) raw.push(SKILL_CATEGORIES[layer]?.name || layer);
        }
    }

    // 5. Station subskill
    const subskillId = template.subskillId || template.config?.recipeGroup;
    if (subskillId) {
        const name = getSubskillNames()[subskillId];
        if (name) raw.push(name);
    }

    // 6. Explicit task category
    const taskCategory = template.taskCategory || template.config?.taskCategory;
    if (taskCategory) raw.push(taskCategory);

    // 7. Hazard
    if (isHazard(template)) raw.push('Hazard');

    // 8. Authored tags
    if (Array.isArray(template.tags)) raw.push(...template.tags);

    // 9. Hand-added flavour
    const overrideKey = template.id || template.templateId;
    if (overrideKey && CARD_TAG_OVERRIDES[overrideKey]) {
        raw.push(...CARD_TAG_OVERRIDES[overrideKey]);
    }

    return normalizeTags(raw);
}

/**
 * Does a card carry a tag? Case-insensitive, matching `tokenMatchesTags`.
 * @param {object} card
 * @param {string} tag
 * @returns {boolean}
 */
export function cardHasTag(card, tag) {
    const wanted = normalizeTag(tag);
    if (!wanted) return false;
    return normalizeTags(card?.tags).includes(wanted);
}
