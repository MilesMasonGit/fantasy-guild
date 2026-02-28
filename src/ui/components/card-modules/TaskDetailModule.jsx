import React from 'react';
import { cn } from '../../utils/cn.js';
import LootModule from './LootModule.jsx';

/**
 * Calculate speed breakdown from all sources, matching the legacy Vanilla logic.
 */
function calculateSpeedBreakdown(cardInstance, hero, template) {
    const breakdown = [];

    // Fallback metadata if not fully populated
    const metadata = cardInstance?.speedMetadata || {
        templateBaseTime: template?.baseTickTime || 10000,
        biomeEffects: []
    };

    const baseTime = metadata.templateBaseTime;
    let currentTotal = baseTime;

    // 1. Base speed
    breakdown.push({
        source: 'Base',
        value: 0,
        timeMs: currentTotal,
        percent: 0
    });

    // 2. Biome/Modifier effects
    if (metadata.biomeEffects && metadata.biomeEffects.length > 0) {
        metadata.biomeEffects.forEach(effect => {
            const deltaMs = baseTime * (-effect.value);
            currentTotal += deltaMs;
            breakdown.push({
                source: effect.source,
                value: deltaMs,
                timeMs: currentTotal,
                percent: -effect.value * 100
            });
        });
    }

    // 3. Hero skill bonus
    if (hero && template?.skill) {
        const skillData = hero.skills?.[template.skill];
        const skillLevel = typeof skillData === 'number'
            ? skillData
            : (skillData?.level ?? 0);

        if (skillLevel > 0) {
            const speedBonus = skillLevel * 0.005; // 0.5% per level
            const multiplier = 1 / (1 + speedBonus);
            const newTotal = currentTotal * multiplier;
            const deltaMs = newTotal - currentTotal;
            currentTotal = newTotal;

            breakdown.push({
                source: `${hero.name} (${template.skill} Lv ${skillLevel})`,
                value: deltaMs,
                timeMs: currentTotal,
                percent: (multiplier - 1) * 100
            });
        }
    }

    return breakdown;
}

/**
 * Component to explicitly render the speed modifiers visually.
 */
const EffectBreakdown = ({ cardInstance, hero, template }) => {
    if (!template) return null;

    const breakdown = calculateSpeedBreakdown(cardInstance, hero, template);

    // Only show if there's an active modifier
    if (breakdown.length <= 1) return null;

    const finalSpeed = breakdown[breakdown.length - 1].timeMs;

    return (
        <div className="flex flex-col gap-2 w-full mt-2">
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#6B7280] border-b border-white/10 pb-0.5">
                Speed Modifiers
            </div>

            <div className="flex flex-col gap-1 text-xs">
                {breakdown.map((effect, index) => {
                    if (index === 0) {
                        return (
                            <div key={`effect-${index}`} className="flex justify-between text-gi-muted">
                                <span>{effect.source}</span>
                                <span>{(effect.timeMs / 1000).toFixed(1)}s</span>
                            </div>
                        );
                    }

                    const isFaster = effect.value < 0;
                    const sign = effect.value > 0 ? '+' : '';

                    return (
                        <div key={`effect-${index}`} className="flex justify-between">
                            <span className="text-gray-300">{effect.source}</span>
                            <span className={isFaster ? 'text-gi-success' : 'text-gi-danger'}>
                                {sign}{effect.percent.toFixed(1)}% ({sign}{(effect.value / 1000).toFixed(1)}s)
                            </span>
                        </div>
                    );
                })}

                <div className="flex justify-between font-bold text-gi-primary mt-1 pt-1 border-t border-white/5">
                    <span>Final Speed</span>
                    <span>{(finalSpeed / 1000).toFixed(1)}s</span>
                </div>
            </div>
        </div>
    );
};

/**
 * TaskDetailModule
 * The primary detailed breakdown for a Task card. It strings together smaller elements to show task-specific mechanics.
 * 
 * @param {Object} props
 * @param {Object} props.card - The full card instance object
 * @param {Object} props.hero - The assigned hero (can be null)
 */
export const TaskDetailModule = ({ card, hero, className }) => {
    // Graceful fallback during development without an engine instance
    if (!card) return null;

    // In production, the card object will have a reference to its template
    // For now we mock it if it doesn't exist
    const template = card.template || card;
    const category = card.taskCategory || template.taskCategory || 'General';

    return (
        <div className={cn("flex flex-col gap-3 w-full bg-black/20 rounded p-3 border border-white/5", className)}>

            {/* Category Badge */}
            <div className="flex justify-between items-center w-full">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#6B7280]">Category</span>
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gi-primary/20 text-gi-primary border border-gi-primary/30">
                    {category}
                </span>
            </div>

            {/* Loot Table */}
            {template.outputs && template.outputs.length > 0 && (
                <LootModule
                    title="Potential Drops"
                    items={template.outputs}
                    mode="loot"
                />
            )}

            {/* Speed Modifiers */}
            <EffectBreakdown
                cardInstance={card}
                hero={hero}
                template={template}
            />

        </div>
    );
};

export default TaskDetailModule;
