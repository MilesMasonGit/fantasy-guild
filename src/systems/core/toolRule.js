// the content rules for gathering tools: shared by the boot audit and the CMS audit

import {
    isToolKind, toolOf, neededToolOf, toolKindLabel, RETIRED_TOOL_TAGS, HAND_CATEGORY
} from '../../config/registries/toolKinds.js';
import { getProvidedTagsWithTiers } from '../effects/statements.js';
import { isConsumableCategory } from '../../config/registries/equipmentCategories.js';
import { catchPoolsOf, poolBites, BAIT_FREE_TOOL } from '../../config/registries/catchPools.js';
import { RETIRED_WATER_TOKENS } from '../../config/registries/fishingSpots.js';
import { breakChanceProblem } from '../../config/registries/itemBreak.js';
import { gearRequirements } from '../../config/registries/weaponStyles.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { effectRefsOf } from '../effects/effectLibrary.js';

/**
 * Tools are items a hero holds in one hand; a gathering Token names the kind and tier it needs.
 * These findings say where content is written in a way that cannot work: a tool no hero can hold,
 * a need no tool answers, a Break chance that never breaks anything (`itemBreak.js`), two tools of
 * one family and tier whose effects differ in scale ({@link tierScaleFindings}), and content
 * still written the old way (a tool Token on the mat, or a Token or recipe asking for one nearby).
 *
 * Pure: the caller hands in the catalogues. Tokens must be expanded (their statements present), or
 * a tool Token's `Acts as` cannot be seen.
 *
 * @param {{ items?: Record<string, object>, tokens?: Record<string, object>, recipes?: object[]|Record<string, object> }} content
 * @returns {{ entityType: 'Item'|'Token'|'Recipe', entityId: string, entityName: string, message: string }[]}
 */
export function toolFindings({ items = {}, tokens = {}, recipes = [] } = {}) {
    const out = [];
    const push = (entityType, entityId, def, message) =>
        out.push({ entityType, entityId, entityName: def?.name || entityId, message });

    const best = new Map();   // kind → highest tier any item reaches
    for (const [id, item] of Object.entries(items || {})) {
        const block = item?.tool;
        if (!block || typeof block !== 'object') continue;
        if (!isToolKind(block.kind)) {
            push('Item', item.id || id, item, `its Tool names the kind "${block.kind ?? ''}", which the game does not have, so no hero can use it as a tool`);
            continue;
        }
        const tool = toolOf(item);
        best.set(tool.kind, Math.max(best.get(tool.kind) || 0, tool.tier));
        if (item.equipSlot !== HAND_CATEGORY) {
            push('Item', item.id || id, item, `is a ${toolKindLabel(tool.kind)} but its Equip Category is not Hand, so no hero can hold it as a tool`);
        } else if (item.hands === 2) {
            push('Item', item.id || id, item, 'is a tool, and a tool takes one hand: its Two hands setting is ignored');
        }
        // ⚠️ The tool gate (`HeroTools.js`) never asks for a level: a tool held below one still works.
        const levels = gearRequirements(item);
        if (levels.length) {
            const named = levels.map(r => `${getSkill(r.skill)?.name || r.skill} ${r.level}`).join(', ');
            push('Item', item.id || id, item, `is a tool that asks for ${named}, but a tool held below its level still works, unlike other gear, so the level only stops it being handed over: remove the requirement`);
        }
    }

    tierScaleFindings(items, push);

    // A Break chance only a tool or a weapon, with a percent above 0 and up to 100, can use.
    for (const [id, item] of Object.entries(items || {})) {
        const problem = breakChanceProblem(item);
        if (problem) push('Item', item.id || id, item, problem);
    }

    for (const [id, token] of Object.entries(tokens || {})) {
        const tokenId = token?.id || id;
        const block = token?.needsTool;
        if (block && typeof block === 'object') {
            const need = neededToolOf(token);
            if (!need) {
                push('Token', tokenId, token, `its Needs tool names the kind "${block.kind ?? ''}", which the game does not have, so its work needs no tool`);
            } else if (!best.has(need.kind)) {
                push('Token', tokenId, token, `needs a ${toolKindLabel(need.kind)} in hand, and no item is a ${toolKindLabel(need.kind)}, so no hero can work it`);
            } else if (best.get(need.kind) < need.minTier) {
                push('Token', tokenId, token, `needs a ${toolKindLabel(need.kind)} of tier ${need.minTier} or better, and the best ${toolKindLabel(need.kind)} is tier ${best.get(need.kind)}, so no hero can work it`);
            }
        }

        // A retired fixed water is the spot audit's to name (`spotRule.js`): the game never loads it.
        if (!RETIRED_WATER_TOKENS.includes(tokenId)) catchFindings(token, tokenId, items, best, (message) => push('Token', tokenId, token, message));

        for (const tag of Object.keys(getProvidedTagsWithTiers(token))) {
            const kind = RETIRED_TOOL_TAGS[tag];
            if (!kind) continue;
            push('Token', tokenId, token, `acts as a ${tag.replace(/_/g, ' ')} beside other Tokens, but tools are carried by heroes now: make it an item with a Tool (${toolKindLabel(kind)}), or delete it`);
        }
    }

    for (const recipe of Array.isArray(recipes) ? recipes : Object.values(recipes || {})) {
        for (const entry of recipe?.requiresContext || []) {
            const tag = typeof entry === 'string' ? entry : entry?.tag;
            const kind = RETIRED_TOOL_TAGS[tag];
            if (!kind) continue;
            push('Recipe', recipe.id || recipe.name || '', recipe, `needs a ${tag.replace(/_/g, ' ')} beside its station, but tools are carried by heroes now and no Token offers one: remove that requirement`);
        }
    }

    return out;
}

