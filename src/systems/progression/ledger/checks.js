// the progression ledger's checks: integrity, plan against data, luck and access, and the pacing group's words

import { planOf, PLAN_STATUS, tierLabel } from './plan.js';
import { HOW, LEDGER_ENGINE_TEXT, LUCK_BELOW, parseKey, itemKey, tokenKey, recipeKey, isOneOff, oneOffFindOf } from './engine.js';
import { toolOf } from '../../../config/registries/toolKinds.js';
import { isMapItem } from '../../atlas/mapItems.js';

export { isOneOff };

/**
 * Automatic checks over a ledger (`buildLedger`) and the content it was built from. Each finding names
 * one entry, how bad it is and what is wrong in plain words:
 *
 *     { id, check, group, severity, key, name, message, related: key[] }
 *
 * - **A. Integrity**: what the content says cannot work (names a thing that does not exist, spends
 *   what nothing makes, can never be reached, needs a tool or a station nothing gives).
 * - **B. Plan against data**: where the owner's plan (`plan.tier`, Planned stubs) and what the
 *   content actually does disagree.
 * - **C. Luck and access**: things only luck, a single map, a one-off find, a first kill or the
 *   Shop gives. Average luck only: a chance is a chance, never a lucky or unlucky run.
 *
 * Severities: `block` breaks something in the game; `warn` is a problem to look at; `info` a fact
 * worth knowing. A Parked entry is silenced: it is kept on purpose. A Planned stub is not in the
 * game, so only the stub checks (no tier, nothing points to it) look at it.
 *
 * - **D. Pacing**: worked out by the rate calculator (`pace.js`) and handed in as `extra`, with the
 *   calibration's own finding (`calibration.js`); their words are here so every list reads one table.
 *
 * The CMS adds the game's own content rules and the simulator's pricing refusals
 * (`cms/src/engine/ledgerReport.js`), which need the game's registries.
 *
 * Pure: reads only what it is handed.
 */

export const SEVERITY = Object.freeze({ BLOCK: 'block', WARN: 'warn', INFO: 'info' });
export const SEVERITIES = Object.freeze([SEVERITY.BLOCK, SEVERITY.WARN, SEVERITY.INFO]);
const SEVERITY_RANK = { block: 0, warn: 1, info: 2 };

/** The pseudo-entry for what the Starter Camp itself places. */
export const STARTER_CAMP_KEY = 'camp:starter';

/** Every check: its group and words. A finding may carry a lighter severity than its check's usual one. */
export const CHECKS = Object.freeze({
    'unknown-ref': { group: 'A', severity: SEVERITY.BLOCK, label: 'Names something that does not exist' },
    'game-rule': { group: 'A', severity: SEVERITY.WARN, label: 'Breaks a content rule of the game' },
    'never-produced': { group: 'A', severity: SEVERITY.WARN, label: 'Used but never produced' },
    unused: { group: 'A', severity: SEVERITY.INFO, label: 'Produced but unused' },
    'never-reachable': { group: 'A', severity: SEVERITY.WARN, label: 'Never reachable' },
    loop: { group: 'A', severity: SEVERITY.WARN, label: 'A loop with no way in' },
    'tool-missing': { group: 'A', severity: SEVERITY.WARN, label: 'Needs a tool nothing gives' },
    'tool-single': { group: 'A', severity: SEVERITY.WARN, label: 'One tool limits a skill to one hero' },
    'no-host': { group: 'A', severity: SEVERITY.WARN, label: 'A recipe nothing can host' },
    pricing: { group: 'A', severity: SEVERITY.WARN, label: 'The simulator cannot price it' },
    'refs-planned': { group: 'B', severity: SEVERITY.BLOCK, label: 'Live content needs a Planned entry' },
    leak: { group: 'B', severity: SEVERITY.WARN, label: 'Reachable before its tier' },
    late: { group: 'B', severity: SEVERITY.WARN, label: 'Reachable later than its tier, or never' },
    'later-ingredient': { group: 'B', severity: SEVERITY.WARN, label: 'An ingredient from a later tier' },
    'no-tier': { group: 'B', severity: SEVERITY.INFO, label: 'No tier set' },
    'orphan-stub': { group: 'B', severity: SEVERITY.INFO, label: 'A Planned stub nothing points to' },
    'luck-only': { group: 'C', severity: SEVERITY.WARN, label: 'Luck only' },
    fragile: { group: 'C', severity: SEVERITY.WARN, label: 'A single fragile source' },
    'first-kill-only': { group: 'C', severity: SEVERITY.WARN, label: 'First kill only' },
    'shop-only': { group: 'C', severity: SEVERITY.INFO, label: 'Shop only' },
    wall: { group: 'D', severity: SEVERITY.WARN, label: 'A wall: levels far slower than the curve' },
    'unlock-wall': { group: 'D', severity: SEVERITY.WARN, label: 'A long wait for one unlock' },
    'stage-budget': { group: 'D', severity: SEVERITY.WARN, label: 'A stage off its time budget' },
    'profile-bounds': { group: 'D', severity: SEVERITY.WARN, label: 'Bare or Maxed out of bounds' },
    'hall-payback': { group: 'D', severity: SEVERITY.WARN, label: 'A Guild Hall rank slow to pay back' },
    'boost-target': { group: 'D', severity: SEVERITY.WARN, label: 'A boost over its target strength' },
    unmodelled: { group: 'D', severity: SEVERITY.INFO, label: 'A factor the calculator cannot read' },
    'calibration-stale': { group: 'D', severity: SEVERITY.WARN, label: 'The calculator needs calibrating' },
});

