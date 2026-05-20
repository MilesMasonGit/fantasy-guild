import React from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import CardSlot from '../base/CardSlot.jsx';
import ProgressBar from '../base/ProgressBar.jsx';
import ProjectProgressModule from './ProjectProgressModule/index.jsx';
import LootModule from './LootModule.jsx';
import { getItem, getCard } from '../../../config/registries/index.js';
import { SKILLS, SUB_SKILL_TO_PARENT, getSkill } from '../../../config/registries/skillRegistry.js';
import TaskDisplay from './TaskDisplay.jsx';

// --- Verb Mappings ---
const TASK_VERBS = {
    // Parent Skill Defaults
    combat: 'Fighting',
    melee: 'Fighting',
    ranged: 'Fighting',
    magic: 'Fighting',
    industry: 'Working',
    nature: 'Foraging',
    nautical: 'Swimming',
    culinary: 'Cooking',
    social: 'Chatting',
    crime: 'Thieving',
    occult: 'Scheming',
    science: 'Researching',

    // Sub-Skills
    mining: 'Mining',
    logging: 'Logging',
    smelting: 'Smelting',
    smithing: 'Smithing',
    crafting: 'Crafting',
    foraging: 'Foraging',
    herbalism: 'Gathering',
    hunting: 'Hunting',
    harvesting: 'Harvesting',
    fishing: 'Fishing',
    sailing: 'Sailing',
    swimming: 'Swimming',
    cooking: 'Cooking',
    brewing: 'Brewing',
    butchery: 'Butchering',
    bartering: 'Bartering',
    recruitment: 'Recruiting',
    propaganda: 'Promoting',
    diplomacy: 'Negotiating',
    pickpocketing: 'Stealing',
    lockpicking: 'Picking',
    stealth: 'Sneaking',
    rituals: 'Ritualizing',
    summoning: 'Summoning',
    enchanting: 'Enchanting',
    engineering: 'Engineering',
    alchemy: 'Transmuting',
    medicine: 'Healing'
};

/**
 * TaskStage
 * The non-combat equivalent to CombatStage. Orchestrates the layout 
 * for assigning a hero and tracking their labor/focus on a specific job.
 */
export const TaskStage = React.memo(({
    trait,
    card,
    hero: propHero,
    taskIcon: propTaskIcon,
    className
}) => {
    const engine = useEngine();
    if (!card) return null;

    // Subscribe to live hero data to ensure sprite/name changes reflect instantly
    const heroId = propHero?.id || card.assignedHeroId;
    const hero = useGameState(
        state => heroId ? engine.HeroManager.getHero(heroId) : null,
        ['heroes_updated'],
        null,
        { deps: [heroId] }
    );

    // Pluck properties needed for visual flavors
    const isWorking = card.status === 'active' && hero !== null;

    // Pluck duration/progress for the main Labor bar
    const durationMs = card.baseTickTime || 10000;
    
    // Resolve template/config for more robust fallbacks
    const template = React.useMemo(() => getCard(card.templateId), [card.templateId]);
    const config = template?.config || card.config || {};

    // Pluck requirements/outputs
    const progressData = card.progressData || config.progressData || null; // For Gradual Progress arrays
    const outputs = card.outputs || config.outputs || []; // For Loot/Gather outputs

    // Dynamic Task Verb Resolution
    const taskVerb = React.useMemo(() => {
        // 1. Resolve specific skill/subskill from card or trait
        const skillId = card.skill || trait?.skill || card.config?.skill;
        
        // 2. Lookup Verb (Subskill > Parent > Default)
        let verb = TASK_VERBS[skillId?.toLowerCase()];
        
        // 3. Fallback to category name if not in map
        if (!verb) {
            const category = card.taskCategory || card.config?.taskCategory || 'Working';
            verb = category.charAt(0).toUpperCase() + category.slice(1);
        }

        return isWorking ? `${verb}...` : verb;
    }, [card.skill, trait?.skill, card.taskCategory, isWorking]);

    // Resolve the display color for the progress bar
    const barColor = React.useMemo(() => {
        if (card.missingRequirements?.length > 0) return 'danger';
        
        const skillId = card.skill || trait?.skill || card.config?.skill;
        if (!skillId) return card.taskCategory || 'task';

        const lowerSkill = skillId.toLowerCase();
        // Return parent skill if it's a subskill, otherwise return the skill itself
        return SUB_SKILL_TO_PARENT[lowerSkill] || lowerSkill;
    }, [card.skill, trait?.skill, card.taskCategory, card.missingRequirements]);

    return (
        <div className={cn("flex flex-col flex-1 gap-2 w-full", className)}>
            {/* Main Task Progress Section - Priority Position */}
            <div className="flex flex-col w-full gap-2 shrink-0 bg-black/30 p-2 rounded-lg border border-white/5">
                {/* Primary Labor Bar - Only visible if hero assigned or working */}
                {hero && (
                    <div className="w-full">
                        <ProgressBar
                            current={card.progress || 0}
                            max={card.currentTickTime || card.baseTickTime || 10000}
                            color={barColor}
                            size="md"
                            showText={false}
                            transitionDuration="100ms"
                        />
                        <div className="flex justify-between items-center text-gray-500 font-pixel mt-1 uppercase tracking-wide">
                            <span 
                                className={cn(
                                    "text-pixel-base",
                                    card.missingRequirements?.[0] ? "text-yellow-400" : (isWorking ? "text-green-400" : "text-gray-500")
                                )}
                                style={{ textShadow: 'var(--text-shadow-base)' }}
                            >
                                {card.missingRequirements?.[0]
                                    ? `Needs ${card.missingRequirements[0].replace(/^(Empty|Invalid)\s(Slot|Item):\s*/i, '')}`
                                    : taskVerb}
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

            {/* Visual Flavor - Centered Theatre */}
            <div className="flex-1 flex flex-col justify-center min-h-[160px]">
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
            </div>

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
});

export default TaskStage;
