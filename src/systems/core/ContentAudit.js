// Fantasy Guild — boot-time content-integrity audit (CR2-108)

import { TOKENS, getTokenType, getProvidedTagsWithTiers } from '../../config/registries/tokenRegistry.js';
import { statementsOf, hasRetiredEffectData, stationSkillOf } from '../effects/statements.js';
import { getTriggerEvent } from '../../config/registries/triggerRegistry.js';
import { deriveTokenType } from '../../config/registries/tokenTypeDerivation.js';
import { isOutputCurrency } from '../../config/registries/tokenConstants.js';
import { getStatusEffect } from '../../config/registries/statusRegistry.js';
import { ITEMS, getItem } from '../../config/registries/itemRegistry.js';
import { ENEMIES, getEnemy } from '../../config/registries/enemyRegistry.js';
import { listMaps, getMap } from '../../config/registries/mapRegistry.js';
import { listPooledSkillIds } from '../../config/registries/recipePoolRegistry.js';
import { GUILD_HALL_DROP_SEQUENCE, GUILD_HALL_MAPS } from '../../config/registries/guildHallMaps.js';
import { SPRITE_MANIFEST } from '../../config/registries/sprite-manifest.js';
import { RANDOM_HUNTS } from '../quests/QuestManager.js';
import { warnMissingContent } from '../../utils/missingContent.js';

/**
 * ContentAudit — one pass over every cross-reference in the content set,
 * reporting the ones that do not resolve.
 *
 * ## Why this exists
 * The game is built so that missing content is *quiet*. Every registry
 * accessor ends `return X[id] || null`, and every caller is written to survive
 * a null — individually sensible defensive code, collectively meaning a
 * definition that does not exist is indistinguishable from one that does
 * nothing. A drop that never arrives, a bounty that never advances, a Token
 * with no definition sitting in the tray: all look exactly like ordinary
 * gameplay.
 *
 * Content is authored in a separate tool and is being re-authored constantly,
 * so ids move all the time. Five separate review findings turned out to be the
 * same defect — a reference to content that had been renamed — and every one
 * of them was found by a person playing, never by a test.
 *
 * ## It WARNS. It never blocks. (Owner ruling, 2026-08-19)
 * Nothing in here changes how the game runs, refuses to boot, throws, or
 * repairs anything. The content set is deliberately half-authored, so a
 * dangling reference is a normal mid-authoring state, not a fault. The whole
 * value is that the information stops being invisible.
 *
 * Every step is wrapped so that a malformed definition produces a report line
 * rather than an exception: an audit that can crash the boot it is auditing
 * would be worse than no audit.
 *
 * ## Reading the output
 * It is written for the person authoring the content, not for a programmer.
 * Each line says what is broken, where it is, and what it points at. There is
 * no stack trace, because there is no bug in the code — there is a name in a
 * data file that nothing answers to.
 */

/** Every reference kind the audit knows how to follow, and how to resolve it. */
const RESOLVERS = {
    Token: id => !!getTokenType(id),
    item: id => !!getItem(id),
    enemy: id => !!getEnemy(id),
    map: id => !!getMap(id),
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

/** Tokens: their recipes, their effects, and the things they open onto. */
function auditTokens(out) {
    for (const [tokenId, def] of Object.entries(TOKENS || {})) {
        const where = `Token "${tokenId}"`;
        if (!def || typeof def !== 'object') {
            out.push(finding(where, 'has no definition behind it'));
            continue;
        }

        checkRef(out, where, 'sprite', def.sprite, 'Its artwork');
        checkRef(out, where, 'map', def.mapId, 'The Map it opens');
        checkRef(out, where, 'enemy', def.enemyId, 'The creature it spawns');
        checkRef(out, where, 'recipe pool', stationSkillOf(def), 'The skill it works as');

        for (const input of def.config?.inputs || []) {
            checkRef(out, where, 'item', input?.itemId, 'An ingredient it consumes');
        }
        for (const output of def.config?.outputs || []) {
            // An output pays in an item OR in currency (D-141) — never both,
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
        auditStatements(out, where, def);
        auditDerivedType(out, where, def);
    }

    auditCapabilityTags(out);
}

/**
 * ⭐ **The one that matters most right now.**
 *
 * Effect blocks were replaced by statements, and old-shape effect data is
 * deliberately **not** migrated and **not** reinterpreted — a half-translation
 * that quietly does something slightly different is the exact failure this
 * redesign exists to remove. So a Token still carrying `effectBlocks` keeps its
 * data in the file, loads fine, plays fine, and simply has no rules.
 *
 * That is only acceptable if it is impossible to miss. This is how it is said.
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

/** Every reference a statement can make, followed. */
function auditStatements(out, where, def) {
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
 * Capability tags with no provider (bug B4).
 *
 * `acceptedTokens[].tag` is a free string matched against provided tags. A
 * Token asking for a `pikaxe` never runs — no audit line, no test failure, no
 * in-game message beyond a generic alert. This is that line.
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
                    `needs an adjacent "${tag}", and no Token provides that capability — so it can never work`));
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
        // CR2-184: `data/items.json` carries an entry whose id is literally
        // "item" with every field left blank — an authoring slip that reads as
        // a real item everywhere it is referenced. A blank name is the tell.
        if (!def.name) {
            out.push(finding(where, 'has no name — it looks like a half-finished entry that was saved by accident'));
        }
        checkRef(out, where, 'sprite', def.sprite, 'Its artwork');
    }
}

