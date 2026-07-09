// Fantasy Guild - Shared card-catalog helpers (Deck Loop rework, Phase 7)
//
// Extracted from CollectionBinderModal so the Bottom Drawer's Cards tab
// (gameplay card management) and the Collection Binder (completionist
// gallery) share one catalog/filter/preview computation instead of two
// drifting copies.

import { getAreaSet, getAllAreaSets } from '../../../config/registries/areaSetRegistry.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getBiome } from '../../../config/registries/biomeRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { SUB_SKILL_TO_PARENT } from '../../../config/registries/skillRegistry.js';
import { DeckSlotManager } from '../../../systems/loop/DeckSlotManager.js';
import { CARD_TYPES } from '../../../config/registries/cardConstants.js';

export const CATEGORY_TABS = [
    { key: 'all', label: 'All' },
    { key: CARD_TYPES.TASK, label: 'Task' },
    { key: CARD_TYPES.COMBAT, label: 'Combat' },
    { key: CARD_TYPES.STATION, label: 'Station' },
    { key: 'consumable', label: 'Consumable' }
];

export const SORTS = [
    { key: 'name', label: 'Name' },
    { key: 'area', label: 'Area' },
    { key: 'skill', label: 'Skill' },
    { key: 'level', label: 'Level' }
];

export const DEPLOYMENT_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'available', label: 'Available' },
    { key: 'deployed', label: 'Fully Deployed' },
    { key: 'unowned', label: 'Not Owned' }
];

/**
 * Everything obtainable from unlocked areas' pools, plus anything already
 * owned regardless of source. Entries: { id, template, owned, alloc }.
 */
export function buildCardCatalog(playsets, unlockedAreaIds) {
    const ids = new Set();
    for (const areaId of unlockedAreaIds) {
        const areaSet = getAreaSet(areaId);
        Object.keys(areaSet?.deckList || {}).forEach(id => ids.add(id));
    }
    Object.keys(playsets).forEach(id => { if ((playsets[id] || 0) > 0) ids.add(id); });

    return [...ids]
        .map(id => {
            const template = getCard(id);
            if (!template) return null;
            const owned = playsets[id] || 0;
            const alloc = DeckSlotManager.getAllocations(id);
            return { id, template, owned, alloc };
        })
        .filter(Boolean)
        // Deck loop pools contain only these categories; anything else
        // (legacy quests etc.) stays out.
        .filter(e => ['task', 'combat', 'station', 'consumable'].includes(e.template.cardType));
}

/** Apply category/search/deployment filters and the chosen sort order. */
export function filterAndSortCards(catalog, { categoryTab, searchTerm, deployFilter, sortBy }) {
    let list = catalog;
    if (categoryTab && categoryTab !== 'all') list = list.filter(e => e.template.cardType === categoryTab);
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        list = list.filter(e => e.template.name.toLowerCase().includes(term));
    }
    if (deployFilter === 'available') list = list.filter(e => e.owned > 0 && e.alloc.available > 0);
    if (deployFilter === 'deployed') list = list.filter(e => e.owned > 0 && e.alloc.available === 0);
    if (deployFilter === 'unowned') list = list.filter(e => e.owned === 0);

    const level = t => t.config?.level || t.skillRequirement || 1;
    const skill = t => t.config?.skill || '';
    const area = t => getAreaSet(t.areaSet)?.name || '';
    return [...list].sort((a, b) => {
        switch (sortBy) {
            case 'area': return area(a.template).localeCompare(area(b.template)) || a.template.name.localeCompare(b.template.name);
            case 'skill': return skill(a.template).localeCompare(skill(b.template)) || a.template.name.localeCompare(b.template.name);
            case 'level': return level(a.template) - level(b.template) || a.template.name.localeCompare(b.template.name);
            default: return a.template.name.localeCompare(b.template.name);
        }
    });
}

/**
 * The inputs/outputs/stats/background bundle LibraryCardPreviewGutter
 * expects for a selected card template.
 */
export function buildProductionData(template) {
    if (!template) return { inputs: [], outputs: [], stats: { level: 1 }, background: null };
    const traits = template.traits || [];
    const config = template.config || {};
    const rawSkill = config.skill || null;
    const parentSkill = SUB_SKILL_TO_PARENT[rawSkill] || rawSkill;
    const subskill = SUB_SKILL_TO_PARENT[rawSkill] ? rawSkill : (config.subskill || null);

    const bgId = template.background || getBiome(template.areaId)?.backgroundImage || getAllAreaSets()[template.areaSet]?.areaArt;
    const background = bgId ? resolveSpritePath(bgId) : null;

    const inputs = traits
        .filter(t => t.type === 'inputslot' && t.itemId)
        .map(t => ({ id: t.itemId, amount: t.quantity || t.count || t.amount || 1 }));
    if (config.minToolTier && config.acceptedToolType) {
        inputs.push({ id: `tool_${config.acceptedToolType}`, name: `${config.acceptedToolType} T${config.minToolTier}`, amount: config.minToolTier, isTool: true });
    }

    const outputs = [];
    traits.forEach(t => {
        if (t.type === 'loot') (t.items || []).forEach(i => outputs.push({ id: i.itemId, amount: i.quantity || i.amount || 1, chance: i.chance }));
        else if (t.type === 'reward') (t.rewards || []).forEach(i => outputs.push({ id: i.itemId, amount: i.quantity || i.amount || 1, chance: i.chance }));
        else if ((t.type === 'yield' || t.type === 'production') && t.itemId) outputs.push({ id: t.itemId, amount: t.quantity || t.count || t.amount || 1, chance: t.chance });
    });
    const combatTrait = traits.find(t => t.type === 'combat');
    const enemyId = combatTrait?.enemyId || template.enemyId;
    if (enemyId) {
        const enemy = getEnemy(enemyId);
        (enemy?.drops || []).forEach(d => outputs.push({ id: d.itemId, amount: d.maxQty || d.quantity || 1, chance: d.chance }));
    }
    (template.outputs || []).forEach(o => {
        if (!outputs.some(existing => existing.id === o.itemId)) outputs.push({ id: o.itemId, amount: o.quantity || o.amount || 1, chance: o.chance });
    });
    const xpValue = config.xp || template.xpAwarded || 0;
    if (xpValue > 0) {
        const skillLabel = parentSkill ? (parentSkill.charAt(0).toUpperCase() + parentSkill.slice(1)) : 'General';
        outputs.unshift({ id: 'xp_stat', name: `${skillLabel} XP`, amount: xpValue, isXP: true, chance: null });
    }

    return {
        inputs, outputs, background,
        stats: {
            skill: parentSkill,
            level: config.level || template.skillRequirement || 1,
            subskill,
            time: config.baseTickTime || null,
            energy: config.energyCost || 1
        }
    };
}
