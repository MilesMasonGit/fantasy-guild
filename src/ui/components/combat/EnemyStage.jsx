import React from 'react';
import { cn } from '../../utils/cn.js';
import EnemyStatBlock from './EnemyStatBlock.jsx';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { useDiscovery } from '../../hooks/useDiscovery.js';
import { useCombatFeedback, DamageFloaters } from './combatFeedback.jsx';

/**
 * EnemyStage — the deck-loop combat card face (owner design 2026-07-14).
 * The enemy's half of the split combat theatre: the hero animates over on
 * the Hero card, so this face carries only the enemy — avatar (lunging left
 * toward the hero on its attacks, rattling when struck), name, and traits.
 * Vitals and attack-cycle bars live on the info panels and the universal
 * progress bars, not on the card.
 */
export const EnemyStage = ({ card, enemy, className }) => {
    const { isDiscovered } = useDiscovery();
    const { attacking, struck, floaters } = useCombatFeedback(card?.id, 'enemy');
    if (!card || !enemy) return null;

    const discovered = isDiscovered('enemy', enemy.id);
    const spritePath = discovered ? resolveSpritePath(enemy) : null;

    return (
        <div className={cn('relative flex flex-col flex-1 items-center gap-1 w-full', className)}>
            {/* Victory / intermission overlay */}
            {card.status === 'victory' && (
                <div className="absolute inset-0 bg-yellow-900/10 z-20 flex flex-col items-center justify-center backdrop-blur-[1px]">
                    <div className="text-xs font-bold text-yellow-500 tracking-[0.2em] animate-bounce font-pixel">
                        VICTORY!
                    </div>
                    <div className="text-[9px] text-yellow-500/60 font-medium">
                        SEARCHING FOR NEXT FOE...
                    </div>
                </div>
            )}

            {/* Enemy avatar — lunges toward the hero card (left) on attack */}
            <div className="flex-1 flex items-center justify-center w-full min-h-[110px]">
                <div className={cn(
                    'transition-transform duration-100 animate-bob',
                    attacking && '-translate-x-5 scale-110',
                    struck && 'animate-rattle'
                )}>
                    {spritePath ? (
                        <img src={spritePath} alt={enemy.name} className="w-28 h-28 object-contain pixel-art" />
                    ) : (
                        <div className="text-6xl select-none w-28 h-28 flex items-center justify-center opacity-70">
                            {discovered ? (enemy.icon || '👹') : '❓'}
                        </div>
                    )}
                </div>
            </div>

            {/* Enemy name + traits */}
            <div className="w-full flex justify-center shrink-0">
                <EnemyStatBlock card={card} enemy={enemy} className="w-full max-w-[280px]" />
            </div>

            <DamageFloaters floaters={floaters} />
        </div>
    );
};

export default EnemyStage;
