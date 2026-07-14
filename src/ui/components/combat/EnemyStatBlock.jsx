import React from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { getEnemyTrait, toRoman } from '../../../config/registries/enemyTraitRegistry.js';
import { useDiscovery } from '../../hooks/useDiscovery.js';

/**
 * EnemyStatBlock
 * The enemy's name + traits block on the combat card face. Vitals, attack
 * timers, and statuses live on the Enemy info panel and the enemy attack
 * bar (owner design 2026-07-14).
 */
export const EnemyStatBlock = ({ card, enemy, className }) => {
    const { isDiscovered } = useDiscovery();
    const discovered = isDiscovered('enemy', enemy.id);

    if (!enemy) return null;

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {/* Name lives in the card title (CardHeaderModule) and statuses on
                the Enemy info panel (owner design 2026-07-14) — only the
                traits remain on the card face. */}

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
