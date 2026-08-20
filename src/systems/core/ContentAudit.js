// Fantasy Guild — boot-time content-integrity audit (CR2-108)

import { TOKENS, getTokenType } from '../../config/registries/tokenRegistry.js';
import { ITEMS, getItem } from '../../config/registries/itemRegistry.js';
import { ENEMIES, getEnemy } from '../../config/registries/enemyRegistry.js';
import { listMaps, getMap } from '../../config/registries/mapRegistry.js';
import { listPooledSkillIds } from '../../config/registries/recipePoolRegistry.js';
import { GUILD_HALL_DROP_SEQUENCE, GUILD_HALL_MAPS } from '../../config/registries/guildHallMaps.js';
import { SPRITE_MANIFEST } from '../../config/registries/sprite-manifest.js';
import { RANDOM_HUNTS } from '../quests/QuestManager.js';

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
        checkRef(out, where, 'recipe pool', def.config?.recipePool ?? def.recipePool, 'Its recipe pool');

        for (const input of def.config?.inputs || []) {
            checkRef(out, where, 'item', input?.itemId, 'An ingredient it consumes');
        }
        for (const output of def.config?.outputs || []) {
            checkRef(out, where, 'item', output?.itemId, 'Something it produces');
        }

        for (const block of def.effectBlocks || []) {
            if (block?.targetToken?.mode === 'id') {
                checkRef(out, where, 'Token', block.targetToken.value, 'The Token its effect targets');
            }
            for (const mod of block?.modifiers || []) {
                checkRef(out, where, 'item', mod?.itemId, 'An item its effect grants');
            }
        }
    }
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

export default reportContentIntegrity;
