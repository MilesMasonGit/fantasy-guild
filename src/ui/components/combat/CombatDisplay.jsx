import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';


/**
 * CombatDisplay
 * A purely visual flavor component that sits at the top of the Combat Stage. 
 * Shows the Hero and Enemy avatars facing each other, triggering CSS animations when attacks occur.
 * 
 * @param {Object} props
 * @param {Object} props.hero - The active hero.
 * @param {Object} props.enemy - The active enemy.
 * @param {Boolean} props.isHeroAttacking - Flag indicating the hero is striking this frame
 * @param {Boolean} props.isEnemyAttacking - Flag indicating the enemy is striking this frame
 */
export const CombatDisplay = ({
    hero,
    enemy,
    card,
    className
}) => {
    if (!hero || !enemy) return null;

    const [heroAttackAnim, setHeroAttackAnim] = useState(false);
    const [enemyAttackAnim, setEnemyAttackAnim] = useState(false);
    const [damageNumbers, setDamageNumbers] = useState([]); // Array of { id, value, type, x, y }

    // Floating animation duration
    const ANIM_DURATION = 1000;

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

    const renderAvatar = (entity, fallbackIcon, isEnemy = false) => {
        const spritePath = resolveSpritePath(entity);
        const icon = entity?.icon || fallbackIcon;

        if (spritePath) {
            return (
                <div className="relative w-32 h-32 flex items-center justify-center">
                    <img 
                        src={spritePath} 
                        alt={entity?.name || 'Avatar'}
                        className="w-full h-full object-contain pixel-art"
                    />
                </div>
            );
        }

        return (
            <div className="text-6xl select-none">
                {icon}
            </div>
        );
    };

    return (
        <div className={cn(
            "relative w-full h-40 overflow-hidden",
            "transition-all duration-300",
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
                {/* Hero Avatar */}
                <div className={cn(
                    "flex flex-col items-center justify-center transition-transform duration-100 z-10 animate-bob",
                    heroAttackAnim ? "translate-x-6 scale-110" : ""
                )}>
                    {renderAvatar(hero, '👤', false)}
                    <div className="mt-2 w-24 h-2 bg-black/60 rounded-[100%] blur-[2px]"></div>
                </div>

                {/* Enemy Avatar */}
                <div className={cn(
                    "flex flex-col items-center justify-center transition-transform duration-100 z-10 animate-bob",
                    enemyAttackAnim ? "-translate-x-6 scale-110" : ""
                )} style={{ animationDelay: '0.5s' }}>
                    {renderAvatar(enemy, '👹', true)}
                    <div className="mt-2 w-24 h-2 bg-black/60 rounded-[100%] blur-[2px]"></div>
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
