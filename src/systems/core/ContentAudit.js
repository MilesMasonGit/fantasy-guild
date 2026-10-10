// Boot-time content-integrity audit: warns about content references that do not resolve.

import { TOKENS, getTokenType, getProvidedTagsWithTiers } from '../../config/registries/tokenRegistry.js';
import { statementsOf, hasRetiredEffectData, stationSkillOf, KEYWORD, getKeyword, keywordAllowsRole } from '../effects/statements.js';
import { getTriggerEvent, momentSupplies } from '../../config/registries/triggerRegistry.js';
import { getRole } from '../../config/registries/roleRegistry.js';
import { getReach, DEFAULT_REACH } from '../../config/registries/reachRegistry.js';
import { filtersOf, getFilterKind, FILTER_NEEDS } from '../../config/registries/filterRegistry.js';
import { deriveTokenType } from '../../config/registries/tokenTypeDerivation.js';
import { isOutputCurrency } from '../../config/registries/tokenConstants.js';
import { getStatusEffect } from '../../config/registries/statusRegistry.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { EFFECTS, getEffect } from '../../config/registries/effectRegistry.js';
import { effectRefsOf, duplicateRefsOf, hasWorkingStatements, usedBy } from '../effects/effectLibrary.js';
import { ITEMS, getItem } from '../../config/registries/itemRegistry.js';
import { isMapItem, mapItemFindings } from '../atlas/mapItems.js';
import { listPooledSkillIds } from '../../config/registries/recipePoolRegistry.js';
import { SPRITE_MANIFEST } from '../../config/registries/sprite-manifest.js';
import { RANDOM_HUNTS } from '../quests/QuestManager.js';
import { warnMissingContent } from '../../utils/missingContent.js';
import { isWorkedWithoutSkill, WORK_SKILL_WHY } from './workSkillRule.js';
import { auditLifecycleBlocks } from './lifecycleAudit.js';
import { findUnknownRefs } from './unknownRefRule.js';
import { SKILLS } from '../../config/registries/skillRegistry.js';
import { listRecipes } from '../../config/registries/recipePoolRegistry.js';

/**
 * ContentAudit — one pass over every cross-reference in the content set,
 * reporting the ones that do not resolve.
 *
 * Registry accessors end `return X[id] || null` and every caller survives a
 * null, so a missing definition looks like ordinary gameplay. This makes it
 * visible.
 *
 * It only WARNS: nothing here blocks boot, throws or repairs, because the
 * content set is deliberately half-authored. Every step is wrapped so a
 * malformed definition produces a report line, never an exception.
 * Output is written for the content author: what is broken, where, and what
 * it points at.
 */

/** Every reference kind the audit knows how to follow, and how to resolve it. */
const RESOLVERS = {
    Token: id => !!getTokenType(id),
    item: id => !!getItem(id),
    // `enemy` resolves through the Token registry: an enemy IS a Token, so its id is a Token id.
    enemy: id => !!getTokenType(id),
    sprite: id => !!SPRITE_MANIFEST[id],
    status: id => !!getStatusEffect(id),
    'recipe pool': id => listPooledSkillIds().includes(id)
};

/**
 * One finding. `where` is where a person would go to fix it; `what` says what
 * is wrong in a sentence they can act on.
 */
function finding(where, what) {
    return { where, what };
}

/**
 * Check one reference and, if it dangles, describe it.
 *
 * A blank or missing reference is NOT a finding: an unset field is how content
 * says "this Token has no enemy", and flagging those would bury the real
 * results under hundreds of lines of noise.
 */
function checkRef(out, where, kind, value, role) {
    if (value === null || value === undefined || value === '') return;
    const resolve = RESOLVERS[kind];
    if (!resolve) return;
    let ok;
    try {
        ok = resolve(value);
    } catch {
        // A resolver that throws means the reference is unusable, which is the
        // same practical answer as "does not exist".
        ok = false;
    }
    if (!ok) {
        out.push(finding(where, `${role} points at the ${kind} "${value}", which does not exist`));
    }
}

