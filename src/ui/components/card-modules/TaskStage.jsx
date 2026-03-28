import React from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { cn } from '../../utils/cn.js';
import CardSlot from '../base/CardSlot.jsx';
import ProgressBar from '../base/ProgressBar.jsx';
import ProjectProgressModule from './ProjectProgressModule.jsx';
import LootModule from './LootModule.jsx';
import { getItem, getCard } from '../../../config/registries/index.js';
import TaskDisplay from './TaskDisplay.jsx';

/**
 * TaskStage
 * The non-combat equivalent to CombatStage. Orchestrates the layout 
 * for assigning a hero and tracking their labor/focus on a specific job.
 * 
 * @param {Object} props
 * @param {Object} props.card - The active Task or Explore Card instance.
 * @param {Object} props.hero - Current assigned hero (if any).
 * @param {String|ReactNode} props.taskIcon - The visual icon of the task (e.g. tree, ore, blueprint)
 */
export const TaskStage = ({
    trait,
    card,
    hero: propHero,
    taskIcon: propTaskIcon,
    className
}) => {
    const engine = useEngine();
    if (!card) return null;

    // Resolve hero from props or engine
    const heroId = propHero?.id || card.assignedHeroId || (card.heroSlots ? Object.values(card.heroSlots)[0] : null);
    const hero = propHero || (heroId ? engine.HeroManager.getHero(heroId) : null);

    // Pluck properties needed for visual flavors
    const isWorking = card.status === 'active' && hero !== null;

    // Pluck duration/progress for the main Labor bar
    const durationMs = card.baseTickTime || 10000;
    const progressPercent = durationMs > 0
        ? Math.min(100, ((card.progress || 0) / durationMs) * 100)
        : 0;

    // Resolve template/config for more robust fallbacks
    const template = getCard(card.templateId);
    const config = template?.config || card.config || {};

    // Pluck requirements/outputs
    const progressData = card.progressData || config.progressData || null; // For Gradual Progress arrays
    const outputs = card.outputs || config.outputs || []; // For Loot/Gather outputs

    // Dynamic Task Verb (e.g., "Mining", "Crafting")
    const category = card.taskCategory || card.config?.taskCategory || 'Working';
    const taskVerb = category.charAt(0).toUpperCase() + category.slice(1);

    return (
        <div className={cn("flex flex-col gap-2 w-full", className)}>
            {/* Main Task Progress Section - Priority Position */}
            <div className="flex flex-col w-full gap-2">
                {/* Primary Labor Bar - Only visible if hero assigned or working */}
                {hero && (
                    <div className="w-full">
                        <ProgressBar
                            cardId={card.id}
                            color={card.status === 'paused' ? 'danger' : (card.skill || card.taskCategory || 'task')}
                            size="md"
                            showText={false}
                        />
                        <div className="flex justify-between items-center text-gray-500 font-pixel mt-1 uppercase tracking-wide">
                            <span className="text-pixel-sm">
                                {card.status === 'paused' && card.missingRequirements?.[0]
                                    ? `Needs ${card.missingRequirements[0].replace(/^(Empty|Invalid)\s(Slot|Item):\s*/i, '')}`
                                    : (isWorking ? `${taskVerb}...` : (card.status === 'paused' ? 'Needs Requirements' : taskVerb))}
                            </span>
                            <span className="text-pixel-base text-gray-400">
                                {Math.floor(durationMs / 1000)}<span className="text-pixel-sm">s</span> &gt; <span className={cn(
                                    (card.currentTickTime || durationMs) < durationMs ? 'text-green-400' :
                                        (card.currentTickTime || durationMs) > durationMs ? 'text-red-400' :
                                            'text-gray-400'
                                )}>
                                    {Math.round((card.currentTickTime || durationMs) / 100) / 10}<span className="text-pixel-sm">s</span>
                                </span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Visual Flavor - Moved below progress */}
            <TaskDisplay
                hero={hero}
                taskIcon={(() => {
                    const icon = trait?.taskIcon || propTaskIcon || outputs[0]?.itemId || template?.icon || card.icon || '📜';
                    // If it's a string ID, try to resolve to full item object for better tooltips/names
                    if (typeof icon === 'string' && icon.length > 4) {
                        return getItem(icon) || icon;
                    }
                    return icon;
                })()}
                isHeroWorking={isWorking}
            />

            {/* Granular Material Requirements (Projects/Explore) */}
            {progressData && (
                <div className="mt-1">
                    <ProjectProgressModule
                        progressData={progressData}
                        showTitle={true}
                    />
                </div>
            )}
        </div>
    );
};

export default TaskStage;