export const CHECK_GROUP_TEXT = Object.freeze({ A: 'Integrity', B: 'Plan against data', C: 'Luck and access', D: 'Pacing' });
export const SEVERITY_TEXT = Object.freeze({ block: 'Block', warn: 'Warn', info: 'Info' });

/** Item types a player uses up or wears: one nothing else spends is still used. */
const FINAL_TYPES = new Set(['consumable', 'treasure', 'food', 'drink', 'potion', 'weapon', 'armor', 'tool', 'fuel', 'drop', 'map', 'modifier']);

/** The rules that make an item over and over (a Region's work, a recipe, Passive Production, a side drop). */
const PRODUCING = new Set([HOW.WORK, HOW.CATCH, HOW.DROP, HOW.CRAFT, HOW.TRICKLE, HOW.UPGRADE, HOW.BONUS]);
/** The rules that place a Token where it stands anywhere, not only on one map. */
const PLACES_ANYWHERE = new Set([HOW.STARTER_CAMP, HOW.SHOP, HOW.HALL, HOW.CRAFT]);

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const ANYWHERE = 'anywhere';

/**
 * The entry a rule belongs to, which a finding about the rule is filed under: the recipe a station
 * or build rule runs, the Token a Shop sells, the map the tutorial gives, the Starter Camp for what
 * it places, else the record doing the work.
 */
export function ruleOwner(rule) {
    if (rule.how === HOW.STATION || rule.how === HOW.BUILD) return rule.gives[0]?.key ?? rule.via;
    if (rule.how === HOW.STARTER_CAMP || rule.how === HOW.STARTER_BANK || rule.how === HOW.STARTER_TOOL) return STARTER_CAMP_KEY;
    if (rule.via) return rule.via;
    return rule.gives[0]?.key ?? STARTER_CAMP_KEY;
}

/** The tier a rule first fires at, from its needs' reach: null when some need is never reached. */
export function ruleTier(reach, rule) {
    let tier = rule.floor;
    for (const need of rule.tool ? [...rule.needs, rule.tool] : rule.needs) {
        const at = reach.get(need);
        if (!at || !Number.isInteger(at.tier)) return null;
        tier = Math.max(tier, at.tier);
    }
    return tier;
}

/** Records by entry key, Planned ones included, from content shaped as the engine takes it. */
function recordsOf(content) {
    const out = new Map();
    const keyedEach = (collection, keyOf) => {
        if (Array.isArray(collection)) collection.forEach((def) => { if (isObject(def) && def.id) out.set(keyOf(def.id), def); });
        else if (isObject(collection)) for (const [id, def] of Object.entries(collection)) if (isObject(def)) out.set(keyOf(def.id ?? id), def);
    };
    keyedEach(content.items, itemKey);
    keyedEach(content.tokens, tokenKey);
    if (Array.isArray(content.recipes) || isObject(content.recipes)) keyedEach(content.recipes, recipeKey);
    else for (const pool of Object.values(isObject(content.recipePools) ? content.recipePools : {})) keyedEach(pool, recipeKey);
    return out;
}