/**
 * Items: their effect references. An item is a bearer, so it can dangle
 * like a Token: a renamed or deleted entry, or one entry named twice.
 */
function auditItemEffects(out) {
    for (const [itemId, def] of Object.entries(ITEMS || {})) {
        const where = `Item "${itemId}"`;

        for (const { effectId } of effectRefsOf(def)) {
            if (!getEffect(effectId)) {
                out.push(finding(where,
                    `one of its rules points at the effect "${effectId}", which does not exist — ` +
                    `it was probably renamed or deleted in the CMS. The item carries no rule from it.`));
            }
        }

        for (const effectId of duplicateRefsOf(def)) {
            out.push(finding(where,
                `names the effect "${effectId}" more than once. A hero's loadout merges duplicates ` +
                `(their scales add, capped at 5), so the second reference adds nothing — remove it ` +
                `and raise the scale instead.`));
        }
    }
}

/** Tokens: their recipes, their effects, and the things they open onto. */
function auditTokens(out) {
    for (const [tokenId, def] of Object.entries(TOKENS || {})) {
        const where = `Token "${tokenId}"`;
        if (!def || typeof def !== 'object') {
            out.push(finding(where, 'has no definition behind it'));
            continue;
        }

        checkRef(out, where, 'sprite', def.sprite, 'Its artwork');
        checkRef(out, where, 'recipe pool', stationSkillOf(def), 'The skill it works as');

        // A hero-worked Token must name a skill. Reported only.
        if (isWorkedWithoutSkill(def)) {
            out.push(finding(where, `is worked by a hero but names no skill. ${WORK_SKILL_WHY}`));
        }

        for (const input of def.config?.inputs || []) {
            checkRef(out, where, 'item', input?.itemId, 'An ingredient it consumes');
        }
        for (const output of def.config?.outputs || []) {
            // An output pays in an item OR in currency — never both,
            // never neither. A row with neither is an authoring slip that reads
            // as a real payout and quietly produces nothing.
            if (!output?.itemId && !output?.currency) {
                out.push(finding(where, 'has an output row that names neither an item nor a currency, so it produces nothing'));
                continue;
            }
            if (output.currency && !isOutputCurrency(output.currency)) {
                out.push(finding(where,
                    `pays out in "${output.currency}", which is not a currency a Token may mint`));
            }
            checkRef(out, where, 'item', output?.itemId, 'Something it produces');
        }

        auditRetiredEffectShape(out, where, def);
        auditEffectRefs(out, where, def);
        auditCombatAxes(out, where, def);
        auditStatements(out, where, def);
        auditDerivedType(out, where, def);
    }

    auditCapabilityTags(out);
}

/**
 * A bearer's references into the named effect library. A ref naming a renamed
 * or deleted entry resolves to nothing: the Token still loads and plays, with
 * one rule fewer.
 */
function auditEffectRefs(out, where, def) {
    for (const { effectId } of effectRefsOf(def)) {
        if (!getEffect(effectId)) {
            out.push(finding(where,
                `one of its rules points at the effect "${effectId}", which does not exist — ` +
                `it was probably renamed or deleted in the CMS. The Token loads without that rule.`));
        }
    }

    /**
     * One bearer naming one entry twice.
     *
     * Not a style problem: both copies expand to statements carrying the **same
     * statement id**, and per-statement state (`instance.blockUpkeep[id]`,
     * `instance.blockCooldowns[id]`) is keyed by that id — so one upkeep clock
     * and one cooldown would be shared between two rules that are meant to be
     * separate. "Twice as strong" is the `scale` field, not the same effect
     * listed twice.
     */
    for (const effectId of duplicateRefsOf(def)) {
        out.push(finding(where,
            `names the effect "${effectId}" more than once. Two copies share one upkeep ` +
            `clock and one cooldown, so the second does not behave as its own rule — ` +
            `remove the duplicate and use the effect's scale instead.`));
    }
}

