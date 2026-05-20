import React from 'react';
import { cn } from '../../utils/cn.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getSkill } from '../../../config/registries/index.js';
import { Package } from 'lucide-react';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { Sword, HelpCircle } from 'lucide-react';
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
 * Renders a single loot item
 */
const LootItem = ({ item, mode, isDiscovered }) => {
    // 0. Handle virtual types (XP)
    if (item.type === 'xp') {
        const name = item.name || 'Experience';
        return (
            <div
                className="flex items-center gap-2 p-1.5 w-full bg-gi-surface/50 border border-gi-border hover:border-gi-primary/30 rounded transition-colors group"
                title={name}
            >
                {/* Standardized Icon Container */}
                <div className="flex-shrink-0 w-8 h-8 bg-black/40 border border-white/5 rounded shadow-inner flex items-center justify-center text-gi-accent">
                    <span className="text-lg leading-none">✨</span>
                </div>

                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <span className="text-pixel-base font-bold text-gi-text truncate uppercase">
                        {name}
                    </span>
                    <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-pixel-sm font-bold text-gi-primary">+{item.quantity}</span>
                        <span 
                            className="text-[7px] font-bold text-gi-muted uppercase tracking-wider leading-none mt-0.5"
                            style={{ textShadow: 'var(--text-shadow-sm)' }}
                        >
                            100%
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // 1. Resolve base item/enemy info
    let itemDef = item.itemId ? getItem(item.itemId) : null;
    let name = item.name || itemDef?.name || item.itemId || 'Unknown';
    let icon = item.icon || itemDef?.icon || <Package size={16} />;

    // 2. Handle combat triggers (Enemies as loot)
    if (item.type === 'combat_trigger' && item.enemyId) {
        const enemy = getEnemy(item.enemyId);
        name = item.name || enemy?.name || 'Ambush!';
        icon = item.icon || <Sword size={16} className="text-gi-danger" />;
        itemDef = enemy;
    }

    // 3. APPLY MASKING (Must be last)
    if (!isDiscovered) {
        name = '???';
        icon = <HelpCircle size={16} className="text-gi-muted" />;
        // Pass a scrubbed object to ItemIcon to stop it from resolving the real sprite
        itemDef = { icon: '❓', name: '???' };
    }

    // 4. Build quantity text
    let qtyText = '1';
    if (mode === 'loot' && item.min !== undefined && item.max !== undefined) {
        qtyText = item.min === item.max ? `${item.min}` : `${item.min}-${item.max}`;
    } else if (item.minQty !== undefined && item.maxQty !== undefined) {
        qtyText = item.minQty === item.maxQty ? `${item.minQty}` : `${item.minQty}-${item.maxQty}`;
    } else if (item.quantity !== undefined) {
        qtyText = `${item.quantity}`;
    }

    const chance = item.chance !== undefined ? item.chance : 100;
    const isRare = chance < 10;

    return (
        <div
            className="flex items-center gap-2 p-1.5 w-full bg-gi-surface/50 border border-gi-border hover:border-gi-primary/30 rounded transition-colors"
            title={name}
        >
            <ItemIcon item={itemDef || item} size={32} isDiscovered={isDiscovered} className="bg-black/40 border border-white/5 rounded shadow-inner" />
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <span className="text-pixel-base font-bold text-gi-text truncate uppercase">
                    {name}
                </span>
                <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-pixel-sm font-bold text-gi-primary">×{qtyText}</span>
                    <span 
                        className={cn(
                            "text-[7px] font-bold uppercase tracking-wider leading-none mt-0.5",
                            isRare ? "text-gi-accent" : "text-gi-muted"
                        )}
                        style={{ textShadow: 'var(--text-shadow-sm)' }}
                    >
                        {chance}%
                    </span>
                </div>
            </div>
        </div>
    );
};

/**
 * LootModule
 * Reusable module for displaying drops/outputs across card types.
 * Works for both combat cards (enemy drops) and task cards (item outputs).
 */
export const LootModule = React.memo(({ trait, card, isFirst, globalIndex, ...props }) => {
    const { isDiscovered } = useDiscovery();
    const rawItems = props.items || trait?.items || [];
    const title = props.title || trait?.title || 'Drop Table';
    const mode = props.mode || trait?.mode || 'loot';
    const className = props.className;

    // Inject XP Award as the first item if available
    const xpAwarded = card?.xpAwarded || trait?.xpAwarded || props.template?.xpAwarded || 0;
    
    const items = React.useMemo(() => {
        if (xpAwarded <= 0) return rawItems;

        // 1. Resolve Skill Requirement from card traits or template
        const traits = card?.traits || props.template?.traits || [];
        const skillReq = traits.find(t => 
            ['skillrequirement', 'requirement', 'requirements'].includes(t.type?.toLowerCase())
        );
        
        // 2. Extract Skill ID
        const skillId = skillReq?.skill || 
                       (skillReq?.skillRequirements ? Object.keys(skillReq.skillRequirements)[0] : null) ||
                       trait?.skill;

        // 3. Resolve Display Name
        const skillDef = skillId ? getSkill(skillId) : null;
        const parentDef = skillDef?.parentSkillId ? getSkill(skillDef.parentSkillId) : skillDef;
        const xpName = parentDef ? `${parentDef.name} XP` : 'Experience';

        return [
            { type: 'xp', quantity: xpAwarded, chance: 100, name: xpName },
            ...rawItems
        ];
    }, [rawItems, xpAwarded, card?.traits, props.template?.traits, trait?.skill]);

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