/**
 * The world's rules turned around: for every key, the rules that give it and the rules that spend
 * or need it (each rule once per key).
 */
export function ruleIndex(world) {
    const givers = new Map();
    const takers = new Map();
    const push = (map, key, rule) => {
        if (!map.has(key)) map.set(key, []);
        const at = map.get(key);
        if (!at.includes(rule)) at.push(rule);
    };
    for (const rule of world.rules) {
        for (const give of rule.gives) push(givers, give.key, rule);
        for (const need of rule.needs) push(takers, need, rule);
        for (const input of rule.inputs) push(takers, input.key, rule);
        if (rule.tool) push(takers, rule.tool, rule);
    }
    return { givers: (key) => givers.get(key) || [], takers: (key) => takers.get(key) || [] };
}

/**
 * The places a Token is had: a set of map keys, or `anywhere`; empty when nothing places it. A way
 * in only luck takes (a 2 % spawn, a map or modifier only luck gives) is not a place the player can
 * count on, so it is left out.
 */
function placesOf(index, reach, luckBelow) {
    const byLuck = (key) => { const at = reach.get(key); return !!at && at.luckOnly && at.sureTier === null; };
    const memo = new Map();
    const of = (key, seen) => {
        if (memo.has(key)) return memo.get(key);
        if (seen.has(key)) return new Set();
        seen.add(key);
        const out = new Set();
        for (const rule of index.givers(key)) {
            if (rule.gives.some((g) => g.key === key && g.firstKill !== true && g.chance < luckBelow)) continue;
            if (PLACES_ANYWHERE.has(rule.how) || rule.how === HOW.BUILD || rule.how === HOW.STATION) out.add(ANYWHERE);
            else if (rule.how === HOW.MAP || rule.how === HOW.MODIFIER) { if (!byLuck(rule.via)) out.add(rule.via); }
            else if (rule.via?.startsWith('token:')) for (const p of of(rule.via, seen)) out.add(p);
            else if (rule.via) out.add(ANYWHERE);
            if (out.has(ANYWHERE)) break;
        }
        seen.delete(key);
        const result = out.has(ANYWHERE) ? new Set([ANYWHERE]) : out;
        memo.set(key, result);
        return result;
    };
    return (key) => of(key, new Set());
}

/**
 * Every finding of checks A to C, worst first, then by entry name.
 *
 * @param {object} ledger   `buildLedger(content)`
 * @param {object} content  what the ledger was built from (with Planned stubs: their plan blocks are read here)
 * @param {{ extra?: object[], luckBelow?: number }} options  `extra`: findings from elsewhere (the CMS's game rules and
 *   pricing), silenced and sorted with the rest; `luckBelow` as the ledger was built with
 */