/**
 * A combat number on a Token that is not an enemy reaches nobody.
 *
 * `CombatFormulas` reads Armor, Accuracy, Block, Resistance and Damage off a
 * **hero's** aggregator, and only two things write there: an item, which lends
 * its numbers to the hero carrying it, and an enemy, which lends them to the
 * hero fighting it. A Forge with `Provides Armor` is authored, saved, loaded and
 * read by nothing — the "authored but inert" failure this project keeps paying
 * for, so it is named out loud instead.
 */
function auditCombatAxes(out, where, def) {
    if (isEnemyDef(def)) return;

    for (const statement of statementsOf(def)) {
        if (statement?.keyword !== KEYWORD.PROVIDES) continue;
        const entry = getPaletteEntry(statement.payload?.type);
        if (!entry?.heroOnly) continue;

        out.push(finding(where,
            `has a ${entry.label} rule, but that only reaches a hero from an item they ` +
            `carry or an enemy they fight — this Token is neither, so the rule does nothing. ` +
            `Put it on an item, or on an enemy Token.`));
    }
}

/**
 * The library itself: a named effect that wraps no working statement is
 * reported by name every boot. An unreferenced entry is a softer finding
 * (mid-authoring content is normal), reported so forgotten entries can be found.
 */
function auditEffects(out) {
    for (const [effectId, entry] of Object.entries(EFFECTS || {})) {
        const where = `Effect "${entry?.name || effectId}"`;

        if (!hasWorkingStatements(entry)) {
            out.push(finding(where,
                'is a name with no working rule behind it. A named effect must wrap at least ' +
                'one statement that names a keyword — open it in the CMS and give it a rule, ' +
                'or delete it.'));
            continue;
        }

        // Items carry their rules here, not inline, so the target-shape
        // tripwires have to read the library too.
        auditAppliesTargetShape(out, where, entry);

        if (usedBy(effectId, TOKENS || {}, ITEMS || {}).length === 0) {
            out.push(finding(where, 'is not used by anything. Not a fault if you are still ' +
                'building what it is for — but nothing references it today.'));
        }
    }
}

/**
 * Old-shape effect data (`effectBlocks`) is deliberately not migrated and not
 * reinterpreted: a half-translation that quietly does something slightly
 * different is worse. Such a Token loads and plays with no rules, so this
 * must be impossible to miss.
 */
function auditRetiredEffectShape(out, where, def) {
    if (!hasRetiredEffectData(def)) return;

    const blocks = Array.isArray(def.effectBlocks) ? def.effectBlocks : [def.buff];
    const parts = [];
    for (const block of blocks) {
        for (const mod of block?.modifiers || []) {
            parts.push(mod?.type === 'BONUS_DROP' ? 'a Grants rule' : `a Provides rule (${mod?.type})`);
        }
        for (const tag of block?.provides || []) {
            parts.push(`an Acts as rule (${typeof tag === 'string' ? tag : tag?.tag})`);
        }
        if (block?.cost?.items?.length) parts.push('an upkeep cost');
    }

    const summary = parts.length
        ? `It needs re-authoring as: ${[...new Set(parts)].join(', ')}.`
        : 'It carried no working rule anyway, so nothing was lost — delete the empty block.';

    out.push(finding(where,
        'still uses the RETIRED "effect blocks" shape, so it currently does nothing in game. ' +
        `Open it in the CMS and rebuild its rules in the Rules section. ${summary}`));
}

/**
 * ⚠️ **Two tripwires on how a rule names who it reaches**.
 *
 * 1. **A leftover `payload.target`.** The retired `target: 'enemy'` flag is
 *    converted to the enemy role on load, by the game and the CMS alike, and
 *    the runtime no longer reads it. So one still present means a load path
 *    that skipped the conversion, or a value the flag never had — either way it
 *    is stored and read by nothing, which is exactly what this file names.
 * 2. **An `Applies` with a role AND a filter or reach.** A role replaces the
 *    filter and the reach, so an authored Coast filter or a board-wide
 *    reach beside it is silently ignored. The blank defaults every new
 *    statement is born with (`mode: 'all'`, nearby) say nothing and are not
 *    reported.
 */
