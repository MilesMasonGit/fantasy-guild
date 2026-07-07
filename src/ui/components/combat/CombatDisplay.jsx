import React, { useEffect, useState, useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { CardSlot } from '../base/CardSlot.jsx';
import { Plus, ShoppingBag } from 'lucide-react';
import { useDiscovery } from '../../hooks/useDiscovery.js';
import { resolvePotentialOutputs } from '../../utils/theaterUtils.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';

/**
 * CombatDisplay
 * A purely visual flavor component that sits at the top of the Combat Stage. 
 * Shows the Hero and Enemy avatars facing each other, triggering CSS animations when attacks occur.
 * 
 * @param {Object} props
 * @param {Object} props.hero - The active hero (or null).
 * @param {Object} props.enemy - The active enemy.
 */
export const CombatDisplay = ({
    hero,
    enemy,
    card,
    isHovered = false,
    className
}) => {
    if (!enemy) return null;

    const [heroAttackAnim, setHeroAttackAnim] = useState(false);
    const [enemyAttackAnim, setEnemyAttackAnim] = useState(false);
    const [damageNumbers, setDamageNumbers] = useState([]); // Array of { id, value, type, x, y }
    const [currentOutputIndex, setCurrentOutputIndex] = useState(0);

    const { isDiscovered } = useDiscovery();

    // Floating animation duration
    const ANIM_DURATION = 1000;

    // Resolve all potential outputs for this card/template
    const potentialOutputs = useMemo(() => {
        if (!card) return [];
        const rawOutputs = resolvePotentialOutputs(card, null);

        // Map undiscovered items/enemies to a single unified placeholder
        const mapped = rawOutputs.map(out => {
            if (out.type === 'enemy') {
                return isDiscovered('enemy', out.id) ? out : { type: 'undiscovered', id: 'undiscovered' };
            }
            if (out.type === 'item') {
                return isDiscovered('item', out.id) ? out : { type: 'undiscovered', id: 'undiscovered' };
            }
            return out; // Loot tables, etc.
        });

        // Deduplicate the mapped list
        const deduped = [];
        for (const out of mapped) {
            if (!deduped.some(d => d.type === out.type && d.id === out.id)) {
                deduped.push(out);
            }
        }
        return deduped;
    }, [card, isDiscovered]);

    const isCombatActive = card?.status === 'active';

    // Cycle through outputs every 2.5 seconds when not actively in combat
    useEffect(() => {
        if (isCombatActive || potentialOutputs.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentOutputIndex(prev => prev + 1);
        }, 2500);

        return () => clearInterval(interval);
    }, [isCombatActive, potentialOutputs.length]);

    useEffect(() => {
        if (!card) return;

        const handleHeroAttack = (event) => {
            if (event.cardId !== card.id) return;

            setHeroAttackAnim(true);
            setTimeout(() => setHeroAttackAnim(false), 300);

            // Add floating number for enemy
            const id = Math.random().toString(36).substr(2, 9);
            setDamageNumbers(prev => [...prev, {
                id,
                value: event.damage || 0,
                hit: event.hit,
                type: 'enemy',
                x: 70 + (Math.random() * 20 - 10), // Random jitter around enemy pos
                y: 40 + (Math.random() * 20 - 10)
            }]);

            setTimeout(() => {
                setDamageNumbers(prev => prev.filter(n => n.id !== id));
            }, ANIM_DURATION);
        };

        const handleEnemyAttack = (event) => {
            if (event.cardId !== card.id) return;

            setEnemyAttackAnim(true);
            setTimeout(() => setEnemyAttackAnim(false), 300);

            // Add floating number for hero
            const id = Math.random().toString(36).substr(2, 9);
            setDamageNumbers(prev => [...prev, {
                id,
                value: event.damage || 0,
                hit: event.hit,
                type: 'hero',
                x: 20 + (Math.random() * 20 - 10), // Random jitter around hero pos
                y: 40 + (Math.random() * 20 - 10)
            }]);

            setTimeout(() => {
                setDamageNumbers(prev => prev.filter(n => n.id !== id));
            }, ANIM_DURATION);
        };

        const handleTraitTrigger = (event) => {
            if (event.cardId !== card.id) return;

            const id = Math.random().toString(36).substr(2, 9);
            setDamageNumbers(prev => [...prev, {
                id,
                value: event.damage || 0,
                hit: true,
                type: 'hero',
                variant: 'reflected',
                x: 20 + (Math.random() * 20 - 10),
                y: 40 + (Math.random() * 20 - 10)
            }]);

            setTimeout(() => {
                setDamageNumbers(prev => prev.filter(n => n.id !== id));
            }, ANIM_DURATION);
        };

        const subHero = EventBus.subscribe('combat_hero_attack', handleHeroAttack);
        const subEnemy = EventBus.subscribe('combat_enemy_attack', handleEnemyAttack);
        const subTrait = EventBus.subscribe('combat_enemy_trait_trigger', handleTraitTrigger);

        return () => {
            subHero();
            subEnemy();
            subTrait();
        };
    }, [card?.id]);

    const renderAvatar = (entity, fallbackIcon) => {
        const spritePath = resolveSpritePath(entity);
        const icon = entity?.icon || fallbackIcon;

        if (spritePath) {
            return (
                <div className="relative w-32 h-32 flex items-center justify-center animate-bob">
                    <img
                        src={spritePath}
                        alt={entity?.name || 'Avatar'}
                        className="w-full h-full object-contain pixel-art"
                    />
                </div>
            );
        }

        return (
            <div className="text-6xl select-none w-32 h-32 flex items-center justify-center animate-bob">
                {icon}
            </div>
        );
    };

    // Determine what to display on the enemy/target side
    const renderTargetSide = () => {
        // If combat is active, always show the active combat enemy
        if (isCombatActive) {
            const discovered = isDiscovered('enemy', enemy.id);
            if (!discovered) {
                return (
                    <div className="text-6xl select-none w-32 h-32 flex items-center justify-center animate-bob opacity-60">
                        ❓
                    </div>
                );
            }
            return renderAvatar(enemy, '👹');
        }

        // Otherwise, cycle through potential outputs
        if (potentialOutputs.length === 0) {
            return renderAvatar(enemy, '👹');
        }

        const activeOutput = potentialOutputs[currentOutputIndex % potentialOutputs.length];

        if (activeOutput.type === 'undiscovered') {
            return (
                <div className="text-6xl select-none w-32 h-32 flex items-center justify-center animate-bob opacity-60">
                    ❓
                </div>
            );
        }

        if (activeOutput.type === 'loot_table') {
            return (
                <div className="w-32 h-32 flex items-center justify-center text-gi-accent animate-bob">
                    <ShoppingBag className="w-16 h-16 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
                </div>
            );
        }

        if (activeOutput.type === 'enemy') {
            const resolvedEnemy = getEnemy(activeOutput.id);
            return renderAvatar(resolvedEnemy, '👹');
        }

        // Default to item output
        const resolvedItem = getItem(activeOutput.id);
        return renderAvatar(resolvedItem, '📦');
    };

    return (
        <div className={cn(
            "relative w-full overflow-hidden transition-all duration-500 ease-in-out",
            (!hero && !isHovered) ? "h-0 opacity-0 pointer-events-none" : "h-40 opacity-100 pointer-events-auto",
            className
        )}>
            {/* Victory / Intermission Overlay */}
            {card?.status === 'victory' && (
                <div className="absolute inset-0 bg-yellow-900/10 z-20 flex flex-col items-center justify-center backdrop-blur-[1px]">
                    <div className="text-xs font-bold text-yellow-500 tracking-[0.2em] animate-bounce font-pixel">
                        VICTORY!
                    </div>
                    <div className="text-[9px] text-yellow-500/60 font-medium">
                        SEARCHING FOR NEXT FOE...
                    </div>
                </div>
            )}

            <div className="absolute inset-0 flex justify-between items-center px-10">
                {/* Hero Avatar or Placeholder */}
                {hero ? (
                    <div className={cn(
                        "flex flex-col items-center justify-center transition-transform duration-100 z-10 animate-bob",
                        heroAttackAnim ? "translate-x-6 scale-110" : ""
                    )}>
                        {renderAvatar(hero, '👤')}
                    </div>
                ) : (
                    <div className={cn(
                        "w-32 h-32 flex items-center justify-center transition-all duration-500 ease-out transform",
                        isHovered ? "translate-x-0 opacity-100" : "-translate-x-20 opacity-0"
                    )}>
                        <CardSlot
                            id={`combat-${card.id || card.instanceId}-slot-0`}
                            className="w-[72px] h-[72px] bg-black/40 hover:bg-black/60 border-2 border-dashed border-white/10 hover:border-gi-primary/50 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all duration-300 pointer-events-auto shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)]"
                            data={{ type: 'heroSlot', cardId: card.id || card.instanceId, slotIndex: 0 }}
                            label=""
                            hero={hero}
                        >
                            <div className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-gi-primary transition-colors">
                                <Plus size={20} className="opacity-60" />
                                <span className="text-[8px] font-bold uppercase tracking-wider leading-none text-center text-gi-primary/80 px-1 gi-outline-1 font-pixel">
                                    Assign
                                </span>
                            </div>
                        </CardSlot>
                    </div>
                )}

                {/* Enemy/Target Avatar */}
                <div className={cn(
                    "flex flex-col items-center justify-center transition-all duration-500 ease-out transform",
                    hero ? "animate-bob" : (isHovered ? "translate-x-0 opacity-100 animate-bob" : "translate-x-20 opacity-0"),
                    hero && enemyAttackAnim ? "-translate-x-6 scale-110" : ""
                )} style={{ animationDelay: '0.5s' }}>
                    <div className={cn("transition-transform duration-75", enemyAttackAnim && "animate-rattle")}>
                        {renderTargetSide()}
                    </div>
                </div>
            </div>

            {/* Floating Damage Numbers */}
            <div className="absolute inset-0 pointer-events-none z-30 font-pixel">
                {damageNumbers.map(num => (
                    <div
                        key={num.id}
                        className={cn(
                            "combat-floating-text-simple select-none font-pixel whitespace-nowrap",
                            !num.hit && "combat-floating-text--miss",
                            num.hit && num.variant === 'reflected' && "combat-floating-text--reflected",
                            num.hit && num.variant !== 'reflected' && "combat-floating-text--damage"
                        )}
                        style={{
                            left: `${num.x}%`,
                            top: `${num.y}%`
                        }}
                    >
                        {num.hit ? `-${num.value}` : 'MISS'}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CombatDisplay;
