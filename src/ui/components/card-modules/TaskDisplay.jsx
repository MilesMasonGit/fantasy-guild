import React, { useEffect, useState, useMemo } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { CardSlot } from '../base/CardSlot.jsx';
import { Plus, ShoppingBag } from 'lucide-react';
import { useDiscovery } from '../../hooks/useDiscovery.js';
import { resolvePotentialOutputs } from '../../utils/theaterUtils.js';
import { getRecipe, getDropTable } from '../../../config/registries/index.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';

/**
 * TaskDisplay
 * A purely visual flavor component used on Task Cards. 
 * Shows the Hero avatar visually interacting with a static Task icon/object.
 * 
 * @param {Object} props
 * @param {Object} props.hero - The assigned hero.
 * @param {String|ReactNode} props.taskIcon - Visual representation of the task/item (e.g., '🌲')
 * @param {Boolean} props.isHeroWorking - Triggers the rhythmic working animation loop
 */
export const TaskDisplay = React.memo(({ trait, card, isFirst, globalIndex, isHovered = false, ...props }) => {
    const engine = useEngine();
    const [workStrike, setWorkStrike] = useState(false);
    const [currentOutputIndex, setCurrentOutputIndex] = useState(0);

    const { isDiscovered } = useDiscovery();

    // Subscribe to live hero data
    const heroId = props.hero?.id || card?.assignedHeroId;
    const hero = useGameState(
        state => heroId ? engine.HeroManager.getHero(heroId) : null,
        ['heroes_updated'],
        null,
        { deps: [heroId] }
    );

    const taskIcon = props.taskIcon || trait?.taskIcon || '❓';
    const isHeroWorking = props.isHeroWorking || card?.status === 'active' || card?.isWorking;
    const className = props.className;

    // Resolve potential outputs for this task/station
    const potentialOutputs = useMemo(() => {
        if (!card) return [];

        let rawOutputs = [];
        // For stations, if a recipe is selected, only show that recipe's outputs
        if (card.selectedRecipeId) {
            const recipe = getRecipe(card.selectedRecipeId);
            if (recipe && recipe.outputs && Array.isArray(recipe.outputs)) {
                rawOutputs = recipe.outputs.map(o => {
                    const id = o.itemId || o.id;
                    const isLoot = getDropTable(id) !== null;
                    return { type: isLoot ? 'loot_table' : 'item', id };
                });
            }
        } else {
            rawOutputs = resolvePotentialOutputs(card, null);
        }

        // Map undiscovered items/enemies to a single unified placeholder
        const mapped = rawOutputs.map(out => {
            if (out.type === 'enemy') {
                return isDiscovered('enemy', out.id) ? out : { type: 'undiscovered', id: 'undiscovered' };
            }
            if (out.type === 'item') {
                return isDiscovered('item', out.id) ? out : { type: 'undiscovered', id: 'undiscovered' };
            }
            return out; // Loot tables, etc.
        });

        // Deduplicate the mapped list
        const deduped = [];
        for (const out of mapped) {
            if (!deduped.some(d => d.type === out.type && d.id === out.id)) {
                deduped.push(out);
            }
        }
        return deduped;
    }, [card, card?.selectedRecipeId, isDiscovered]);

    // Cycle index timer every 2.5s
    useEffect(() => {
        if (potentialOutputs.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentOutputIndex(prev => prev + 1);
        }, 2500);

        return () => clearInterval(interval);
    }, [potentialOutputs.length]);

    // Simulate "Work Strikes" (Lunging) when working
    useEffect(() => {
        if (!isHeroWorking) return;

        const interval = setInterval(() => {
            setWorkStrike(true);
            setTimeout(() => setWorkStrike(false), 300);
        }, 2000); // Lunge every 2 seconds

        return () => clearInterval(interval);
    }, [isHeroWorking]);

    const renderAvatar = (entity, fallbackIcon) => {
        const spritePath = resolveSpritePath(entity);
        const icon = entity?.icon || fallbackIcon;

        if (spritePath) {
            return (
                <div className="relative w-32 h-32 flex items-center justify-center">
                    <img 
                        src={spritePath} 
                        alt="Avatar"
                        className="w-full h-full object-contain pixel-art"
                    />
                </div>
            );
        }

        return (
            <div className="text-5xl select-none w-32 h-32 flex items-center justify-center animate-bob">
                {icon}
            </div>
        );
    };

    // Render current target output in cycle
    const renderTargetSide = () => {
        if (potentialOutputs.length === 0) {
            return renderAvatar(taskIcon, '📦');
        }

        const activeOutput = potentialOutputs[currentOutputIndex % potentialOutputs.length];

        if (activeOutput.type === 'undiscovered') {
            return (
                <div className="text-5xl select-none w-32 h-32 flex items-center justify-center animate-bob opacity-60">
                    ❓
                </div>
            );
        }

        if (activeOutput.type === 'loot_table') {
            return (
                <div className="w-32 h-32 flex items-center justify-center text-gi-accent animate-bob">
                    <ShoppingBag className="w-14 h-14 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
                </div>
            );
        }

        if (activeOutput.type === 'enemy') {
            const resolvedEnemy = getEnemy(activeOutput.id);
            return renderAvatar(resolvedEnemy, '👹');
        }

        // Default to item output
        const resolvedItem = getItem(activeOutput.id);
        return renderAvatar(resolvedItem, '📦');
    };

    return (
        <div className={cn(
            "relative w-full overflow-hidden transition-all duration-500 ease-in-out",
            (!hero && !isHovered) ? "h-0 opacity-0 pointer-events-none" : "h-40 opacity-100 pointer-events-auto",
            className
        )}>
            <div className={cn("absolute inset-0 flex items-center", hero ? "justify-between px-10" : "justify-center")}>
                {/* Hero Avatar (Worker) */}
                {hero && (
                    <div className={cn(
                        "flex flex-col items-center justify-center transition-transform duration-150 z-10 animate-bob",
                        // TODO: Update these CSS transform lunges into actual animation frames in future development
                        workStrike ? "translate-x-12 scale-110" : ""
                    )}>
                        {renderAvatar(hero, '👤')}
                    </div>
                )}

                {/* Task Target (Resource, Item, etc.) */}
                <div className={cn(
                    "flex flex-col items-center justify-center z-10 animate-bob",
                )} style={{ animationDelay: '0.5s' }}>
                    <div className={cn("transition-transform duration-75", workStrike && "animate-rattle")}>
                        {renderTargetSide()}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default TaskDisplay;