function auditAppliesTargetShape(out, where, def) {
    for (const statement of statementsOf(def)) {
        const payload = statement?.payload;
        if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'target')) {
            out.push(finding(where,
                `one of its rules still carries the retired "target: ${String(payload.target)}" setting, ` +
                `which nothing reads any more — so it does not decide who the rule reaches. To aim at the ` +
                `creature a hero is fighting, set "aims at" to the enemy in the CMS.`));
        }

        if (statement?.keyword !== KEYWORD.APPLIES || !statement?.target?.role) continue;
        const to = statement.to;
        const filtered = (to?.mode && to.mode !== 'all') || filtersOf(to).length > 0;
        const reached = !!statement.reach && statement.reach !== DEFAULT_REACH;
        if (filtered || reached) {
            const role = getRole(statement.target.role)?.label || statement.target.role;
            const what = [filtered && 'a target filter', reached && 'a reach'].filter(Boolean).join(' and ');
            out.push(finding(where,
                `one of its "Applies" rules aims at ${role} and also carries ${what} — the role replaces ` +
                `both, so the ${filtered && reached ? 'filter and reach are' : filtered ? 'filter is' : 'reach is'} ` +
                `stored and read by nothing. Clear ${filtered && reached ? 'them' : 'it'}, or clear the role.`));
        }
    }
}

