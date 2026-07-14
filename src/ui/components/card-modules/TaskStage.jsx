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
export const TASK_VERBS = {
    // Parent Skill Defaults (15-skill system)
    combat: 'Fighting',
    melee: 'Fighting',
    ranged: 'Fighting',
    magic: 'Fighting',
    defense: 'Defending',
    labor: 'Laboring',
    forge: 'Forging',
    aquatic: 'Swimming',
    nature: 'Foraging',
    cooking: 'Cooking',
    alchemy: 'Brewing',
    science: 'Researching',
    occult: 'Scheming',
    crime: 'Thieving',
    explore: 'Exploring',
    social: 'Chatting',

    // Legacy parent ids (pre-15-skill content)
    industry: 'Working',
    nautical: 'Swimming',
    culinary: 'Cooking',

    // Sub-Skills
    mining: 'Mining',
    quarrying: 'Quarrying',
    digging: 'Digging',
    logging: 'Logging',
    smelting: 'Smelting',
    smithing: 'Smithing',
    crafting: 'Crafting',
    armoring: 'Armoring',
    foraging: 'Foraging',
    herbalism: 'Gathering',
    hunting: 'Hunting',
    harvesting: 'Harvesting',
    farming: 'Farming',
    ranching: 'Ranching',
    fishing: 'Fishing',
    sailing: 'Sailing',
    swimming: 'Swimming',
    diving: 'Diving',
    baking: 'Baking',
    brewing: 'Brewing',
    butchery: 'Butchering',
    distilling: 'Distilling',
    transmutation: 'Transmuting',
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
    medicine: 'Healing',
    research: 'Researching',
    scouting: 'Scouting',
    mapping: 'Mapping',
    camping: 'Camping',
    navigation: 'Navigating'
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
    isHovered,
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
                    isHovered={isHovered}
                    card={card}
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