export function runChecks(ledger, content = {}, { extra = [], luckBelow = LUCK_BELOW } = {}) {
    const { world, reach } = ledger;
    const records = recordsOf(content);
    const index = ruleIndex(world);
    const places = placesOf(index, reach, luckBelow);
    const nameOf = (key) => (key === STARTER_CAMP_KEY ? 'Starter Camp' : world.names.get(key) ?? parseKey(key).id);
    const effTier = (key) => planOf(records.get(key)).tier ?? reach.get(key)?.tier ?? null;
    const findings = [];
    const seen = new Set();
    const add = (check, key, message, { severity = CHECKS[check].severity, related = [], name = null } = {}) => {
        const id = `${check}:${key}:${message}`;
        if (seen.has(id)) return;
        seen.add(id);
        findings.push({ id, check, group: CHECKS[check].group, severity, key, name: name || nameOf(key), message, related });
    };
    const isKnown = (key) => world.names.has(key);
    const isEntry = (key) => /^(item|token|recipe):/.test(key);
    const listNames = (keys, max = 3) => {
        const names = [...new Set(keys.map(nameOf))];
        return names.length > max ? `${names.slice(0, max).join(', ')} and ${names.length - max} more` : names.join(', ');
    };

    // ── A and B over the rules: unknown names and Planned ones ──────────────────────────────────
    for (const rule of world.rules) {
        const owner = ruleOwner(rule);
        const named = [...rule.needs, ...rule.inputs.map((i) => i.key), ...rule.gives.map((g) => g.key)].filter(isEntry);
        for (const key of new Set(named)) {
            if (key === owner) continue;
            if (!isKnown(key)) add('unknown-ref', owner, `Names ${parseKey(key).kind} "${parseKey(key).id}", which does not exist.`, { related: [key] });
            else if (world.planned.has(key)) {
                add('refs-planned', owner, `Uses ${nameOf(key)}, which is only Planned: the game would not have it.`, { related: [key] });
            }
        }
    }

    // ── per entry ───────────────────────────────────────────────────────────────────────────────
    const entryKeys = [...records.keys()];
    for (const key of entryKeys) {
        const def = records.get(key);
        const plan = planOf(def);
        const { kind, id } = parseKey(key);
        const at = reach.get(key);
        const givers = index.givers(key);
        const takers = index.takers(key).filter((r) => ruleOwner(r) !== key);

        if (plan.status === PLAN_STATUS.PLANNED) {
            if (plan.tier === null && kind !== 'recipe') add('no-tier', key, 'A Planned stub with no tier: which stage is it for?');
            if (kind !== 'recipe') {
                const pointed = takers.length > 0 || givers.length > 0 || [...records].some(([other, rec]) =>
                    other !== key && planOf(rec).status === PLAN_STATUS.PLANNED && JSON.stringify(rec).includes(`"${id}"`));
                if (!pointed) add('orphan-stub', key, 'A Planned stub nothing points to: no recipe, Token or other stub names it.');
            }
            continue;
        }

        if (kind === 'item' && plan.tier === null) add('no-tier', key, 'No tier set: the checks cannot tell a leak from a plan.');

        // Integrity: used, produced, reached.
        const reachable = Number.isInteger(at?.tier);
        if (kind === 'item') {
            const spentBy = takers.map(ruleOwner);
            if (!givers.length && spentBy.length) {
                add('never-produced', key, `Spent by ${listNames(spentBy)}, but nothing makes or gives it.`, { related: spentBy });
            }
            const finalUse = FINAL_TYPES.has(String(def.type || '').toLowerCase()) || !!def.equipSlot
                || (def.tags || []).some((t) => FINAL_TYPES.has(String(t).toLowerCase()));
            if (givers.length && !takers.length && !finalUse) add('unused', key, 'Made or found, but nothing spends it.');
        }

        if (!reachable && !(kind === 'item' && !givers.length && takers.length)) {
            const loop = loopOf(key, reach, index);
            if (loop) add('loop', key, `Only made inside a loop with no way in: ${loop.map(nameOf).join(' → ')}.`, { related: loop });
            else if (plan.tier !== null) add('late', key, `Never reachable, though planned for ${tierLabel(plan.tier)}: ${whyNever(key, reach, index, nameOf)}`);
            else add('never-reachable', key, `Never reachable: ${whyNever(key, reach, index, nameOf)}`);
        }

        // Plan against data.
        if (reachable && plan.tier !== null) {
            const path = ledger.pathOf(key);
            // Tutorial, bounty and boss first-kill maps are handed out a stage before their Region by design.
            const early = kind === 'item' && isMapItem(def) ? 1 : 0;
            if (at.tier < plan.tier - early) add('leak', key, `Reachable at ${tierLabel(at.tier)}, before its tier (${tierLabel(plan.tier)}): ${path}.`);
            if (at.tier > plan.tier) add('late', key, `First reachable at ${tierLabel(at.tier)}, later than its tier (${tierLabel(plan.tier)}): ${path}.`);
        }
        if (kind === 'item' && plan.tier !== null && reachable) {
            const later = laterIngredients(ledger.treeOf(id).tree, plan.tier, effTier);
            if (later.length) {
                add('later-ingredient', key, `Its tree needs ${later.map((l) => `${l.name} (${tierLabel(l.tier)})`).join(', ')}, from after its tier (${tierLabel(plan.tier)}).`, { related: later.map((l) => l.key) });
            }
        }

        // Luck and access.
        if (reachable && at.luckOnly) {
            const how = at.firstKill ? LEDGER_ENGINE_TEXT.firstKill : Number.isFinite(at.chance) ? LEDGER_ENGINE_TEXT.chance(at.chance) : '';
            const from = at.via ? ` from ${nameOf(at.via)}` : '';
            const find = at.oneOffOnly ? oneOffFindOf(reach, key) : null;
            if (find) add('luck-only', key, `Only ever through a one-off find (${nameOf(find)}), which wears out for good, and no sure way.`, { related: [find] });
            else if (at.sureTier === null) add('luck-only', key, `Only ever by luck: ${how}${from}, and no sure way.`);
            else add('luck-only', key, `Only by luck at ${tierLabel(at.tier)} (${how}${from}); a sure way from ${tierLabel(at.sureTier)}.`, { severity: SEVERITY.INFO });
        }
        if (kind === 'item' && reachable) {
            const producing = givers.filter((r) => PRODUCING.has(r.how) && Number.isInteger(ruleTier(reach, r)));
            const fromTokens = producing.filter((r) => r.via?.startsWith('token:') && r.how !== HOW.CRAFT && r.how !== HOW.TRICKLE);
            if (producing.length && fromTokens.length === producing.length && !producing.some((r) => r.how === HOW.UPGRADE || r.how === HOW.BONUS)) {
                const lasting = fromTokens.filter((r) => !isOneOff(world.tokens[parseKey(r.via).id]));
                if (!lasting.length) {
                    add('fragile', key, `Only from one-off finds (${listNames(fromTokens.map((r) => r.via))}), which wear out for good.`, { related: fromTokens.map((r) => r.via) });
                } else {
                    const where = new Set();
                    for (const r of lasting) for (const p of places(r.via)) where.add(p);
                    if (!where.has(ANYWHERE) && where.size === 1) {
                        const map = [...where][0];
                        // A map's own goods are a design choice; it matters when other things need the item.
                        add('fragile', key, `Only from the ${nameOf(map)} (${listNames(lasting.map((r) => r.via))}).`, {
                            severity: takers.length ? SEVERITY.WARN : SEVERITY.INFO, related: [map, ...lasting.map((r) => r.via)]
                        });
                    }
                }
            }
            const gives = givers.flatMap((r) => r.gives.filter((g) => g.key === key));
            if (gives.length && gives.every((g) => g.firstKill === true)) {
                add('first-kill-only', key, `Only a first-kill drop (${listNames(givers.map((r) => r.via).filter(Boolean))}): once per enemy, ever.`);
            }
        }
        if (kind === 'token' && reachable && givers.length && givers.every((r) => r.how === HOW.SHOP)) {
            const price = givers[0].inputs.map((i) => `${i.quantity} ${nameOf(i.key)}`).join(', ');
            add('shop-only', key, `Only from the Shop${price ? `, for ${price}` : ', free'}.`);
        }

        // Tools and hosts.
        if (kind === 'token') {
            for (const rule of world.rules.filter((r) => r.via === key && r.tool)) {
                if (!Number.isInteger(reach.get(rule.tool)?.tier)) add('tool-missing', key, `Its work needs a tool (${nameOf(rule.tool)}) that nothing gives.`, { related: [rule.tool] });
            }
        }
        if (kind === 'recipe' && !world.rules.some((r) => (r.how === HOW.STATION || r.how === HOW.BUILD) && r.gives[0]?.key === key)) {
            const kinds = Array.isArray(def.foundationKinds) && def.foundationKinds.length
                ? `a Foundation of kind ${def.foundationKinds.join(' or ')}`
                : `a ${def.skill || 'skill-less'} station${Array.isArray(def.stationKinds) && def.stationKinds.length ? ` of kind ${def.stationKinds.join(' or ')}` : ''}`;
            add('no-host', key, `Nothing can run it: no Token in the content is ${kinds}.`);
        }
        if (kind === 'item' && toolOf(def)?.starter) {
            const made = givers.some((r) => r.how !== HOW.STARTER_TOOL);
            if (!made) {
                const answers = world.rules.filter((r) => r.how === HOW.HOLD && r.via === key).flatMap((r) => r.gives.map((g) => g.key));
                const others = world.rules.filter((r) => r.how === HOW.HOLD && r.via !== key && r.gives.some((g) => answers.includes(g.key)))
                    .map((r) => r.via).filter((k) => index.givers(k).some((g) => g.how !== HOW.STARTER_TOOL));
                if (others.length) {
                    add('tool-single', key, `No recipe makes another ${nameOf(key)}: one hero at a time does its work until ${listNames(others)}.`, { severity: SEVERITY.INFO, related: others });
                } else {
                    add('tool-single', key, `No recipe makes another ${nameOf(key)}: only the one starter tool, so one hero at a time does its work.`);
                }
            }
        }
    }

    for (const f of extra) add(f.check, f.key, f.message, { severity: f.severity, related: f.related || [], name: f.name });

    const silenced = (key) => planOf(records.get(key)).status === PLAN_STATUS.PARKED;
    return findings
        .filter((f) => !silenced(f.key))
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.name.localeCompare(b.name) || a.check.localeCompare(b.check));
}