/** Every reference a statement can make, followed. */
function auditStatements(out, where, def) {
    auditAppliesTargetShape(out, where, def);
    for (const statement of statementsOf(def)) {
        const payload = statement?.payload || {};

        if (statement?.to?.mode === 'id') {
            checkRef(out, where, 'Token', statement.to.value, 'The Token one of its rules targets');
        }
        checkRef(out, where, 'item', payload.itemId, 'An item one of its rules grants');
        for (const entry of [...(payload.consumes || []), ...(payload.produces || [])]) {
            checkRef(out, where, 'item', entry?.itemId, 'An item one of its Converts rules moves');
        }
        for (const tokenId of payload.tokenIds || []) {
            checkRef(out, where, 'Token', tokenId, 'A Token one of its rules names');
        }
        for (const entry of statement?.upkeep?.items || []) {
            checkRef(out, where, 'item', entry?.itemId, 'An item one of its rules costs to run');
        }
        checkRef(out, where, 'item', statement?.when?.watchItemId, 'The item one of its rules watches for');
        checkRef(out, where, 'status', payload.statusId, 'The status one of its rules applies');

        // A trigger that watches for a *specific* item and was never told which
        // one fires on nothing — and reads in the picker as if it were the
        // coarse "a neighbour completes a cycle" trigger sitting above it.
        const trigger = getTriggerEvent(statement?.when?.event);
        if (trigger?.needsItem && !statement.when.watchItemId) {
            out.push(finding(where,
                `one of its rules waits for a neighbour to produce a specific item but never says which, so it never fires`));
        }

        // A tag nothing carries reaches nothing — silent today, and the most
        // common authoring slip there is (a capital letter in the wrong place).
        if (statement?.to?.mode === 'tag' && statement.to.value && !tokenTagsInUse().has(statement.to.value)) {
            out.push(finding(where,
                `one of its rules aims at Tokens tagged "${statement.to.value}", and no Token carries that tag — so it reaches nothing`));
        }

        /**
         * ⚠️ **A filter on a keyword that cannot aim.**
         *
         * Checked structurally by *legality*, not by runtime: a `to` on a keyword
         * whose grammar declares `filter: false` is data no reader will ever
         * honour, whichever system consumes the keyword.
         */
        const keyword = getKeyword(statement?.keyword);
        if (statement?.to?.mode && keyword && !keyword.filter) {
            out.push(finding(where,
                `one of its rules is a "${keyword.label}" carrying a target filter, and that keyword cannot aim — ` +
                `the filter is stored, shown in the sentence, and read by nothing. Clear it, or use a keyword that targets.`));
        }

        // The same invariant on the reach axis: a reach on a keyword that cannot carry one is read by nothing.
        if (statement?.reach && keyword && !keyword.reach) {
            out.push(finding(where,
                `one of its rules is a "${keyword.label}" carrying a reach, and that keyword has no reach to vary — ` +
                `it is stored and read by nothing. Clear it.`));
        }

        /**
         * ⚠️ **A target may only name a role its moment supplies.**
         *
         * The rule that keeps the targeting vocabulary bounded, enforced here so
         * that content authored before a moment's roles narrowed — or through a
         * hand-edited file — cannot sit there aiming at nobody. A rule targeting
         * "the actor" on *"a neighbour runs out of charges"* reaches nothing
         * whatever the board looks like, because a Token running dry has no
         * actor: it is not a bad board state, it is a rule that can never work.
         */
        const targetRole = statement?.target?.role;
        if (targetRole && !momentSupplies(statement?.when?.event, targetRole)) {
            const moment = getTriggerEvent(statement?.when?.event);
            const where_ = moment ? `"${moment.label}"` : 'a rule with no firing moment';
            out.push(finding(where,
                `one of its rules aims at ${getRole(targetRole)?.label || targetRole}, but ${where_} ` +
                `never supplies one — so the rule reaches nobody, on any board. Pick a moment that has ` +
                `one, or aim somewhere else.`));
        }

        /**
         * ⚠️ **A keyword may only aim at the roles it allows.** The same
         * allowlist the role picker reads, so a "Restores … to the enemy" that
         * arrived by hand-edit or import is named rather than silently inert.
         */
        if (targetRole && keyword?.roles && !keywordAllowsRole(keyword.id, targetRole)) {
            out.push(finding(where,
                `one of its rules is a "${keyword.label}" aimed at ${getRole(targetRole)?.label || targetRole}, ` +
                `and a "${keyword.label}" can never aim there — so the rule reaches nobody. Aim somewhere else.`));
        }

        /**
         * ⚠️ **A state filter on a rule read at placement time can never pass.**
         *
         * `Cannot` is evaluated by `Placement.js` at the instant a Token is put
         * down, against the DEFINITIONS around it — there is no live instance to
         * ask how worn a neighbour is, and no cycle in progress to ask who is
         * working it. `matchesFilters` refuses a filter it cannot evaluate, so
         * such a rule refuses every placement check silently. The author is told
         * here rather than left to wonder why the restriction never triggers.
         */
        if (statement?.keyword === KEYWORD.CANNOT) {
            for (const entry of filtersOf(statement.to)) {
                const kind = getFilterKind(entry.kind);
                if (kind && kind.needs !== FILTER_NEEDS.DEF) {
                    out.push(finding(where,
                        `one of its "Cannot" rules filters on "${kind.label}", which is about a Token's ` +
                        `live state — and a placement rule is checked before any of that exists, so the ` +
                        `rule can never match. Filter on a tag or a kind of Token instead.`));
                }
            }
        }

        /**
         * ⚠️ **`EFFECT_TICK` only fires on a CARRIED effect.**
         *
         * `LiveEffects.tick` walks the instances a hero is carrying and fires
         * their `EFFECT_TICK` statements. Nothing walks a Token's or an item's
         * statements looking for that moment, so a rule authored with it on a
         * bearer renders a perfectly good sentence and never fires — the
         * authored-but-inert failure, arriving through the moment picker.
         *
         * The reverse is worth knowing too and is NOT an error: a library entry
         * may legitimately be both applied to somebody and sat on a Token, and
         * only its `EFFECT_TICK` half would be dormant in the second place.
         * So this is reported on the BEARER, where the mistake actually is.
         */
        if (statement?.when?.event === 'EFFECT_TICK') {
            out.push(finding(where,
                `one of its rules fires "every few seconds, while carried" — but that only happens to ` +
                `an effect somebody is CARRYING, and this is a Token. The rule never fires here. ` +
                `Apply the effect to a hero for it to tick, or pick a moment this Token has.`));
        }

        // A reach the vocabulary does not have resolves to "nearby" rather
        // than to nothing, so a typo does not switch a rule off — but it does
        // mean the rule is not doing what its author typed.
        if (statement?.reach && !getReach(statement.reach)) {
            out.push(finding(where,
                `one of its rules asks to reach "${statement.reach}", which is not a reach the game has — ` +
                `it falls back to nearby Tokens. Pick one from the list in the CMS.`));
        }
    }
}

