// the content rules for gathering tools: shared by the boot audit and the CMS audit

import {
    isToolKind, toolOf, neededToolOf, toolKindLabel, RETIRED_TOOL_TAGS, HAND_CATEGORY
} from '../../config/registries/toolKinds.js';
import { getProvidedTagsWithTiers } from '../effects/statements.js';

/**
 * Tools are items a hero holds in one hand; a gathering Token names the kind and tier it needs.
 * These findings say where content is written in a way that cannot work: a tool no hero can hold,
 * a need no tool answers, and content still written the old way (a tool Token on the mat, or a
 * Token or recipe asking for one nearby).
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

        for (const tag of Object.keys(getProvidedTagsWithTiers(token))) {
            const kind = RETIRED_TOOL_TAGS[tag];
            if (!kind) continue;
            push('Token', tokenId, token, `acts as a ${tag.replace(/_/g, ' ')} beside other Tokens, but tools are carried by heroes now: make it an item with a Tool (${toolKindLabel(kind)}), or delete it`);
        }
        for (const requirement of token?.acceptedTokens || []) {
            const kind = RETIRED_TOOL_TAGS[requirement?.tag];
            if (!kind) continue;
            push('Token', tokenId, token, `requires a nearby ${requirement.tag.replace(/_/g, ' ')}, but tools are carried by heroes now: set its Needs tool to ${toolKindLabel(kind)} instead`);
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
