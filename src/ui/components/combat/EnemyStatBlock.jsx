import React from 'react';
import ProgressBar from '../base/ProgressBar.jsx';
import { Shield, Sword, Crosshair, Wand2, Clock, Star, Zap, HelpCircle } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { getEnemyTrait, toRoman } from '../../../config/registries/enemyTraitRegistry.js';
import { useDiscovery } from '../../hooks/useDiscovery.js';

/**
 * EnemyStatBlock
 * Renders the active enemy's stats within a combat stage, dynamically updating their live HP and action timer.
 * Designed as the visual counterpart to the HeroGroup component.
 */
export const EnemyStatBlock = ({ card, enemy, className }) => {
    const { isDiscovered } = useDiscovery();
    const discovered = isDiscovered('enemy', enemy.id);

    if (!enemy) return null;

    // Combat style configurations for dynamic icons
    const styleConfig = {
        melee: { icon: <Sword size={14} />, label: 'Melee Attack' },
        ranged: { icon: <Crosshair size={14} />, label: 'Ranged Attack' },
        magic: { icon: <Wand2 size={14} />, label: 'Magic Attack' }
    };

    const enemyType = enemy.combatType || 'melee';
    const activeStyle = styleConfig[enemyType] || styleConfig['melee'];

    // Stats
    const attackSpeedSec = (enemy.attackSpeed / 1000).toFixed(1);

    // Namespaced Combat State (card.combat)
    // Fallback to max HP from the template if the card doesn't track it yet
    const combat = card?.combat || {};
    const enemyHp = combat.enemyHp || { current: enemy.hp, max: enemy.hp };

    // Attack progress tracking
    const attackProgress = combat.enemyTickProgress || 0;
    const attackPercent = Math.min((attackProgress / enemy.attackSpeed) * 100, 100);

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {/* Live Stats Table (Info Block) */}
            <div className="flex flex-col gap-1 w-full p-2 bg-black/30 rounded-lg border border-white/5">
                {/* Enemy Name Header inside Info Block */}
                <h4 
                    className={cn(
                        "font-display font-bold text-gi-danger text-base text-center truncate w-full uppercase tracking-wider gi-outline-2",
                        !discovered && "blur-[1px] opacity-70"
                    )} 
                    title={discovered ? enemy.name : 'Undiscovered Enemy'}
                >
                    {discovered ? (enemy.name || 'Enemy') : '???'}
                </h4>

                {/* Status effects moved to the Enemy info panel (owner design 2026-07-14) */}

            </div>

            {/* Traits Section */}
            {enemy.traits && enemy.traits.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {enemy.traits.map(traitRef => {
                        const traitDef = getEnemyTrait(traitRef.id);
                        if (!traitDef) return null;
                        
                        const isNegative = traitDef.type === 'negative';
                        const levelStr = toRoman(traitRef.level);
                        
                        if (!discovered) {
                            return (
                                <div 
                                    key={traitRef.id}
                                    className="px-2 py-1 rounded text-[10px] font-bold flex flex-col items-center gap-0.5 border bg-gi-base/40 border-gi-border/20 text-gi-muted/50"
                                    title="Undiscovered Trait"
                                >
                                    <HelpCircle size={10} />
                                    <span>???</span>
                                </div>
                            );
                        }

                        return (
                            <div 
                                key={traitRef.id}
                                className={cn(
                                    "px-2 py-1 rounded text-[10px] font-bold flex flex-col items-center gap-0.5 border",
                                    isNegative 
                                        ? "bg-red-950/60 border-red-500/50 text-red-100" 
                                        : "bg-green-950/60 border-green-500/50 text-green-100"
                                )}
                                title={traitDef.getDescription(traitRef.level)}
                            >
                                <div className="flex items-center gap-1">
                                    <span>{traitDef.icon}</span>
                                    <span>{traitDef.name} {levelStr}</span>
                                </div>
                                <div className="text-[8px] opacity-90 font-medium leading-tight text-center max-w-[80px]">
                                    {traitDef.getDescription(traitRef.level)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

        </div>
    );
};

export default EnemyStatBlock;