/** The unreached needs of a key's sources, the key itself left out. */
function whyMissing(key, reach, index) {
    const out = [];
    for (const rule of index.givers(key)) {
        for (const need of rule.tool ? [...rule.needs, rule.tool] : rule.needs) {
            if (!Number.isInteger(reach.get(need)?.tier) && need !== key) out.push(need);
        }
    }
    return out;
}

/** Why a key is never reached, in words: nothing gives it, or the first thing its sources lack. */
function whyNever(key, reach, index, nameOf) {
    if (!index.givers(key).length) return 'nothing makes or places it.';
    const missing = whyMissing(key, reach, index);
    // An item made only by a recipe that never runs: say what the recipe lacks.
    const deeper = missing.flatMap((need) => (need.startsWith('recipe:') ? whyMissing(need, reach, index) : [need]));
    const names = [...new Set(deeper.map(nameOf))];
    if (!names.length) return 'its sources never fire.';
    return `it needs ${names.slice(0, 3).join(' or ')}${names.length > 3 ? ` (and ${names.length - 3} more)` : ''}, never reached.`;
}

/**
 * A loop with no way in: a chain of unmet needs from a key back to itself, every link never
 * reached and only made through the loop (seeds that need seeds, with no first seed). Null when
 * the key is simply missing something.
 */
