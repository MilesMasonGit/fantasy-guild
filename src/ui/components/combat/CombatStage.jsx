import React from 'react';
import { cn } from '../../utils/cn.js';
import HeroGroup from '../hero/HeroGroup.jsx';
import EnemyStatBlock from './EnemyStatBlock.jsx';
import CombatDisplay from './CombatDisplay.jsx';
import CombatTypeSelector from './CombatTypeSelector.jsx';
import CombatLog from './CombatLog.jsx';
import LootModule from '../card-modules/LootModule.jsx';

/**
 * CombatStage
 * The main structural container for a combat encounter.
 * Orchestrates the layout of the combat visual display, the rock-paper-scissors matchup, 
 * and the Hero vs Enemy stat blocks.
 * 
 * @param {Object} props
 * @param {Object} props.card - The active Combat Card instance.
 * @param {Object} props.hero - Current assigned hero (if any).
 * @param {Object} props.enemy - The active enemy template/stats.
 * @param {Function} props.onStyleChange - Callback when the player changes attack tactis.
 */
export const CombatStage = ({
    card,
    hero,
    enemy,
    onStyleChange,
    className
}) => {
    if (!card || !enemy) return null;

    // Pluck combat state bounds from the card
    const isHeroAttacking = card.heroIsAttacking || false;
    const isEnemyAttacking = card.enemyIsAttacking || false;
    const selectedStyle = card.selectedStyle || 'melee';

    // Pluck potential loot from the card config
    const outputs = card.outputs || card.config?.outputs || [];

    return (
        <div className={cn("flex flex-col gap-3 w-full", className)}>

            {/* Top Visual Flavor */}
            <CombatDisplay
                hero={hero}
                enemy={enemy}
                isHeroAttacking={isHeroAttacking}
                isEnemyAttacking={isEnemyAttacking}
            />

            {/* Tactical Toggle (Center) */}
            <CombatTypeSelector
                cardId={card.id}
                selectedStyle={selectedStyle}
                enemyType={enemy.combatType || 'melee'}
                onStyleChange={onStyleChange}
            />

            {/* The Duelists (2-Column Layout) */}
            <div className="flex gap-2 justify-between w-full">
                {/* Left: Hero Assignment & Stats */}
                <div className="flex-1 min-w-[140px]">
                    <HeroGroup
                        card={card}
                        hero={hero}
                        slotIndex={0}
                        selectedStyle={selectedStyle}
                    />
                </div>

                {/* 'VS' Divider 
                <div className="flex flex-col justify-center items-center text-[10px] font-bold text-gray-500 font-pixel opacity-50 px-1">
                    VS
                </div> */}

                {/* Right: Enemy Stats */}
                <div className="flex-1 min-w-[140px] flex justify-end">
                    <EnemyStatBlock
                        card={card}
                        enemy={enemy}
                    />
                </div>
            </div>

            {/* Rewards / Loot Table (Bottom) */}
            {outputs.length > 0 && (
                <div className="mt-2">
                    <LootModule
                        items={outputs}
                        title="Potential Drops"
                        mode="loot"
                    />
                </div>
            )}

            {/* Combat Narrative (Bottom) */}
            <div className="mt-2 w-full">
                <CombatLog logs={card.combatLogs || []} />
            </div>
        </div>
    );
};

export default CombatStage;
