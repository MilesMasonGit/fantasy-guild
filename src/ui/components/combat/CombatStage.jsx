import React from 'react';
import { cn } from '../../utils/cn.js';
import HeroGroup from '../hero/HeroGroup.jsx';
import EnemyStatBlock from './EnemyStatBlock.jsx';
import CombatDisplay from './CombatDisplay.jsx';
import CombatLog from './CombatLog.jsx';
import LootModule from '../card-modules/LootModule.jsx';
import { getClass } from '../../../config/registries/classRegistry.js';

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
    className
}) => {
    if (!card || !enemy || !hero) return null;

    // Pluck combat state bounds from the card (Namespaced)
    const combat = card.combat || {};
    const isHeroAttacking = combat.heroIsAttacking || false;
    const isEnemyAttacking = combat.enemyIsAttacking || false;
    // Pluck potential loot from the card config
    const outputs = card.outputs || card.config?.outputs || [];

    // Resolve hero's fixed combat style for the UI (HeroGroup)
    const heroClass = hero ? getClass(hero.classId) : null;
    const combatStyle = heroClass?.combatStyle || 'melee';

    return (
        <div className={cn("flex flex-col flex-1 items-center gap-1 w-full", className)}>
            {/* 1. Hero Info (Top) */}
            <div className="w-full flex justify-center shrink-0">
                <HeroGroup
                    card={card}
                    hero={hero}
                    slotIndex={0}
                    selectedStyle={combatStyle}
                    className="w-full max-w-[280px]"
                />
            </div>

            {/* 2. Visual Duelist Frame (Center Theatre) */}
            <div className="flex-1 flex flex-col justify-center w-full min-h-[160px]">
                <CombatDisplay
                    card={card}
                    hero={hero}
                    enemy={enemy}
                />
            </div>

            {/* 3. Enemy Info (Bottom) */}
            <div className="w-full flex justify-center shrink-0">
                <EnemyStatBlock
                    card={card}
                    enemy={enemy}
                    className="w-full max-w-[280px]"
                />
            </div>

            {/* Rewards / Loot Table (Bottom) */}
            {outputs.length > 0 && (
                <div className="w-full mt-2">
                    <LootModule
                        items={outputs}
                        title="Potential Drops"
                        mode="loot"
                    />
                </div>
            )}
        </div>
    );
};

export default CombatStage;