/**
 * Each tool family's tier carries its Speed at one scale (copper 1, iron 2, ...), written on every
 * tool of that family and tier: a tool whose effects differ in scale from the first of its family
 * and tier (an effect missing counts as a difference) is named, beside that first one.
 */
function tierScaleFindings(items, push) {
    const firstOf = new Map();   // `kind|tier` → { id, item, scales }
    for (const [id, item] of Object.entries(items || {})) {
        const tool = toolOf(item);
        if (!tool || item.equipSlot !== HAND_CATEGORY) continue;
        const scales = new Map();
        for (const ref of effectRefsOf(item)) scales.set(ref.effectId, (scales.get(ref.effectId) || 0) + ref.scale);
        const key = `${tool.kind}|${tool.tier}`;
        const first = firstOf.get(key);
        if (!first) {
            firstOf.set(key, { item, scales });
            continue;
        }
        const firstName = first.item.name || first.item.id;
        const differences = [];
        for (const effectId of new Set([...first.scales.keys(), ...scales.keys()])) {
            const mine = scales.get(effectId) || 0;
            const theirs = first.scales.get(effectId) || 0;
            if (mine === theirs) continue;
            const has = theirs ? `has ${theirs}` : 'has none';
            differences.push(mine ? `carries ${effectId} at scale ${mine} where ${firstName} ${has}` : `carries no ${effectId} where ${firstName} has ${theirs}`);
        }
        if (differences.length) {
            push('Item', item.id || id, item, `is a ${toolKindLabel(tool.kind)} of tier ${tool.tier} like ${firstName}, but ${differences.join('; ')}: tools of one family and tier work alike, so give them the same scales`);
        }
    }
}

/**
 * A water Token's catch pools (`catchPools.js`), written in a way that cannot work: a tool kind the
 * game lacks or no item is, a bait or catch that is not an item, a bait no hero can carry, a pool
 * with nothing to catch or a second for one tool in one place, a pool with no bait for any tool but a Trap, and the fields the
 * pools make pointless (Outputs, Needs tool) or need (a work cycle).
 */
function catchFindings(token, tokenId, items, best, say) {
    const raw = Array.isArray(token?.catchPools) ? token.catchPools : [];
    if (!raw.length) return;
    const itemName = (id) => items?.[id]?.name || id;
    const seen = new Set();
    raw.forEach((pool, n) => {
        const label = `catch pool ${n + 1}`;
        const kind = typeof pool?.tool === 'string' ? pool.tool.trim() : '';
        if (!isToolKind(kind)) {
            say(`its ${label} names the tool kind "${kind}", which the game does not have, so no hero fishes it`);
        } else if (!best.has(kind)) {
            say(`its ${label} needs a ${toolKindLabel(kind)}, and no item is a ${toolKindLabel(kind)}, so no hero fishes it`);
        }
        const bait = typeof pool?.bait === 'string' && pool.bait.trim() ? pool.bait.trim() : null;
        if (bait && !items?.[bait]) {
            say(`its ${label} takes "${bait}" as bait, which is not an item`);
        } else if (bait && !isConsumableCategory(items[bait]?.equipSlot)) {
            say(`its ${label} takes ${itemName(bait)} as bait, but ${itemName(bait)} is not a Consumable, so no hero can carry it as bait`);
        }
        // Pools for one tool that hold in different places are not repeats (`catchPools.poolsAt`). One
        // Bait serves all fishing, so a second pool for the tool in the same place is never fished,
        // whatever bait it names (`catchPools.poolForTool`).
        const place = ['water', 'biomes'].map(k => (Array.isArray(pool?.[k]) ? pool[k].join(',') : '')).join('|');
        const key = `${kind}|${place}`;
        if (seen.has(key)) {
            say(`has two catch pools for a ${toolKindLabel(kind)}${place !== '|' ? ' in the same place' : ''}: only the first is fished, whatever bait it spends`);
        }
        seen.add(key);
        const catches = Array.isArray(pool?.catches) ? pool.catches : [];
        for (const c of catches) {
            if (c?.itemId && !items?.[c.itemId]) say(`its ${label} lands "${c.itemId}", which is not an item`);
        }
        if (!catches.some(c => c?.itemId && Number(c.weight) > 0)) {
            say(`its ${label} has no catch with a weight above 0, so it is ignored`);
        }
    });

    const pools = catchPoolsOf(token);
    pools.forEach((pool) => {
        if (poolBites(pool) || !isToolKind(pool.tool)) return;
        say(`its catch pool for a ${toolKindLabel(pool.tool)} takes no bait, so no hero fishes it: only a ${toolKindLabel(BAIT_FREE_TOOL)} catches without bait, so name a bait`);
    });
    if (!pools.length) return;
    if (!token.config) say('has catch pools but no work cycle (skill and cycle time), so nobody fishes it');
    if ((token.config?.outputs || []).length) say('has catch pools, so its Outputs are never made: the catch replaces them');
    if (token.needsTool) say('has catch pools, so its Needs tool is ignored: any tool its pools name will do, at any tier');
}