function loopOf(start, reach, index) {
    const unreached = (k) => !Number.isInteger(reach.get(k)?.tier);
    const stack = [[start, [start]]];
    const visited = new Set();
    while (stack.length) {
        const [key, path] = stack.pop();
        for (const rule of index.givers(key)) {
            for (const need of rule.tool ? [...rule.needs, rule.tool] : rule.needs) {
                if (!unreached(need)) continue;
                if (need === start && path.length > 1) return [...path, start];
                if (need === start || visited.has(need) || !index.givers(need).length) continue;
                visited.add(need);
                stack.push([need, [...path, need]]);
            }
        }
    }
    return null;
}

/** The ingredients anywhere in a tree from after a tier (their own tier when set, else their reach), each once. */
function laterIngredients(tree, tier, effTier) {
    const out = new Map();
    const walk = (node) => {
        for (const child of node.children) {
            const t = effTier(child.key);
            if (Number.isInteger(t) && t > tier && !out.has(child.key)) out.set(child.key, { key: child.key, name: child.name, tier: t });
            walk(child);
        }
    };
    walk(tree);
    return [...out.values()];
}

/** Findings per entry key, for a count per row. */
export function findingsByKey(findings) {
    const out = new Map();
    for (const f of findings) {
        if (!out.has(f.key)) out.set(f.key, []);
        out.get(f.key).push(f);
    }
    return out;
}

/** Findings matching every filter given (`severity`, `group`, `check`, `search` over name and message). */
export function filterFindings(findings, { severity = '', group = '', check = '', search = '' } = {}) {
    const q = String(search || '').trim().toLowerCase();
    return findings.filter((f) => {
        if (severity && f.severity !== severity) return false;
        if (group && f.group !== group) return false;
        if (check && f.check !== check) return false;
        if (q && !`${f.name}\n${f.message}`.toLowerCase().includes(q)) return false;
        return true;
    });
}
