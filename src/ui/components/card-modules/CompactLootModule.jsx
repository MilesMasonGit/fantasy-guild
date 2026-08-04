import React from 'react';
import { cn } from '../../utils/cn.js';
import { useDiscovery } from '../../hooks/useDiscovery.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useLootItems } from './LootModule.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { Package, Sword, HelpCircle } from 'lucide-react';

const MAX_ICONS = 4;

export const CompactLootModule = React.memo(({ trait, card, template, ...props }) => {
    const engine = useEngine();
    const { isDiscovered } = useDiscovery();
    const rawItems = props.items || trait?.items || 
                     card?.outputs || template?.outputs || 
                     card?.drops || template?.drops || 
                     card?.config?.outputs || template?.config?.outputs || [];
    const title = props.title || trait?.title || 'Outputs';
    const mode = props.mode || trait?.mode || 'loot';

    const items = useLootItems(props, trait, card, rawItems);

    if (!items || items.length === 0) return null;

    const topItems = items.slice(0, MAX_ICONS);
    const overflowCount = items.length - MAX_ICONS;

    const handleOpenLootTable = (e) => {
        e.stopPropagation();
        engine.EventBus.publish('ui:open_loot_table', {
            trait,
            card,
            template,
            items: rawItems,
            mode,
            title
        });
    };

    return (
        <div className={cn("flex flex-col gap-2 w-full mt-2", props.className)}>
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#6B7280]">
                {title}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
                {topItems.map((item, index) => {
                    // 0. Handle virtual types (XP)
                    if (item.type === 'xp') {
                        return (
                            <div key={`xp-${index}`} className="w-8 h-8 flex-shrink-0 bg-black/40 border border-white/5 rounded shadow-inner flex items-center justify-center text-gi-accent" title={item.name || 'Experience'}>
                                <span className="text-lg leading-none">✨</span>
                            </div>
                        );
                    }

                    // 1. Resolve base item/enemy info
                    let itemDef = item.itemId ? getItem(item.itemId) : null;
                    let name = item.name || itemDef?.name || item.itemId || 'Unknown';
                    let icon = item.icon || itemDef?.icon || <Package size={16} />;

                    // 2. Handle combat triggers
                    if (item.type === 'combat_trigger' && item.enemyId) {
                        const enemy = getEnemy(item.enemyId);
                        name = item.name || enemy?.name || 'Ambush!';
                        itemDef = enemy;
                    }

                    // 3. APPLY MASKING
                    let discovered = item.enemyId
                        ? isDiscovered('enemy', item.enemyId)
                        : isDiscovered('item', item.itemId);

                    if (!discovered) {
                        name = '???';
                        itemDef = { icon: '❓', name: '???' };
                    }

                    return (
                        <div key={`${item.itemId || item.enemyId}-${index}`} className="flex-shrink-0" title={name}>
                            <ItemIcon item={itemDef || item} size={32} isDiscovered={discovered} className="bg-black/40 border border-white/5 rounded shadow-inner" />
                        </div>
                    );
                })}
                {overflowCount > 0 && (
                    <button 
                        onClick={handleOpenLootTable}
                        className="h-8 px-2 bg-gi-surface/50 border border-gi-border hover:border-gi-primary/30 rounded flex items-center justify-center text-pixel-sm font-bold text-gi-muted hover:text-gi-primary transition-colors cursor-pointer"
                    >
                        +{overflowCount} more
                    </button>
                )}
            </div>
        </div>
    );
});

export default CompactLootModule;