/**
 * **The tool rebuild rule**: the materials a tool is made from that no source gives without a tool.
 * A hero who loses or breaks a tool must be able to make it again without one, so every material
 * a tool's recipe needs, and every material those are made from through a source that needs no
 * tool, must have at least one such source: an enemy's drop, a Token worked barehanded, a Token's
 * trickle. A source needs a tool when its Token's work needs one in hand (`neededToolOf`), when
 * its recipe asks for a tool nearby (a context tag in `toolTags`), and always for a catch.
 * Materials no tool is made from (fish, food) are outside the rule.
 *
 * Pure: the caller hands in the catalogues, and `routesOf(def)`, a Token's production routes in
 * `tokenRegistry.productionRoutes`' shape (`[{ id, inputs, outputs, requiresContext }]`); trickle
 * and catches are read here.
 *
 * @param {{ tokens?: Record<string, object>, items?: Record<string, object>,
 *   routesOf?: (def: object) => { id?: string|null, inputs?: object[], outputs?: object[], requiresContext?: string[] }[],
 *   toolTags?: Set<string> }} content
 * @returns {{ itemId: string, sources: { by: string, needsTool: boolean }[] }[]} each gap with every
 *   source that makes it (none when nothing does), by item id
 */
export function toolMaterialGaps({ tokens = {}, items = {}, routesOf = () => [], toolTags = new Set() } = {}) {
    const ids = (lines) => (lines || []).map(l => l?.itemId).filter(Boolean);
    const sources = [];
    for (const [key, def] of Object.entries(tokens || {})) {
        if (!def || typeof def !== 'object') continue;
        const id = def.id || key;
        const heldTool = !!neededToolOf(def);
        for (const route of routesOf(def) || []) {
            const nearbyTool = (route.requiresContext || []).some(tag => toolTags.has(tag));
            sources.push({
                by: route.id ? `${id} (${route.id})` : id, inputs: ids(route.inputs), outputs: ids(route.outputs),
                needsTool: heldTool || nearbyTool
            });
        }
        for (const t of def.trickle || []) {
            if (t?.itemId) sources.push({ by: `${id} (trickle)`, inputs: [], outputs: [t.itemId], needsTool: false });
        }
        for (const pool of catchPoolsOf(def)) {
            sources.push({ by: `${id} (catch)`, inputs: pool.bait ? [pool.bait] : [], outputs: ids(pool.catches), needsTool: true });
        }
    }
    const makers = (itemId) => sources.filter(s => s.outputs.includes(itemId));
    const isTool = (itemId) => !!toolOf(items?.[itemId]);

    const chain = new Set();
    const next = sources.filter(s => s.outputs.some(isTool)).flatMap(s => s.inputs);
    while (next.length) {
        const itemId = next.pop();
        if (chain.has(itemId)) continue;
        chain.add(itemId);
        for (const s of makers(itemId)) if (!s.needsTool) next.push(...s.inputs);
    }

    const gaps = [];
    for (const itemId of [...chain].sort()) {
        const made = makers(itemId);
        if (made.some(s => !s.needsTool)) continue;
        gaps.push({ itemId, sources: made.map(s => ({ by: s.by, needsTool: s.needsTool })) });
    }
    return gaps;
}
