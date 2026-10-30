import { HOW, LEDGER_ENGINE_TEXT, parseKey } from '../../../src/systems/progression/ledger/engine.js';
import { ruleIndex, ruleOwner, ruleTier, isOneOff, STARTER_CAMP_KEY } from '../../../src/systems/progression/ledger/checks.js';
import { planOf } from '../../../src/systems/progression/ledger/plan.js';

/**
 * What the Ledger's item page shows for one entry, worked out from a ledger and its findings: every
 * source and use, the path and first reach, the tree with its figures, and a layout for the layered
 * tree diagram. Pure; the page draws it.
 */

/** Words for how a thing spends an entry, by the rule that spends it. */
export const USE_TEXT = Object.freeze({
    [HOW.CRAFT]: 'an ingredient of',
    [HOW.STATION]: 'an ingredient of',
    [HOW.BUILD]: 'built into',
    [HOW.WORK]: 'spent working',
    [HOW.CATCH]: 'bait at',
    [HOW.SPAWN]: 'upkeep of',
    [HOW.GROW]: 'paid to grow',
    [HOW.SHOP]: 'the price of',
    [HOW.UPGRADE]: 'the price of',
    [HOW.UPCYCLE]: 'traded up into',
    tool: 'the tool for',
    other: 'needed by',
});

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A record from the workspace by its entry key, or null. */
export function recordOf(state, key) {
    const { kind, id } = parseKey(key);
    if (kind === 'item') return state.items?.[id] ?? null;
    if (kind === 'token') return state.tokens?.[id] ?? null;
    if (kind === 'recipe') {
        for (const pool of Object.values(state.recipePools || {})) {
            const hit = (Array.isArray(pool) ? pool : []).find((r) => isObject(r) && r.id === id);
            if (hit) return hit;
        }
    }
    return null;
}

/**
 * Every way an entry is had: `[{ id, how, howText, viaKey, viaName, atName, chance, firstKill, oneOff, gates, tier }]`,
 * the earliest first, then the surest. `oneOff`: the Token doing it wears out for good (a chest). For a recipe's output, `viaKey` is the recipe and `atName` the
 * station it is first run at.
 */
export function sourcesOf(ledger, key, index = ruleIndex(ledger.world)) {
    const { reach, world } = ledger;
    const name = (k) => (k === STARTER_CAMP_KEY ? 'Starter Camp' : world.names.get(k) ?? parseKey(k).id);
    return index.givers(key).map((rule) => {
        const give = rule.gives.find((g) => g.key === key);
        const viaKey = rule.via;
        const recipeAt = rule.how === HOW.CRAFT ? reach.get(rule.via) : null;
        const gates = rule.how === HOW.CRAFT ? recipeAt?.rule?.gates || [] : rule.gates;
        return {
            id: rule.id,
            how: rule.how,
            howText: LEDGER_ENGINE_TEXT.how[rule.how] || rule.how,
            viaKey: viaKey || null,
            viaName: viaKey ? name(viaKey) : null,
            atName: recipeAt?.via ? name(recipeAt.via) : null,
            chance: give?.chance ?? null,
            firstKill: give?.firstKill === true,
            oneOff: !!viaKey?.startsWith('token:') && isOneOff(world.tokens[parseKey(viaKey).id]),
            gates: gates.map((g) => LEDGER_ENGINE_TEXT.level(g.skill, g.level)),
            tier: ruleTier(reach, rule),
        };
    }).sort((a, b) => (a.tier ?? 1e9) - (b.tier ?? 1e9) || (b.chance ?? 0) - (a.chance ?? 0) || String(a.viaName).localeCompare(String(b.viaName)));
}

/**
 * Everything that spends or needs an entry, each once: `[{ key, name, useText }]`, by name. A tool
 * item's uses are the work its kind and tier answer.
 */
