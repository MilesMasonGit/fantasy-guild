import { MODIFIER_PALETTE, getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { blankRestriction } from '../../config/registries/restrictionPalette.js';
import { DEFAULT_REACH, REACH, reachOf } from '../../config/registries/reachRegistry.js';
import { ROLE } from '../../config/registries/roleRegistry.js';

/**
 * A Token's rules are statements, and a statement is one sentence:
 *
 * ```
 * [ When <event>, ]  KEYWORD  <payload>  [ to <filter> ]  [ , costing <upkeep> ]
 *      optional       always    always      some keywords      optional
 * ```
 *
 * A statement carries exactly one thing it does, so the rules text is the statements
 * rendered in words and a wrong statement makes a wrong sentence.
 *
 * ⚠️ Every statement has a stable `id`: per-copy state (`BlockUpkeep`, `TriggerSystem`) is
 * keyed by id, never array position, so reordering a Token's rules in the CMS cannot remap
 * a live save's state onto the wrong rule.
 *
 * ⚠️ Legality is declared: `KEYWORDS` says which keywords accept a trigger and which accept
 * upkeep, so the editor cannot offer a combination no system reads.
 */

/** The keywords a statement may start with. */
export const KEYWORD = Object.freeze({
    PROVIDES: 'provides',
    GRANTS: 'grants',
    ACTS_AS: 'acts_as',
    REQUIRES: 'requires',
    RESTOCKS: 'restocks',
    CONVERTS: 'converts',
    CANNOT: 'cannot',
    APPLIES: 'applies',
    DEALS: 'deals',
    HEALS: 'heals',
    RESTORES: 'restores',
    REMOVES: 'removes',
    SPAWNS: 'spawns',
    TRANSFORMS: 'transforms',
    STATION: 'station',
    PROMOTES: 'promotes'
});

/** Whether a keyword may carry a `When ...` clause. */
export const WHEN = Object.freeze({
    NEVER: 'never',
    OPTIONAL: 'optional',
    REQUIRED: 'required'
});

/**
 * Every keyword, with what it accepts.
 *
 * `filter` says whether the statement may name which neighbours it reaches. `Acts as`,
 * `Requires` and `Restocks` have none: a capability goes to every neighbour, a requirement
 * is about this Token, and a restock list is its own filter.
 *
 * ⚠️ `Converts` has a filter that names a SINGLE destination, not a set; see its row.
 *
 * `reach` says how far the statement carries (`reachRegistry.js`), independent of `filter`.
 * It is omitted on purpose for: `Requires` and `Works as` (about this Token), `Acts as` and
 * `Restocks` (no filter, and reach alone would be half a targeting vocabulary and a real
 * balance change), `Converts` (already names one destination) and `Cannot` (a placement
 * restriction read once by `Placement.js`).
 */
export const KEYWORDS = Object.freeze([
    {
        id: KEYWORD.PROVIDES,
        label: 'Provides',
        blurb: 'Changes a number on nearby Tokens — yield, work time, XP and the rest.',
        filter: true,
        reach: true,
        when: WHEN.NEVER,
        upkeep: true
    },
    {
        id: KEYWORD.GRANTS,
        label: 'Grants',
        blurb: 'Hands a nearby Token an extra item when it finishes work.',
        filter: true,
        reach: true,
        when: WHEN.OPTIONAL,
        upkeep: true
    },
    {
        /**
         * ⚠️ Deliberately does not scale: `tier` is which capability this is (`RecipeResolver`
         * gates on `>= minTier`), not a magnitude. A Tier 3 pickaxe is a different tool, so each
         * tier is its own library entry.
         */
        id: KEYWORD.ACTS_AS,
        label: 'Acts as',
        blurb: 'Hands a capability — a pickaxe, an anvil — to every nearby station.',
        filter: false,
        when: WHEN.NEVER,
        upkeep: true
    },
    {
        id: KEYWORD.REQUIRES,
        label: 'Requires',
        blurb: 'This Token does not work unless something beside it supplies a capability.',
        filter: false,
        when: WHEN.NEVER,
        upkeep: false
    },
    {
        id: KEYWORD.RESTOCKS,
        label: 'Restocks',
        blurb: 'Keeps named neighbours supplied from the Guild Bank when they run dry.',
        filter: false,
        when: WHEN.NEVER,
        upkeep: true
    },
    {
        /**
         * ⚠️ The filter picks ONE destination, not a set: a conversion is an exchange with a fixed
         * input, so producing onto several Kilns would multiply the output while the Bank paid
         * once. `TriggerSystem` takes the lowest-indexed match. An absent filter means the firing
         * tile.
         */
        id: KEYWORD.CONVERTS,
        label: 'Converts',
        blurb: 'Spends items from the Bank and produces others. Needs a firing moment.',
        filter: true,
        when: WHEN.REQUIRED,
        upkeep: true
    },
    {
        /**
         * ⚠️ No trigger and no upkeep, both deliberately: a restriction is not a thing that
         * happens, and a rule that lapses when you run out of coal would be a trap.
         */
        id: KEYWORD.CANNOT,
        label: 'Cannot',
        blurb: 'A restriction on where this Token may sit. Refused at the moment you put it down.',
        filter: true,
        when: WHEN.NEVER,
        upkeep: false
    },
    {
        /**
         * ⚠️ The filter names Tokens; the status lands on the heroes working those Tokens, and
         * `statementText.js` says so in the sentence.
         */
        id: KEYWORD.APPLIES,
        label: 'Applies',
        reach: true,
        /**
         * A scale multiplies the stacks applied. `Applies` has no palette row behind it, so it
         * declares its own scaled field here.
         */
        scales: 'stacks',
        blurb: 'Puts a status on the heroes working nearby Tokens — Well Fed, Poison, and the rest.',
        /**
         * An OPTIONAL role target: set, the role replaces the filter and reach. Only the enemy is
         * on offer, the one participant a filter of Tokens cannot name.
         */
        optionalRole: true,
        roles: [ROLE.OPPONENT],
        filter: true,
        when: WHEN.OPTIONAL,
        upkeep: true
    },
    {
        /**
         * The first keyword that acts on a person.
         *
         * ⚠️ A moment is REQUIRED: damage happens at an instant. The default is
         * `SELF_CYCLE_COMPLETE` (the Thorns case; one kill is one cycle).
         *
         * ⚠️ It targets a ROLE, not a tile, so it declares no `filter` and no `reach`.
         */
        id: KEYWORD.DEALS,
        label: 'Deals',
        scales: 'amount',
        blurb: 'Deals damage to somebody involved in the moment — the hero who just harvested or fought this.',
        filter: false,
        targetsRole: true,
        roles: [ROLE.SELF, ROLE.ACTOR, ROLE.SOURCE, ROLE.OPPONENT],
        when: WHEN.REQUIRED,
        upkeep: true
    },
    {
        /**
         * The mirror of `Deals`, sharing its shape. ⚠️ It never overheals: `modifyHeroHp` clamps
         * to max.
         */
        id: KEYWORD.HEALS,
        label: 'Heals',
        scales: 'amount',
        blurb: 'Restores health to somebody involved in the moment.',
        filter: false,
        targetsRole: true,
        roles: [ROLE.SELF, ROLE.ACTOR, ROLE.SOURCE, ROLE.OPPONENT],
        when: WHEN.REQUIRED,
        upkeep: true
    },
    {
        /**
         * Gives a Token charges back. ⚠️ Targets a tile, not a person: charges belong to a Token.
         * An unlimited Token ignores it, and `Charges.applyDelta` ceilings it at the authored
         * maximum.
         */
        id: KEYWORD.RESTORES,
        label: 'Restores',
        // Charges belong to a Token, so this aims at one by default.
        defaultRole: ROLE.SELF,
        scales: 'amount',
        blurb: 'Gives a Token some of its charges back.',
        filter: false,
        targetsRole: true,
        // Never the enemy: a creature has no charges to give back.
        roles: [ROLE.SELF, ROLE.ACTOR, ROLE.SOURCE],
        when: WHEN.REQUIRED,
        upkeep: true
    },
    {
        /**
         * The cleanse: takes live effects off a bearer (`LiveEffects.removeFrom`). Naming no effect
         * removes everything.
         */
        id: KEYWORD.REMOVES,
        label: 'Removes',
        blurb: 'Takes a lingering effect off somebody. Name one, or leave it blank to clear them all.',
        filter: false,
        targetsRole: true,
        roles: [ROLE.SELF, ROLE.ACTOR, ROLE.SOURCE, ROLE.OPPONENT],
        when: WHEN.REQUIRED,
        upkeep: true
    },
    {
        /**
         * Puts a Token on the board. ⚠️ Where it lands is an authored choice from a short list,
         * never a hidden fallback; see `placementRegistry.js`.
         */
        id: KEYWORD.SPAWNS,
        label: 'Spawns',
        blurb: 'Puts a Token on the board — where this one stands, or on a free tile.',
        filter: false,
        targetsRole: false,
        when: WHEN.REQUIRED,
        upkeep: true
    },
    {
        /**
         * This Token becomes another. ⚠️ A **fresh** instance: charges and
         * cooldowns belong to what it was, and carrying them across would give
         * the new Token a history it never had.
         */
        id: KEYWORD.TRANSFORMS,
        label: 'Transforms into',
        // "This Token becomes another" is about this Token.
        defaultRole: ROLE.SELF,
        blurb: 'This Token becomes a different Token, where it stands.',
        filter: false,
        targetsRole: true,
        // Never the enemy: a transform acts on a Token's square.
        roles: [ROLE.SELF, ROLE.ACTOR, ROLE.SOURCE],
        when: WHEN.REQUIRED,
        upkeep: true
    },
    {
        /**
         * ⚠️ This statement is the only thing that makes a Token a Station, and its skill is the
         * Token's whole recipe pool: `deriveTokenType` reads the keyword, `recipesForToken` the
         * payload. No filter, trigger or upkeep (a Token that stopped being a station when it ran
         * out of coal would be a trap).
         */
        id: KEYWORD.STATION,
        label: 'Works as',
        blurb: 'Makes this a station. It can run any recipe of the skill you pick.',
        filter: false,
        when: WHEN.NEVER,
        upkeep: false
    },
    {
        /**
         * Trains the hero standing on this Token into one job. Tokens only (`tokensOnly`): an item
         * has no cycle to train in.
         *
         * No `When` (the training cycle is implied), no filter or reach (it is about the hero on
         * THIS tile), no upkeep. "the hero" is fixed wording rather than a role slot, since it is
         * always whoever stands here.
         */
        id: KEYWORD.PROMOTES,
        label: 'Promotes',
        blurb: 'Trains the hero standing on this Token into one job.',
        filter: false,
        when: WHEN.NEVER,
        upkeep: false,
        tokensOnly: true
    }
]);

/** One keyword's rules, or null. */
export function getKeyword(id) {
    return KEYWORDS.find(k => k.id === id) || null;
}

/**
 * The roles a keyword may aim at, whatever the moment.
 *
 * One allowlist, read by the role picker (`statementSlots`) and by `ContentAudit`, so the
 * editor cannot offer what the audit would flag. A keyword with no role target has none.
 */
export function rolesForKeyword(keywordId) {
    return getKeyword(keywordId)?.roles || [];
}

/** Whether a keyword may aim at a role at all. */
export function keywordAllowsRole(keywordId, role) {
    return rolesForKeyword(keywordId).includes(role);
}

/**
 * Whether an `Applies` aims at a role instead of its filter.
 *
 */
export function appliesByRole(statement) {
    return statement?.keyword === KEYWORD.APPLIES && !!statement?.target?.role;
}

/**
 * The palette entries a keyword offers (`hasTrigger` is currently unused).
 */
export function paletteForKeyword(keywordId, hasTrigger) {
    if (keywordId === KEYWORD.PROVIDES) {
        // Provides changes a number; the item-carrying shapes have their own keywords (Grants,
        // Converts), so offering them here would be two ways to author one thing.
        return MODIFIER_PALETTE.filter(e => e.shape === 'deterministic' || e.shape === 'proc');
    }
    if (keywordId === KEYWORD.GRANTS) {
        return MODIFIER_PALETTE.filter(e => e.type === 'BONUS_DROP');
    }
    if (keywordId === KEYWORD.CONVERTS) {
        return MODIFIER_PALETTE.filter(e => e.type === 'CONVERT');
    }
    void hasTrigger;
    return [];
}

/**
 * What a triggered statement spends when it does not author a `chargeDelta`.
 *
 * -1. `Charges` imports the constant from here rather than declaring its own: the CMS
 * authoring control needs the same number and reads this file without the board runtime.
 *
 * ⚠️ The absence of the field is NOT `chargeDelta: 0`. An author who wants a free effect
 * writes a zero, which is why `makeStatement` stamps an explicit value.
 */
export const DEFAULT_STATEMENT_CHARGE_DELTA = -1;

/** A short, sortable, collision-proof statement id. */
export function newStatementId() {
    return `stm_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

/** The blank payload each keyword starts with. */
export function blankPayload(keywordId) {
    switch (keywordId) {
        case KEYWORD.PROVIDES:
            return { type: 'YIELD', bucket: 'percentage', value: 0 };
        case KEYWORD.GRANTS:
            return { type: 'BONUS_DROP', itemId: '', quantity: 1, chance: 100 };
        case KEYWORD.ACTS_AS:
            return { tag: '', tier: 1 };
        case KEYWORD.REQUIRES:
            return { tag: '', minTier: 1 };
        case KEYWORD.RESTOCKS:
            return { tokenIds: [] };
        case KEYWORD.CONVERTS:
            return { type: 'CONVERT', consumes: [], produces: [], chance: 100 };
        case KEYWORD.CANNOT:
            return blankRestriction();
        case KEYWORD.SPAWNS:
            return { typeId: '', placement: 'here' };
        case KEYWORD.TRANSFORMS:
            return { typeId: '' };
        case KEYWORD.HEALS:
            return { amount: 1 };
        case KEYWORD.RESTORES:
            return { amount: 1 };
        case KEYWORD.REMOVES:
            // Blank means "everything", which is the cure-all case.
            return { effectId: '' };
        case KEYWORD.DEALS:
            // `ignoresArmor` is written out rather than left absent so the editor shows a real
            // state: damage RESPECTS armour by default.
            return { amount: 1, ignoresArmor: false };
        case KEYWORD.APPLIES:
            // `effectId` attaches a library effect for a while. A `durationMs` of 0 means fire
            // it once, now (how chaining works).
            return { effectId: '', scale: 1, durationMs: 0, chance: 100, target: 'hero' };
        case KEYWORD.STATION:
            return { skill: '' };
        case KEYWORD.PROMOTES:
            return { jobId: '' };
        default:
            return {};
    }
}

/**
 * The moment a keyword that REQUIRES one is born with. Per keyword because `Deals` and
 * `Converts` want different answers; a statement born with a moment is never an unfireable
 * rule the editor can sit in.
 */
function defaultMoment(keywordId) {
    if ([KEYWORD.DEALS, KEYWORD.HEALS, KEYWORD.RESTORES, KEYWORD.REMOVES,
        KEYWORD.SPAWNS, KEYWORD.TRANSFORMS].includes(keywordId)) {
        // The Thorns case: a cycle completed targeting this entity (a hero harvesting a bush
        // and a hero killing a monster alike).
        return { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 };
    }
    return { event: 'ITEM_THRESHOLD', scope: 'global', watchItemId: '', threshold: 1, cooldownMs: 5000 };
}

/**
 * A new statement, legal by construction: a keyword that requires a `When` is born with one.
 */
export function makeStatement(keywordId, data = {}) {
    const keyword = getKeyword(keywordId);
    const statement = {
        id: newStatementId(),
        keyword: keywordId,
        payload: blankPayload(keywordId),
        /**
         * Stamped on every keyword. A rule that can fire is born costing 1 per firing; one that
         * cannot is born costing NOTHING, so an aura never starts wearing its Token down.
         * Written out rather than absent so the editor shows a real number and an explicit 0
         * stays distinguishable from a blank.
         */
        chargeDelta: keyword?.when !== WHEN.NEVER ? DEFAULT_STATEMENT_CHARGE_DELTA : 0,
        to: keyword?.filter ? { mode: 'all', value: '' } : null,
        /**
         * Written out on the keywords that can carry one, like `to`.
         *
         * ⚠️ Its absence still means `nearby`: `reachOf` owns that default; this only decides
         * what a NEW statement starts as.
         */
        reach: keyword?.reach ? DEFAULT_REACH : null,
        /**
         * Who the statement acts on, as a role rather than a tile filter. Only the keywords
         * that act on a participant carry one; everything else aims with `to` and `reach`.
         */
        /**
         * ⚠️ The default target is per keyword: `Restores` and `Transforms` resolve a TILE from
         * the role, so defaulting to the hero would leave an unstaffed Token unable to transform
         * or repair itself.
         */
        target: keyword?.targetsRole ? { role: keyword.defaultRole || ROLE.ACTOR } : null,
        when: keyword?.when === WHEN.REQUIRED ? defaultMoment(keywordId) : null,
        upkeep: null,
        ...data
    };
    return statement;
}

/**
 * A Token's statements.
 *
 * ⚠️ `effectBlocks` is not read here, deliberately: old-shape content is not migrated or
 * reinterpreted. It simply has no statements and `ContentAudit` names it at boot.
 */
export function statementsOf(def) {
    return Array.isArray(def?.statements) ? def.statements : [];
}

/** Statements of one keyword. */
export function statementsWith(def, keywordId) {
    return statementsOf(def).filter(s => s?.keyword === keywordId);
}

/** Keywords that are about neighbours by definition — no reach field to read. */
const NEIGHBOUR_KEYWORDS = new Set([KEYWORD.ACTS_AS, KEYWORD.REQUIRES, KEYWORD.RESTOCKS, KEYWORD.CANNOT]);

/**
 * Whether any of a Token's rules act on, or depend on, what is NEAR it (the rule for showing
 * its Near ring).
 *
 * Yes for: `Acts as`, `Requires`, `Restocks` and `Cannot`; `Provides`, `Grants` and `Applies`
 * reaching past the Token itself; a "when a nearby Token..." moment; a "for each nearby..."
 * count.
 *
 * ⚠️ Not for a `board` reach: it covers the whole mat, so a Near-sized ring would misstate
 * it. Not for an `Applies` aimed at a role: the role replaces the reach. Spawns land by their
 * own placement rule, not by reach.
 */
export function caresAboutNeighbours(def) {
    const near = (reachId) => reachId !== REACH.SELF && reachId !== REACH.BOARD;
    return statementsOf(def).some(statement => {
        if (!statement) return false;
        if (NEIGHBOUR_KEYWORDS.has(statement.keyword)) return true;
        if (statement.when?.scope === 'nearby') return true;
        if (statement.counted && near(reachOf(statement.counted))) return true;
        const keyword = KEYWORDS.find(k => k.id === statement.keyword);
        if (!keyword?.reach) return false;
        if (statement.keyword === KEYWORD.APPLIES && statement.target?.role) return false;
        return near(reachOf(statement));
    });
}

/**
 * The job a Token's `Promotes` rule names, or null. The first one with a job wins; a Token
 * carrying two is an authoring mistake the engine should not guess about.
 */
export function promotedJobOf(def) {
    for (const statement of statementsWith(def, KEYWORD.PROMOTES)) {
        if (statement?.payload?.jobId) return statement.payload.jobId;
    }
    return null;
}

/**
 * The skill a Token's `Works as` statement names, or null if it has none.
 *
 * Both halves of station-ness resolve through this: `deriveTokenType` calls a
 * Token with one of these a `station`, and `recipesForToken` returns that
 * skill's pool. A Token with several takes the first — the shape allows more
 * than one, nothing reads past the first, and no authored Token has two.
 */
export function stationSkillOf(def) {
    for (const statement of statementsWith(def, KEYWORD.STATION)) {
        if (statement?.payload?.skill) return statement.payload.skill;
    }
    return null;
}

/**
 * The capabilities a Token hands its neighbours, as `{ [tag]: highestTier }`.
 *
 * The authored channel is the `Acts as` statement; `def.provides` survives as a read-only
 * fallback for fixtures. Tier comes from the statement's own Tool Tier, falling back to the
 * Token's `tier`, then 1.
 *
 * @param {object} def
 * @returns {Record<string, number>}
 */
export function getProvidedTagsWithTiers(def) {
    if (!def) return {};
    const map = {};
    const defaultTier = def.tier || 1;
    const offer = (tag, tier) => {
        if (!tag) return;
        map[tag] = Math.max(map[tag] || 0, tier || defaultTier);
    };

    // 1. The authored channel: `Acts as` statements.
    for (const statement of statementsWith(def, KEYWORD.ACTS_AS)) {
        offer(statement?.payload?.tag, statement?.payload?.tier);
    }

    // 2. Legacy: a top-level `provides` list, as strings or `{tag, tier}`.
    for (const entry of def.provides || []) {
        if (typeof entry === 'string') offer(entry, defaultTier);
        else if (entry && typeof entry === 'object') offer(entry.tag, entry.tier);
    }

    return map;
}

/**
 * Whether a Token still carries the retired shape and therefore does nothing.
 *
 * Both the old container names count: `effectBlocks` was the array, and `buff`
 * was the single-block form that preceded it.
 */
export function hasRetiredEffectData(def) {
    if (Array.isArray(def?.effectBlocks) && def.effectBlocks.length) return true;
    return !!def?.buff;
}

/**
 * The palette entry a `Provides` statement is scaling, or null.
 * Convenience for the renderer and the editor, which both need it.
 */
export function effectEntryOf(statement) {
    return getPaletteEntry(statement?.payload?.type);
}
