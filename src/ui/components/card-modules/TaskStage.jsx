import React from 'react';
import { cn } from '../../utils/cn.js';
import CardSlot from '../base/CardSlot.jsx';
import GIProgressBar from '../base/GIProgressBar.jsx';
import ProjectProgressModule from './ProjectProgressModule.jsx';
import LootModule from './LootModule.jsx';
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
    card,
    hero,
    taskIcon,
    className
}) => {
    if (!card) return null;

    // Pluck properties needed for visual flavors
    const isWorking = card.status === 'working' && hero !== null;

    // Pluck duration/progress for the main Labor bar
    const durationMs = card.baseTickTime || 10000;
    const progressPercent = durationMs > 0
        ? Math.min(100, ((card.progress || 0) / durationMs) * 100)
        : 0;

    // Pluck requirements/outputs
    const progressData = card.progressData || null; // For Gradual Progress arrays
    const outputs = card.outputs || card.config?.outputs || []; // For Loot/Gather outputs

    // Generate fallback text if hero is not assigned
    const slotTrait = card.traits?.find(t => t.type === 'heroslot');
    let requirementText = 'Drag Hero Here';
    if (slotTrait?.requirements?.skill) {
        requirementText += ` (${slotTrait.requirements.skill} Lv.${slotTrait.requirements.skillRequirement || 1})`;
    } else if (card.skill) {
        requirementText += ` (${card.skill})`;
    }

    return (
        <div className={cn("flex flex-col gap-3 w-full", className)}>

            {/* Top Visual Flavor */}
            <TaskDisplay
                hero={hero}
                taskIcon={taskIcon || card.icon || '📜'}
                isHeroWorking={isWorking}
            />

            {/* Main Assignment Row */}
            <div className="flex flex-col w-full gap-2">

                {/* Hero Slot */}
                <div className="w-full">
                    <CardSlot
                        acceptedType="hero"
                        isOccupied={!!hero}
                        heroData={hero}
                        zoneId={`slot-task-${card.id}-0`}
                        label={requirementText}
                        className="w-full h-14" // Slightly taller drop zone for horizontal layout
                    />
                </div>

                {/* Primary Labor Bar */}
                {hero && (
                    <div className="w-full">
                        <GIProgressBar
                            current={progressPercent}
                            max={100}
                            color={card.status === 'paused' ? 'danger' : 'task'}
                            height="md"
                            showText={false}
                        />
                        <div className="flex justify-between items-center text-[10px] text-gray-500 font-pixel mt-1 uppercase tracking-wide">
                            <span>Status: {card.status === 'paused' ? 'Missing Materials' : (isWorking ? 'Working...' : 'Idle')}</span>
                            <span>{Math.floor((card.progress || 0) / 1000)}s / {Math.floor(durationMs / 1000)}s</span>
                        </div>
                    </div>
                )}
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

            {/* Generated Items (Standard Foraging/Crafting) */}
            {outputs.length > 0 && (
                <div className="mt-1">
                    <LootModule
                        items={outputs}
                        title="Outputs"
                        mode="output"
                    />
                </div>
            )}
        </div>
    );
};

export default TaskStage;