export function usesOf(ledger, key, index = ruleIndex(ledger.world)) {
    const { world } = ledger;
    const name = (k) => (k === STARTER_CAMP_KEY ? 'Starter Camp' : world.names.get(k) ?? parseKey(k).id);
    const out = new Map();
    const note = (owner, useText) => {
        if (owner === key || out.has(owner)) return;
        out.set(owner, { key: owner, name: name(owner), useText });
    };
    for (const rule of index.takers(key)) note(ruleOwner(rule), USE_TEXT[rule.how] || USE_TEXT.other);
    for (const hold of world.rules.filter((r) => r.how === HOW.HOLD && r.via === key)) {
        for (const give of hold.gives) for (const rule of index.takers(give.key)) note(ruleOwner(rule), USE_TEXT.tool);
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The tier the page colours an entry by: the owner's when set, else when it is first reached. */
export function effectiveTier(state, ledger, key) {
    const set = planOf(recordOf(state, key)).tier;
    return set ?? ledger.reach.get(key)?.tier ?? null;
}

export const TREE_LAYOUT = Object.freeze({ nodeW: 190, nodeH: 52, colGap: 56, rowGap: 12, pad: 12 });

/**
 * A layered layout of an ingredient tree, the item on the left and its origins to the right, one
 * column per depth: `{ width, height, nodes: [{ id, node, x, y, depth, tier, luck }], edges: [{ from, to, later, luck }] }`.
 * `later` marks an ingredient from a later tier than the item's (drawn red), `luck` one first had
 * only by luck (drawn dashed).
 */
export function layoutTree(tree, { tierOf = () => null, luckOf = () => false, rootTier = null } = {}) {
    const { nodeW, nodeH, colGap, rowGap, pad } = TREE_LAYOUT;
    const nodes = [];
    const edges = [];
    let row = 0;
    let n = 0;
    const place = (node, depth) => {
        const id = `n${n++}`;
        const childIds = node.children.map((child) => place(child, depth + 1));
        let y;
        if (childIds.length) {
            const ys = childIds.map((cid) => nodes.find((p) => p.id === cid).y);
            y = (Math.min(...ys) + Math.max(...ys)) / 2;
        } else {
            y = pad + row * (nodeH + rowGap);
            row += 1;
        }
        const tier = tierOf(node.key);
        nodes.push({ id, node, x: pad + depth * (nodeW + colGap), y, depth, tier, luck: !!luckOf(node.key) });
        for (const cid of childIds) {
            const child = nodes.find((p) => p.id === cid);
            edges.push({ from: id, to: cid, later: Number.isInteger(rootTier) && Number.isInteger(child.tier) && child.tier > rootTier, luck: child.luck });
        }
        return id;
    };
    place(tree, 0);
    const depth = nodes.reduce((m, p) => Math.max(m, p.depth), 0);
    return {
        width: pad * 2 + (depth + 1) * nodeW + depth * colGap,
        height: pad * 2 + Math.max(1, row) * (nodeH + rowGap) - rowGap,
        nodes,
        edges,
    };
}

/** An effort in words: "42 min", "1 h 5 min", "18 s". */
export function effortText(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '—';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} s`;
    const min = Math.round(s / 60);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

/**
 * First reach in words: "Plane 1 · Mining 15, Smithing 10", or "Never" / "Planned", with an earlier
 * one-off find on the side: "… · a one-off find at Plane 1 (Iron Chest)".
 */
export function firstReachText(at, tierLabel) {
    if (!at) return '—';
    if (at.planned) return 'Planned';
    if (at.tier === null) return 'Never';
    const levels = Object.entries(at.levels || {}).sort((a, b) => b[1] - a[1]).map(([skill, level]) => LEDGER_ENGINE_TEXT.level(skill, level));
    const find = at.oneOffFind && !at.oneOffOnly && at.oneOffFind.tier < at.tier
        ? `a one-off find at ${tierLabel(at.oneOffFind.tier)} (${at.oneOffFind.name})` : '';
    return [tierLabel(at.tier) + (at.luckOnly ? ' (luck)' : ''), levels.join(', '), find].filter(Boolean).join(' · ');
}
