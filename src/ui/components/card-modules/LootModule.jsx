import React from 'react';
import { cn } from '../../utils/cn.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { useDiscovery } from '../../hooks/useDiscovery.js';

/**
 * Helper to convert enemy drops array to loot table items
 */
export const formatEnemyDrops = (drops) => {
    if (!drops || !Array.isArray(drops)) return [];

    return drops.map(drop => ({
        ...drop, // Preserve original data
        min: drop.minQty || drop.min || 1,
        max: drop.maxQty || drop.max || 1,
        chance: drop.chance || 100
    }));
};

/**
 * Helper to convert task outputs array to loot table items
 */
export const formatTaskOutputs = (outputs) => {
    if (!outputs || !Array.isArray(outputs)) return [];

    return outputs.map(output => ({
        ...output, // Preserve original data
        chance: output.chance || 100
    }));
};

/**
 * Renders a single loot item using EntityRibbon
 */
const LootItem = ({ item, mode, isDiscovered }) => {
    // 0. Handle virtual types (XP)
    if (item.type === 'xp') {
        const name = item.name || 'Experience';
        return (
            <EntityRibbon
                kind="xp"
                name={name}
                quantity={item.quantity}
                chance={item.chance || 100}
                variant="loot"
                size="md"
            />
        );
    }

    // 1. Resolve base item/enemy info
    const isEnemy = item.type === 'combat_trigger' && item.enemyId;
    const rawId = isEnemy ? item.enemyId : (item.itemId || item.id);
    const min = mode === 'loot' ? (item.min ?? item.minQty) : item.minQty;
    const max = mode === 'loot' ? (item.max ?? item.maxQty) : item.maxQty;
    const chance = item.chance !== undefined ? item.chance : 100;

    return (
        <EntityRibbon
            kind={isEnemy ? 'enemy' : 'item'}
            id={rawId}
            name={item.name}
            quantity={min !== undefined && max !== undefined ? undefined : (item.quantity ?? 1)}
            minQty={min}
            maxQty={max}
            chance={chance}
            isDiscovered={isDiscovered}
            variant="loot"
            size="md"
        />
    );
};

export function useLootItems(props, trait, card, rawItems) {
    const xpAwarded = card?.xpAwarded || trait?.xpAwarded || props.template?.xpAwarded || 0;
    
    return React.useMemo(() => {
        if (xpAwarded <= 0) return rawItems;

        const traits = card?.traits || props.template?.traits || [];
        const skillReq = traits.find(t => 
            ['skillrequirement', 'requirement', 'requirements'].includes(t.type?.toLowerCase())
        );
        
        const skillId = skillReq?.skill || 
                       (skillReq?.skillRequirements ? Object.keys(skillReq.skillRequirements)[0] : null) ||
                       trait?.skill;

        const skillDef = skillId ? getSkill(skillId) : null;
        const parentDef = skillDef?.parentSkillId ? getSkill(skillDef.parentSkillId) : skillDef;
        const xpName = parentDef ? `${parentDef.name} XP` : 'Experience';

        return [
            { type: 'xp', quantity: xpAwarded, chance: 100, name: xpName },
            ...rawItems
        ];
    }, [rawItems, xpAwarded, card?.traits, props.template?.traits, trait?.skill]);
}

/**
 * LootModule
 * Reusable module for displaying drops/outputs across card types.
 * Works for both combat cards (enemy drops) and task cards (item outputs).
 */
export const LootModule = React.memo(({ trait, card, isFirst, globalIndex, ...props }) => {
    const { isDiscovered } = useDiscovery();
    const rawItems = props.items || trait?.items || 
                     card?.outputs || props.template?.outputs || 
                     card?.drops || props.template?.drops || 
                     card?.config?.outputs || props.template?.config?.outputs || [];
    const title = props.title || trait?.title || 'Drop Table';
    const mode = props.mode || trait?.mode || 'loot';
    const className = props.className;

    const items = useLootItems(props, trait, card, rawItems);

    if (!items || items.length === 0) return null;

    return (
        <div className={cn("flex flex-col gap-2 w-full mt-2", className)}>
            <div className="text-pixel-base uppercase font-bold tracking-widest text-[#6B7280] border-b border-white/10 pb-0.5 mb-1">
                {title}
            </div>

            <div className="flex flex-col gap-1.5">
                {items.map((item, index) => {
                    // XP is always discovered
                    if (item.type === 'xp') return <LootItem key="xp-reward" item={item} mode={mode} isDiscovered={true} />;

                    // Determine discovery status
                    const discovered = item.enemyId
                        ? isDiscovered('enemy', item.enemyId)
                        : isDiscovered('item', item.itemId);

                    return <LootItem key={`${item.itemId}-${index}`} item={item} mode={mode} isDiscovered={discovered} />;
                })}
            </div>
        </div>
    );
}, (prev, next) => {
    // If we have cards, use rev check. Otherwise (e.g. standalone), use standard memo.
    if (prev.card && next.card) {
        return prev.card._rev === next.card._rev && prev.trait === next.trait;
    }
    return false; // Fallback to re-render if not used via registry with revs
});

export default LootModule;