/** Enemies: their drop tables. */
function auditEnemies(out) {
    for (const [enemyId, def] of Object.entries(ENEMIES || {})) {
        const where = `Enemy "${enemyId}"`;
        if (!def || typeof def !== 'object') {
            out.push(finding(where, 'has no definition behind it'));
            continue;
        }
        checkRef(out, where, 'sprite', def.sprite, 'Its artwork');
        for (const drop of def.drops || []) {
            checkRef(out, where, 'item', drop?.itemId, 'Something it drops');
        }
    }
}

/** Maps: everything in their loot pools. */
function auditMaps(out) {
    // `listMaps()` deliberately hides the tutorial Maps (they are not
    // purchasable), so they are added back by name — a broken reference in the
    // Guild Hall Map is exactly the kind a new player would hit first.
    const mapIds = new Set([
        ...listMaps().map(m => m.id || m),
        ...Object.keys(GUILD_HALL_MAPS || {})
    ]);
    for (const mapId of mapIds) {
        const def = getMap(mapId);
        const where = `Map "${mapId}"`;
        if (!def) {
            out.push(finding(where, 'has no definition behind it'));
            continue;
        }
        for (const entry of def.pool || []) {
            const kind = entry?.kind === 'item' ? 'item' : 'Token';
            checkRef(out, where, kind, entry?.refId, 'Something in its loot pool');
        }
        for (const material of def.materials || []) {
            checkRef(out, where, 'item', material?.itemId, 'A material it costs');
        }
    }
}

/**
 * The lists written by hand in the game's own code rather than authored in the
 * CMS. Three of them have named ids that do not exist at some point, and a
 * CMS-side check would have caught none of them — which is why the audit lives
 * on the game side.
 */
function auditHardcodedLists(out, openingTray) {
    // Passed in rather than imported: this list lives in `EngineBootstrap`,
    // which calls the audit, and importing it back would make the two modules
    // depend on each other in a circle.
    const opening = openingTray || [];
    opening.forEach((typeId, i) => {
        checkRef(out, 'The Tokens a new game starts with', 'Token', typeId,
            `Opening Token ${i + 1} of ${opening.length}`);
    });

    GUILD_HALL_DROP_SEQUENCE.forEach((drop, i) => {
        for (const entry of drop || []) {
            if (entry?.kind === 'gold' || entry?.kind === 'currency') continue;
            const kind = entry?.kind === 'item' ? 'item' : 'Token';
            checkRef(out, 'The Guild Hall tutorial Map', kind, entry?.refId, `Drop ${i + 1}`);
        }
    });

    for (const hunt of RANDOM_HUNTS || []) {
        checkRef(out, 'The randomly-generated hunt bounties', 'enemy', hunt?.id,
            `The bounty "${hunt?.name || hunt?.id}"`);
    }
}

/**
 * Walk everything and return the findings, newest content problems first.
 * Exported separately from the reporting so a test can assert on the list.
 */
export function auditContent({ openingTray = [] } = {}) {
    const out = [];
    const steps = [auditTokens, auditItems, auditEnemies, auditMaps, auditHardcodedLists];
    for (const step of steps) {
        try {
            step(out, openingTray);
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
// The same pass, over a loaded SAVE rather than over the authored content set
// (CR2-120)
// ---------------------------------------------------------------------------

/**
 * ## Why a second pass exists
 * Everything above walks the *authored* content — the files the CMS writes. A
 * save is the other half, and nothing has ever looked at it. When a Token is
 * renamed or deleted, every save that was holding one keeps its old name
 * forever: a tray slot occupied by something that will not sit down, a Vault
 * row that cannot be withdrawn into anything. Loading such a save produces a
 * completely clean console, which is how all three of the owner's live slots
 * came to be carrying five ghost Tokens without anyone noticing.
 *
 * ## It REPORTS. It never repairs, and it never deletes. (Owner decision,
 * 2026-08-26)
 * The obvious follow-on — drop the unresolvable entries during rehydration —
 * was considered and **refused**. It would delete the player's property on the
 * strength of the registry being complete, and content here is re-authored
 * continuously, so a Token that looks missing this morning may simply be
 * halfway through a rename. Nothing in this section writes to the save.
 *
 * ## Once per name, for the life of the page
 * This goes through `warnMissingContent`, so loading slot 0 and then slot 1 —
 * which hold the same four ghosts — says it once, not twice.
 */

/**
 * Every place in a save that names a piece of content, and how a person would
 * describe that place to themselves. The wording finishes the sentence
 * "your saved game still holds it …".
 */
function collectSaveRefs(state, note) {
    const board = state?.board || {};

    for (const tile of Object.values(board.tiles || {})) {
        note('Token', tile?.typeId, 'on the playmat');
    }
    for (const vacancy of Object.values(board.vacancies || {})) {
        note('Token', vacancy?.typeId, 'on the playmat, on a tile that has run dry');
    }
    for (const entry of board.tray || []) {
        note('Token', entry?.typeId, 'in the Token tray');
    }
    for (const typeId of Object.keys(board.tokenBank || {})) {
        note('Token', typeId, 'in the Token Vault');
    }
    // Maps sitting loose on the mat are Token instances too (`addBoardMap`).
    for (const map of board.maps || []) {
        note('Token', map?.typeId, 'as a Map lying on the playmat');
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