/**
 * Whether the type written in the file still matches what the Token *is*.
 *
 * Since type is derived (`tokenTypeDerivation.js`) and written at sync, a
 * mismatch means the file was edited by hand or the Token has changed since its
 * last sync — either way the sidebar is grouping it wrongly.
 */
function auditDerivedType(out, where, def) {
    // A Token still on the retired shape already has its own line, which says
    // exactly what to rebuild. Adding "and by the way it now reads as a buff"
    // underneath it is the same news twice, and three lines per Token is how an
    // audit stops being read.
    if (hasRetiredEffectData(def)) return;

    const { type, why, warn } = deriveTokenType(def);

    if (def.tokenType && def.tokenType !== type) {
        out.push(finding(where,
            `is filed as a "${def.tokenType}" but reads as a "${type}", because ${why}. Re-syncing from the CMS will refile it`));
        return;
    }
    if (warn) {
        out.push(finding(where, `reads as a ${type} because ${why}`));
    }
}

/**
 * Capability tags with no provider. `acceptedTokens[].tag` is a free string
 * matched against provided tags; a Token asking for a `pikaxe` never runs and
 * nothing else says so.
 */
function auditCapabilityTags(out) {
    const provided = new Set();
    for (const def of Object.values(TOKENS || {})) {
        for (const tag of Object.keys(getProvidedTagsWithTiers(def))) provided.add(tag);
    }

    for (const [tokenId, def] of Object.entries(TOKENS || {})) {
        for (const requirement of def?.acceptedTokens || []) {
            const tag = requirement?.tag;
            if (!tag) continue;
            if (!provided.has(tag)) {
                out.push(finding(`Token "${tokenId}"`,
                    `needs a nearby "${tag}", and no Token provides that capability — so it can never work`));
            }
        }
    }
}

/** Every tag any Token carries, for the targeting check above. */
function tokenTagsInUse() {
    const tags = new Set();
    for (const def of Object.values(TOKENS || {})) {
        for (const tag of def?.tags || []) tags.add(tag);
    }
    return tags;
}

/** Items: artwork, plus the authoring slips that produce a nameless entry. */
function auditItems(out) {
    for (const [itemId, def] of Object.entries(ITEMS || {})) {
        const where = `Item "${itemId}"`;
        if (!def || typeof def !== 'object') {
            out.push(finding(where, 'has no definition behind it'));
            continue;
        }
        // An item whose id is literally "item" with every field blank is an authoring slip that reads as a real item; a blank name is the tell.
        if (!def.name) {
            out.push(finding(where, 'has no name — it looks like a half-finished entry that was saved by accident'));
        }
        checkRef(out, where, 'sprite', def.sprite, 'Its artwork');
    }
}

// Enemy drops are not audited here: enemies are Tokens, so the Token walk
// already checks their outputs, and a second pass would report each finding twice.

/**
 * Map and Modifier items: the Tokens their Cartography block names, and a map that writes nothing.
 * The rule lives in `mapItems.js`, shared with the CMS Economy Audit.
 */
function auditMapItems(out) {
    const tokenExists = id => !!getTokenType(id);
    for (const [itemId, def] of Object.entries(ITEMS || {})) {
        if (!isMapItem(def)) continue;
        for (const what of mapItemFindings(def, { tokenExists, itemOf: getItem })) {
            out.push(finding(`Item "${itemId}"`, what));
        }
    }
}

/**
 * The lists written by hand in the game's own code rather than authored in the
 * CMS. Three of them have named ids that do not exist at some point, and a
 * CMS-side check would have caught none of them — which is why the audit lives
 * on the game side.
 */
function auditHardcodedLists(out, openingTokens) {
    // Passed in rather than imported: this list lives in `EngineBootstrap`,
    // which calls the audit, and importing it back would make the two modules
    // depend on each other in a circle.
    const opening = openingTokens || [];
    opening.forEach((typeId, i) => {
        checkRef(out, 'The Tokens a new game starts with', 'Token', typeId,
            `Opening Token ${i + 1} of ${opening.length}`);
    });

    for (const hunt of RANDOM_HUNTS || []) {
        checkRef(out, 'The randomly-generated hunt bounties', 'enemy', hunt?.id,
            `The bounty "${hunt?.name || hunt?.id}"`);
    }
}

/**
 * Token Lifecycle blocks: spawner, grows, turns, foundation, shop, trickle (Passive Production), and
 * recipes that build on a Foundation. The rules live in `lifecycleAudit.js`,
 * shared with the CMS Economy Audit so both name the same problems in the same words.
 */
function auditLifecycle(out) {
    const findings = auditLifecycleBlocks({
        tokens: TOKENS,
        items: ITEMS,
        recipes: listRecipes(),
        skills: SKILLS,
    });
    for (const f of findings) {
        const where = `${f.entityType} "${f.entityId}"`;
        out.push(finding(where, f.severity === 'warning' ? `(allowed) ${f.message}` : f.message));
    }
}

/**
 * Skills and jobs named in content that the game does not have. The rule lives
 * in `unknownRefRule.js`, shared with the CMS Economy Audit.
 */
function auditUnknownRefs(out) {
    for (const f of findUnknownRefs({ tokens: TOKENS, items: ITEMS, recipes: listRecipes() })) {
        out.push(finding(`${f.entityType} "${f.entityId}"`, f.message));
    }
}

/**
 * Walk everything and return the findings.
 * Exported separately from the reporting so a test can assert on the list.
 */
export function auditContent({ openingTokens = [] } = {}) {
    const out = [];
    const steps = [auditTokens, auditEffects, auditItems, auditItemEffects, auditLifecycle, auditUnknownRefs, auditMapItems, auditHardcodedLists];
    for (const step of steps) {
        try {
            step(out, openingTokens);
        } catch (error) {
            out.push(finding('The content check itself',
                `could not finish one of its passes (${error?.message || error}) — the results below may be incomplete`));
        }
    }
    return out;
}

/**
 * Run the audit and print it. Called once from `EngineBootstrap.init()`.
 *
 * Returns the findings so a caller can do something else with them; the game
 * ignores the return value on purpose.
 */
export function reportContentIntegrity(options) {
    let findings;
    try {
        findings = auditContent(options);
    } catch (error) {
        // Belt and braces. The audit must never be the reason a boot fails.
        console.warn('[Content check] Could not run:', error);
        return [];
    }

    if (findings.length === 0) {
        console.info('[Content check] Every content reference resolves. Nothing broken.');
        return findings;
    }

    // Group by location so one broken Token reads as one entry with its
    // problems under it, rather than as five unrelated lines.
    const byWhere = new Map();
    for (const f of findings) {
        if (!byWhere.has(f.where)) byWhere.set(f.where, []);
        byWhere.get(f.where).push(f.what);
    }

    const lines = [];
    for (const [where, whats] of byWhere) {
        lines.push(`  ${where}`);
        for (const what of whats) lines.push(`      - ${what}`);
    }

    console.warn(
        `[Content check] ${findings.length} broken reference(s) across ${byWhere.size} place(s).\n` +
        'These point at content that does not exist. The game will run anyway — the\n' +
        'affected things will simply do nothing, quietly, which is why this is worth reading.\n\n' +
        lines.join('\n')
    );

    return findings;
}

// ---------------------------------------------------------------------------
// The same pass, over a loaded SAVE rather than the authored content set
// ---------------------------------------------------------------------------

/**
 * A save can hold ids of Tokens that were later renamed or deleted, and
 * loading it is otherwise silent.
 *
 * It REPORTS only: it never repairs or deletes. Dropping unresolvable entries
 * would delete the player's property on the strength of the registry being
 * complete, and a Token that looks missing may be halfway through a rename.
 * Nothing in this section writes to the save.
 *
 * Reporting goes through `warnMissingContent`, so each name is said once per
 * page life, not once per slot loaded.
 */

/**
 * Every place in a save that names a piece of content, and how a person would
 * describe that place to themselves. The wording finishes the sentence
 * "your saved game still holds it …".
 */
function collectSaveRefs(state, note) {
    const board = state?.board || {};

    for (const token of Object.values(board.tokens || {})) {
        note('Token', token?.typeId, 'on the playmat');
    }

    for (const itemId of Object.keys(state?.inventory?.items || {})) {
        note('item', itemId, 'in the Bank');
    }
    for (const hero of state?.heroes || []) {
        for (const itemId of hero?.equipment || []) {
            note('item', itemId, `equipped by ${hero?.name || 'a hero'}`);
        }
    }
}

/**
 * Walk a loaded save and return every content id in it that resolves to
 * nothing, one entry per id with all the places it was found.
 *
 * Exported separately from the reporting so a test can assert on the list.
 *
 * @param {object} state  A rehydrated game state (`GameState.state`).
 * @returns {Array<{kind: string, id: string, places: string[]}>}
 */
export function auditSaveContent(state) {
    /** @type {Map<string, {kind: string, id: string, places: Set<string>}>} */
    const ghosts = new Map();

    const note = (kind, id, place) => {
        if (id === null || id === undefined || id === '') return;
        const resolve = RESOLVERS[kind];
        if (!resolve) return;
        let ok;
        try {
            ok = resolve(id);
        } catch {
            ok = false;
        }
        if (ok) return;

        const key = `${kind}|${id}`;
        if (!ghosts.has(key)) ghosts.set(key, { kind, id, places: new Set() });
        ghosts.get(key).places.add(place);
    };

    collectSaveRefs(state, note);

    return [...ghosts.values()].map(g => ({ kind: g.kind, id: g.id, places: [...g.places] }));
}

/** "a", "a and b", "a, b and c" — so the line reads as a sentence. */
function joinPlaces(places) {
    if (places.length <= 1) return places[0] || '';
    return `${places.slice(0, -1).join(', ')} and ${places[places.length - 1]}`;
}

/**
 * Run the save pass and say what it found. Called once per load, from the
 * `game_loaded` subscription in `EngineBootstrap`.
 *
 * A save with nothing wrong says nothing at all — the boot audit's "everything
 * resolves" line is worth printing once per session, but once per slot change
 * would be noise.
 *
 * @returns {Array} The ghosts found, for a caller that wants them.
 */
export function reportSaveContent(state) {
    let ghosts;
    try {
        ghosts = auditSaveContent(state);
    } catch (error) {
        // Belt and braces, exactly as above: this must never be the reason a
        // load fails.
        console.warn('[Saved game check] Could not run:', error);
        return [];
    }

    for (const ghost of ghosts) {
        warnMissingContent('Saved game', ghost.kind, ghost.id,
            `your saved game still holds it ${joinPlaces(ghost.places)}, and it can no longer be used`,
            'Nothing has been removed from your saved game. If this name is part of a ' +
            'rename you have not finished, it will start working again the moment the ' +
            'new name matches.');
    }

    return ghosts;
}

export default reportContentIntegrity;
